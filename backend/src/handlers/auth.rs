

/**
 * Authentication Handlers Module
 *
 * This module provides HTTP request handlers for user authentication operations.
 * It handles login, logout, user profile management, and security features
 * including rate limiting, brute force protection, and session management.
 *
 * Security Features:
 * - Brute force protection with rate limiting and account blocking
 * - Secure password hashing with bcrypt
 * - Timing attack prevention for username enumeration
 * - CSRF token generation for authenticated sessions
 * - Login attempt tracking with salted hashing
 *
 * Rate Limiting:
 * - Configurable failed login attempt thresholds
 * - Temporary account blocking after excessive failures
 * - Progressive blocking based on attempt count
 * - Secure storage of attempt data with SHA256 hashing
 */

use crate::{auth, csrf, db::DbPool, models::*};
use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    Json,
};
use chrono::{DateTime, Duration as ChronoDuration, Utc};
use sha2::{Digest, Sha256};
use sqlx::{self, FromRow};
use std::{env, sync::OnceLock, time::Duration};

/// Database model for tracking login attempt statistics and account blocking.
///
/// This struct represents the login_attempts table record for a specific user.
/// It tracks failed login attempts and temporary account blocks for security.
///
/// # Fields
/// - `fail_count`: Number of consecutive failed login attempts
/// - `blocked_until`: ISO 8601 timestamp when the account block expires (if blocked)
#[derive(Debug, FromRow, Clone)]
struct LoginAttempt {
    /// Number of consecutive failed login attempts for this user
    fail_count: i64,

    /// ISO 8601 timestamp when temporary block expires (None if not blocked)
    blocked_until: Option<String>,
}

/// Creates a secure hash for login attempt tracking to prevent username enumeration.
///
/// This function generates a SHA256 hash of the username combined with a secret salt.
/// The hash is used as the primary key in the login_attempts table instead of the
/// raw username to prevent attackers from discovering valid usernames through timing attacks.
///
/// # Security Features
/// - Uses secret salt to prevent rainbow table attacks
/// - Normalizes username to lowercase for consistent hashing
/// - Prevents username enumeration through database analysis
/// - SHA256 provides sufficient security for this use case
///
/// # Environment Variables
/// - `LOGIN_ATTEMPT_SALT`: Required secret salt for hashing (must be high entropy)
///
/// # Arguments
/// * `username` - The username to hash (will be trimmed and lowercased)
///
/// # Returns
/// Hexadecimal SHA256 hash of salt + normalized username
///
/// # Panics
/// Panics if LOGIN_ATTEMPT_SALT environment variable is not set
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
    value
        .as_ref()
        .and_then(|timestamp| chrono::DateTime::parse_from_rfc3339(timestamp).ok())
        .map(|dt| dt.with_timezone(&Utc))
}

fn dummy_bcrypt_hash() -> &'static str {
    static DUMMY_HASH: OnceLock<String> = OnceLock::new();

    DUMMY_HASH.get_or_init(|| match bcrypt::hash("dummy", bcrypt::DEFAULT_COST) {
        Ok(hash) => hash,
        Err(err) => {
            tracing::error!("Failed to generate dummy hash: {}", err);
            "$2b$12$eImiTXuWVxfM37uY4JANjQPzMzXZjQDzqzQpMv0xoGrTplPPNaE3W".to_string()
        }
    })
}

fn validate_username(username: &str) -> Result<(), String> {
    if username.is_empty() {
        return Err("Username cannot be empty".to_string());
    }
    if username.len() > 50 {
        return Err("Username too long".to_string());
    }

    if !username
        .chars()
        .all(|c| c.is_alphanumeric() || c == '_' || c == '-' || c == '.')
    {
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
    let username = payload.username.trim().to_string();

    if let Err(e) = validate_username(&username) {
        return Err((StatusCode::BAD_REQUEST, Json(ErrorResponse { error: e })));
    }
    if let Err(e) = validate_password(&payload.password) {
        return Err((StatusCode::BAD_REQUEST, Json(ErrorResponse { error: e })));
    }

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

    let hash_to_verify_owned = user.as_ref().map(|u| u.password_hash.clone());
    let hash_to_verify = hash_to_verify_owned
        .as_deref()
        .unwrap_or(dummy_bcrypt_hash());

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

    let user_record = user_record.expect("Successful login must have user record");
    let token =
        auth::create_jwt(user_record.username.clone(), user_record.role.clone()).map_err(|e| {
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
        tracing::error!(
            "Failed to issue CSRF token for user {}",
            user_record.username
        );
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

pub async fn me(
    claims: auth::Claims,
) -> Result<Json<UserResponse>, (StatusCode, Json<ErrorResponse>)> {
    Ok(Json(UserResponse {
        username: claims.sub,
        role: claims.role,
    }))
}

pub async fn logout(_csrf: csrf::CsrfGuard, claims: auth::Claims) -> (StatusCode, HeaderMap) {
    let mut headers = HeaderMap::new();
    auth::append_auth_cookie(&mut headers, auth::build_cookie_removal());
    csrf::append_csrf_removal(&mut headers);
    tracing::info!(user = %claims.sub, "User logged out");
    (StatusCode::NO_CONTENT, headers)
}
