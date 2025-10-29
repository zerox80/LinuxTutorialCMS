use axum::{
    async_trait,
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
    RequestPartsExt,
};
use axum_extra::{
    extract::TypedHeader,
    headers::{authorization::Bearer, Authorization},
};
use chrono::Utc;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use std::env;
use std::sync::OnceLock;

pub static JWT_SECRET: OnceLock<String> = OnceLock::new();

pub fn init_jwt_secret() -> Result<(), String> {
    let secret = env::var("JWT_SECRET")
        .map_err(|_| "JWT_SECRET environment variable not set".to_string())?;

    if secret.len() < 32 {
        return Err("JWT_SECRET must be at least 32 characters long".to_string());
    }

    JWT_SECRET
        .set(secret)
        .map_err(|_| "JWT_SECRET already initialized".to_string())?;

    Ok(())
}

fn get_jwt_secret() -> &'static str {
    JWT_SECRET
        .get()
        .expect("JWT_SECRET not initialized. Call init_jwt_secret() first.")
        .as_str()
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String, // username
    pub role: String,
    pub exp: usize,
}

impl Claims {
    pub fn new(username: String, role: String) -> Self {
        // Use checked arithmetic to prevent overflow
        let expiration = chrono::Utc::now()
            .checked_add_signed(chrono::Duration::hours(24))
            .map(|dt| dt.timestamp())
            .and_then(|ts| usize::try_from(ts).ok())
            .unwrap_or_else(|| {
                // Fallback: use current time as best effort (will likely fail validation)
                // This should never happen in practice with modern timestamps
                let now = chrono::Utc::now().timestamp() as usize;
                now.saturating_add(86400) // 24 hours in seconds
            });

        Claims {
            sub: username,
            role,
            exp: expiration,
        }
    }
}

pub fn create_jwt(username: String, role: String) -> Result<String, jsonwebtoken::errors::Error> {
    let claims = Claims::new(username, role);
    let secret = get_jwt_secret();
    
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
}

pub fn verify_jwt(token: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    let secret = get_jwt_secret();
    
    let mut validation = Validation::default();
    validation.leeway = 60; // 60 seconds leeway for clock skew
    validation.validate_exp = true;
    
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )?;
    
    Ok(token_data.claims)
}

#[async_trait]
impl<S> FromRequestParts<S> for Claims
where
    S: Send + Sync,
{
    type Rejection = (StatusCode, String);

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        // Extract the token from the authorization header
        let TypedHeader(Authorization(bearer)) = parts
            .extract::<TypedHeader<Authorization<Bearer>>>()
            .await
            .map_err(|_| {
                (
                    StatusCode::UNAUTHORIZED,
                    "Missing authorization header".to_string(),
                )
            })?;

        // Decode the user data
        let claims = verify_jwt(bearer.token()).map_err(|e| {
            (
                StatusCode::UNAUTHORIZED,
                format!("Invalid token: {}", e),
            )
        })?;

        Ok(claims)
    }
}
