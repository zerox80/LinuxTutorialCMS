use crate::{auth, db::DbPool, models::*};
use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    Json,
};
use chrono::{Duration as ChronoDuration, Utc};
use sqlx::{self, FromRow};
use std::time::Duration;

#[derive(Debug, FromRow, Clone)]
struct LoginAttempt {
    fail_count: i64,
    blocked_until: Option<String>,
}

// Input validation
fn validate_username(username: &str) -> Result<(), String> {
    if username.is_empty() {
        return Err("Username cannot be empty".to_string());
    }
    if username.len() > 50 {
        return Err("Username too long".to_string());
    }
    // Allow alphanumeric, underscore, hyphen, dot
    if !username.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-' || c == '.') {
        return Err("Username contains invalid characters".to_string());
    }
    Ok(())
}

fn validate_password(password: &str) -> Result<(), String> {
    if password.is_empty() {
        return Err("Password cannot be empty".to_string());
    }
    if password.len() > 128 {
        return Err("Password too long".to_string());
    }
    Ok(())
}

pub async fn login(
    State(pool): State<DbPool>,
    Json(payload): Json<LoginRequest>,
) -> Result<(HeaderMap, Json<LoginResponse>), (StatusCode, Json<ErrorResponse>)> {
    // Validate input
    if let Err(e) = validate_username(&payload.username) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse { error: e }),
        ));
    }
    if let Err(e) = validate_password(&payload.password) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse { error: e }),
        ));
    }

    // Load login attempt metadata to enforce server-side cooldowns
    let attempt_record = sqlx::query_as::<_, LoginAttempt>(
        "SELECT fail_count, blocked_until FROM login_attempts WHERE username = ?",
    )
    .bind(&payload.username)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to load login attempts for {}: {}", payload.username, e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Internal server error".to_string(),
            }),
        )
    })?;

    if let Some(record) = &attempt_record {
        if let Some(ref blocked_until_str) = record.blocked_until {
            match chrono::DateTime::parse_from_rfc3339(blocked_until_str) {
                Ok(parsed) => {
                    let blocked_until = parsed.with_timezone(&Utc);
                    let now = Utc::now();
                    if blocked_until > now {
                        let remaining = (blocked_until - now).num_seconds().max(0);
                        let jitter = (chrono::Utc::now().timestamp_subsec_millis() % 200) as u64;
                        tokio::time::sleep(Duration::from_millis(100 + jitter)).await;
                        return Err((
                            StatusCode::TOO_MANY_REQUESTS,
                            Json(ErrorResponse {
                                error: format!(
                                    "Zu viele fehlgeschlagene Versuche. Bitte warte {} Sekunde{}.",
                                    remaining,
                                    if remaining == 1 { "" } else { "n" }
                                ),
                            }),
                        ));
                    }
                }
                Err(err) => {
                    tracing::warn!(
                        "Invalid blocked_until value for '{}': {}",
                        payload.username, err
                    );
                }
            }
        }
    }

    // Find user by username
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE username = ?")
        .bind(&payload.username)
        .fetch_optional(&pool)
        .await
        .map_err(|e| {
            tracing::error!("Database error: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Internal server error".to_string(),
                }),
            )
        })?;

    // Timing attack prevention: Always verify password even if user doesn't exist
    // Use a dummy hash that matches DEFAULT_COST to ensure consistent timing
    // This hash was generated with bcrypt::DEFAULT_COST for the password "dummy"
    let dummy_hash = match bcrypt::DEFAULT_COST {
        12 => "$2b$12$eImiTXuWVxfM37uY4JANjQPzMzXZjQDzqzQpMv0xoGrTplPPNaE3W",
        10 => "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy",
        _ => "$2b$12$eImiTXuWVxfM37uY4JANjQPzMzXZjQDzqzQpMv0xoGrTplPPNaE3W", // fallback
    };
    
    let hash_to_verify = user.as_ref().map(|u| u.password_hash.as_str()).unwrap_or(dummy_hash);
    
    // Always perform verification regardless of whether user exists
    let verification_result = bcrypt::verify(&payload.password, hash_to_verify);
    
    let (password_valid, username, role) = match (user, verification_result) {
        (Some(user), Ok(true)) => (true, user.username, user.role),
        (Some(_), Ok(false)) => (false, String::new(), String::new()),
        (Some(_), Err(e)) => {
            tracing::error!("Password verification error: {}", e);
            (false, String::new(), String::new())
        }
        (None, _) => (false, String::new(), String::new()),
    };

    // Variable delay based on operation to prevent timing attacks
    // Add significant random jitter (100-300ms) to make timing analysis harder
    let jitter = (chrono::Utc::now().timestamp_subsec_millis() % 200) as u64;
    tokio::time::sleep(Duration::from_millis(100 + jitter)).await;

    if !password_valid {
        let new_fail_count = attempt_record
            .as_ref()
            .map(|record| record.fail_count + 1)
            .unwrap_or(1);

        let cooldown_until = if new_fail_count >= 5 {
            Some((Utc::now() + ChronoDuration::seconds(60)).to_rfc3339())
        } else if new_fail_count >= 3 {
            Some((Utc::now() + ChronoDuration::seconds(10)).to_rfc3339())
        } else {
            None
        };

        sqlx::query(
            "INSERT INTO login_attempts (username, fail_count, blocked_until) VALUES (?, ?, ?) \
             ON CONFLICT(username) DO UPDATE SET fail_count = excluded.fail_count, blocked_until = excluded.blocked_until",
        )
        .bind(&payload.username)
        .bind(new_fail_count)
        .bind(cooldown_until.as_deref())
        .execute(&pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to record login attempt for {}: {}", payload.username, e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Internal server error".to_string(),
                }),
            )
        })?;

        return Err((
            StatusCode::UNAUTHORIZED,
            Json(ErrorResponse {
                error: "Ungültige Anmeldedaten".to_string(),
            }),
        ));
    }

    // Successful login: reset attempt counter
    if attempt_record.is_some() {
        if let Err(e) = sqlx::query("DELETE FROM login_attempts WHERE username = ?")
            .bind(&payload.username)
            .execute(&pool)
            .await
        {
            tracing::warn!(
                "Failed to clear login attempts for {} after successful login: {}",
                payload.username, e
            );
        }
    }

    // Generate JWT token
    let token = auth::create_jwt(username.clone(), role.clone()).map_err(|e| {
        tracing::error!("JWT creation error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to create token".to_string(),
            }),
        )
    })?;

    let mut headers = HeaderMap::new();
    auth::append_auth_cookie(&mut headers, auth::build_auth_cookie(&token));

    Ok((
        headers,
        Json(LoginResponse {
            token,
            user: UserResponse {
                username,
                role,
            },
        }),
    ))
}

pub async fn me(
    claims: auth::Claims,
) -> Result<Json<UserResponse>, (StatusCode, Json<ErrorResponse>)> {
    Ok(Json(UserResponse {
        username: claims.sub,
        role: claims.role,
    }))
}

pub async fn logout() -> (StatusCode, HeaderMap) {
    let mut headers = HeaderMap::new();
    auth::append_auth_cookie(&mut headers, auth::build_cookie_removal());
    (StatusCode::NO_CONTENT, headers)
}
