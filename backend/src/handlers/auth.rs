use crate::{auth, db::DbPool, models::*};
use axum::{extract::State, http::StatusCode, Json};
use sqlx;
use std::time::Duration;

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
) -> Result<Json<LoginResponse>, (StatusCode, Json<ErrorResponse>)> {
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
    // Generate a dummy hash with similar computational cost to real verification
    let dummy_hash = "$2b$12$eImiTXuWVxfM37uY4JANjQPzMzXZjQDzqzQpMv0xoGrTplPPNaE3W"; // Precomputed dummy hash
    
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
    // Add random jitter to make timing analysis harder
    let jitter = (chrono::Utc::now().timestamp_subsec_millis() % 50) as u64;
    tokio::time::sleep(Duration::from_millis(100 + jitter)).await;

    if !password_valid {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(ErrorResponse {
                error: "Ungültige Anmeldedaten".to_string(),
            }),
        ));
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

    Ok(Json(LoginResponse {
        token,
        user: UserResponse {
            username,
            role,
        },
    }))
}

pub async fn me(
    claims: auth::Claims,
) -> Result<Json<UserResponse>, (StatusCode, Json<ErrorResponse>)> {
    Ok(Json(UserResponse {
        username: claims.sub,
        role: claims.role,
    }))
}
