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
    let dummy_hash = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5eBWQdQ7IFzPu"; // Dummy bcrypt hash
    let (password_valid, username, role) = match user {
        Some(user) => {
            match bcrypt::verify(&payload.password, &user.password_hash) {
                Ok(valid) => (valid, user.username, user.role),
                Err(e) => {
                    tracing::error!("Password verification error: {}", e);
                    (false, String::new(), String::new())
                }
            }
        }
        None => {
            // Perform dummy verification to prevent timing attacks
            let _ = bcrypt::verify(&payload.password, dummy_hash);
            (false, String::new(), String::new())
        }
    };

    // Small delay to further prevent timing attacks
    tokio::time::sleep(Duration::from_millis(100)).await;

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
