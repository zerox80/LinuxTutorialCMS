use crate::{auth, repositories};
use axum::{http::StatusCode, Json};

/// AXUM middleware for protecting routes with authentication.
///
/// This middleware validates the JWT token and adds the claims to the
/// request extensions, making them available to downstream handlers.
///
/// # Usage
/// ```rust,no_run
/// use axum::{Router, routing::get, middleware};
/// use linux_tutorial_cms::middleware::auth;
///
/// let app = Router::new()
///     .route("/protected", get(handler))
///     .route_layer(middleware::from_fn(auth::auth_middleware));
/// ```
///
/// # Authentication
/// Accepts tokens from:
/// - Authorization: Bearer <token> header
/// - ltcms_session cookie
///
/// # Errors
/// Returns 401 Unauthorized if:
/// - No token provided
/// - Token is invalid or expired
///
/// # Request Extensions
/// On success, inserts Claims into request extensions for easy access
/// by downstream handlers.
pub async fn auth_middleware(
    axum::extract::State(pool): axum::extract::State<crate::db::DbPool>,
    mut request: axum::extract::Request,
    next: axum::middleware::Next,
) -> Result<axum::response::Response, (StatusCode, Json<crate::models::ErrorResponse>)> {
    // Extract token from request
    let token = auth::extract_token(request.headers()).ok_or_else(|| {
        (
            StatusCode::UNAUTHORIZED,
            Json(crate::models::ErrorResponse {
                error: "Missing authentication token".to_string(),
            }),
        )
    })?;

    // Verify token and extract claims
    let claims = auth::verify_jwt(&token).map_err(|e| {
        (
            StatusCode::UNAUTHORIZED,
            Json(crate::models::ErrorResponse {
                error: format!("Invalid token: {}", e),
            }),
        )
    })?;

    // Check if token is blacklisted
    if let Ok(true) = repositories::token_blacklist::is_token_blacklisted(&pool, &token).await {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(crate::models::ErrorResponse {
                error: "Token has been revoked".to_string(),
            }),
        ));
    }

    // Add claims to request extensions for downstream handlers
    request.extensions_mut().insert(claims);

    Ok(next.run(request).await)
}
