use crate::{auth, csrf, db::DbPool, models::*};
use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    Json,
};
use chrono::{DateTime, Duration as ChronoDuration, Utc};
use sqlx::{self, FromRow};
use std::{env, sync::OnceLock, time::Duration};
use sha2::{Digest, Sha256};

#[derive(Debug, FromRow, Clone)]
struct LoginAttempt {
    fail_count: i64,
    blocked_until: Option<String>,
}

fn hash_login_identifier(username: &str) -> String {
    static SALT: OnceLock<String> = OnceLock::new();

    let salt = SALT.get_or_init(|| {
        env::var("LOGIN_ATTEMPT_SALT").unwrap_or_else(|_| {
            tracing::error!(
                "LOGIN_ATTEMPT_SALT environment variable is missing. Set a high-entropy value to enable secure brute-force protection."
            );
            panic!(
                "LOGIN_ATTEMPT_SALT must be set to a random, high-entropy string. See .env.example for guidance."
            );
        })
    });

    let mut hasher = Sha256::new();
    hasher.update(salt.as_bytes());
    hasher.update(username.trim().to_ascii_lowercase().as_bytes());
    format!("{:x}", hasher.finalize())
}

fn parse_rfc3339_opt(value: &Option<String>) -> Option<DateTime<Utc>> {
    value.as_ref().and_then(|timestamp| chrono::DateTime::parse_from_rfc3339(timestamp).ok()).map(|dt| dt.with_timezone(&Utc))
}

fn dummy_bcrypt_hash() -> &'static str {
    static DUMMY_HASH: OnceLock<String> = OnceLock::new();

    DUMMY_HASH.get_or_init(|| {
        match bcrypt::hash("dummy", bcrypt::DEFAULT_COST) {
            Ok(hash) => hash,
            Err(err) => {
                tracing::error!("Failed to generate dummy hash: {}", err);
                "$2b$12$eImiTXuWVxfM37uY4JANjQPzMzXZjQDzqzQpMv0xoGrTplPPNaE3W".to_string()
            }
        }
    })
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

/// Handles user login requests.
///
/// This function validates credentials, implements brute-force protection with exponential backoff,
/// and issues a JWT upon successful authentication. It is designed to be resistant to timing attacks.
///
/// # Arguments
///
/// * `State(pool)` - The database connection pool.
/// * `Json(payload)` - The `LoginRequest` containing the username and password.
///
/// # Returns
///
/// * `Ok((HeaderMap, Json<LoginResponse>))` - On success, returns headers with a `Set-Cookie`
///   and a JSON response with the JWT and user information.
/// * `Err((StatusCode, Json<ErrorResponse>))` - On failure, returns an appropriate HTTP status
///   code and an error message.
pub async fn login(
    State(pool): State<DbPool>,
    Json(payload): Json<LoginRequest>,
) -> Result<(HeaderMap, Json<LoginResponse>), (StatusCode, Json<ErrorResponse>)> {
    let username = payload.username.trim().to_string();

    // Validate input
    if let Err(e) = validate_username(&username) {
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
    let attempt_key = hash_login_identifier(&username);

    let attempt_record = sqlx::query_as::<_, LoginAttempt>(
        "SELECT fail_count, blocked_until FROM login_attempts WHERE username = ?",
    )
    .bind(&attempt_key)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to load login attempts for {}: {}", username, e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Internal server error".to_string(),
            }),
        )
    })?;

    if let Some(record) = &attempt_record {
        if let Some(blocked_until) = parse_rfc3339_opt(&record.blocked_until) {
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
    }

    // Find user by username
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE username = ?")
        .bind(&username)
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
    let hash_to_verify_owned = user.as_ref().map(|u| u.password_hash.clone());
    let hash_to_verify = hash_to_verify_owned.as_deref().unwrap_or(dummy_bcrypt_hash());
    
    // Always perform verification regardless of whether user exists
    let verification_result = bcrypt::verify(&payload.password, hash_to_verify);
    
    let (password_valid, user_record) = match (user, verification_result) {
        (Some(user), Ok(true)) => (true, Some(user)),
        (Some(_), Ok(false)) => (false, None),
        (Some(_), Err(e)) => {
            tracing::error!("Password verification error: {}", e);
            (false, None)
        }
        (None, _) => (false, None),
    };

    // Variable delay based on operation to prevent timing attacks
    // Add significant random jitter (100-300ms) to make timing analysis harder
    let jitter = (chrono::Utc::now().timestamp_subsec_millis() % 200) as u64;
    tokio::time::sleep(Duration::from_millis(100 + jitter)).await;

    if !password_valid {
        let now = Utc::now();
        let long_block = (now + ChronoDuration::seconds(60)).to_rfc3339();
        let short_block = (now + ChronoDuration::seconds(10)).to_rfc3339();

        sqlx::query(
            "INSERT INTO login_attempts (username, fail_count, blocked_until) VALUES (?, 1, NULL) \
             ON CONFLICT(username) DO UPDATE SET fail_count = login_attempts.fail_count + 1, \
             blocked_until = CASE \
                 WHEN login_attempts.fail_count + 1 >= 5 THEN ? \
                 WHEN login_attempts.fail_count + 1 >= 3 THEN ? \
                 ELSE NULL \
             END",
        )
        .bind(&attempt_key)
        .bind(&long_block)
        .bind(&short_block)
        .execute(&pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to record login attempt for hashed key: {}", e);
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
            .bind(&attempt_key)
            .execute(&pool)
            .await
        {
            tracing::warn!(
                "Failed to clear login attempts for hashed key after successful login: {}",
                e
            );
        }
    }

    // Generate JWT token
    let user_record = user_record.expect("Successful login must have user record");
    let token = auth::create_jwt(user_record.username.clone(), user_record.role.clone()).map_err(|e| {
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

    if let Ok(csrf_token) = csrf::issue_csrf_token(&user_record.username) {
        csrf::append_csrf_cookie(&mut headers, &csrf_token);
    } else {
        tracing::error!("Failed to issue CSRF token for user {}", user_record.username);
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to create token".to_string(),
            }),
        ));
    }

    Ok((
        headers,
        Json(LoginResponse {
            token,
            user: UserResponse {
                username: user_record.username,
                role: user_record.role,
            },
        }),
    ))
}

/// Retrieves the current authenticated user's information from their JWT claims.
///
/// # Arguments
///
/// * `claims` - The `Claims` extracted from a valid JWT.
///
/// # Returns
///
/// A `Json<UserResponse>` containing the user's username and role.
pub async fn me(
    claims: auth::Claims,
) -> Result<Json<UserResponse>, (StatusCode, Json<ErrorResponse>)> {
    Ok(Json(UserResponse {
        username: claims.sub,
        role: claims.role,
    }))
}

/// Handles user logout requests.
///
/// This function clears the authentication cookie, effectively logging the user out.
///
/// # Returns
///
/// An HTTP `204 No Content` response with a `Set-Cookie` header to clear the auth cookie.
pub async fn logout(
    claims: auth::Claims,
) -> (StatusCode, HeaderMap) {
    let mut headers = HeaderMap::new();
    auth::append_auth_cookie(&mut headers, auth::build_cookie_removal());
    csrf::append_csrf_removal(&mut headers);
    tracing::info!(user = %claims.sub, "User logged out");
    (StatusCode::NO_CONTENT, headers)
}
