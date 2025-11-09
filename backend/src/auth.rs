

//! Authentication and Authorization Module
//!
//! This module provides comprehensive authentication and authorization functionality for the Linux Tutorial CMS.
//! It handles JWT (JSON Web Token) creation and validation, secure cookie management, and middleware
//! for protecting routes that require authentication.
//!
//! Key Features:
//! - JWT-based authentication with configurable secrets
//! - Secure cookie handling with proper security flags
//! - Role-based authorization through claims
//! - Security validation for JWT secrets to prevent weak credentials
//! - Support for both Bearer token and cookie-based authentication

use axum::{
    extract::FromRequestParts,
    http::{
        header::{AUTHORIZATION, SET_COOKIE},
        request::Parts,
        HeaderMap, HeaderValue, StatusCode,
    },
};
use axum_extra::extract::cookie::{Cookie, CookieJar, SameSite};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::env;
use std::sync::OnceLock;
use time::{Duration as TimeDuration, OffsetDateTime};

/// Global JWT secret storage using OnceLock for thread-safe one-time initialization
/// This ensures the secret is set once at application startup and never changed
pub static JWT_SECRET: OnceLock<String> = OnceLock::new();

/// Blacklist of known weak/placeholder JWT secrets that should be rejected
/// These are common default values that developers might accidentally use in production
const SECRET_BLACKLIST: &[&str] = &[
    "CHANGE_ME_OR_APP_WILL_FAIL",
    "your-super-secret-jwt-key-min-32-chars-change-me-in-production",
    "PLEASE-SET-THIS-VIA-DOCKER-COMPOSE-ENV",
];

/// Minimum required length for JWT secrets (43 chars = ~256 bits of entropy when base64 encoded)
const MIN_SECRET_LENGTH: usize = 43;

/// Minimum number of unique characters required in JWT secrets to prevent repetition attacks
const MIN_UNIQUE_CHARS: usize = 10;

/// Minimum number of character classes (lowercase, uppercase, digits, symbols) required
const MIN_CHAR_CLASSES: usize = 3;

/// Name of the authentication cookie stored in the user's browser
pub const AUTH_COOKIE_NAME: &str = "ltcms_session";

/// Time-to-live for authentication cookies in seconds (24 hours)
const AUTH_COOKIE_TTL_SECONDS: i64 = 24 * 60 * 60;

/// Initialize the JWT secret from environment variables with comprehensive security validation
///
/// This function should be called once during application startup to validate and set the JWT secret.
/// It performs multiple security checks to ensure the secret is strong enough for production use.
///
/// # Returns
/// * `Ok(())` - JWT secret successfully initialized and validated
/// * `Err(String)` - Detailed error message describing why initialization failed
///
/// # Security Checks Performed:
/// 1. Environment variable existence
/// 2. Empty/whitespace rejection
/// 3. Known placeholder/blacklist rejection
/// 4. Entropy and complexity validation
///
/// # Example
/// ```rust
/// if let Err(e) = init_jwt_secret() {
///     eprintln!("Failed to initialize JWT secret: {}", e);
///     std::process::exit(1);
/// }
/// ```
pub fn init_jwt_secret() -> Result<(), String> {

    let secret = env::var("JWT_SECRET")
        .map_err(|_| "JWT_SECRET environment variable not set".to_string())?;
    let trimmed = secret.trim();

    if trimmed.is_empty() {
        return Err("JWT_SECRET cannot be empty or whitespace".to_string());
    }

    if SECRET_BLACKLIST
        .iter()
        .any(|candidate| candidate.eq_ignore_ascii_case(trimmed))
    {
        return Err(
            "JWT_SECRET uses a known placeholder value. Generate a fresh random secret (e.g. `openssl rand -base64 48)`."
                .to_string(),
        );
    }

    if !secret_has_min_entropy(trimmed) {
        return Err(
            "JWT_SECRET must be a high-entropy value (~256 bits). Use a cryptographically random string of at least 43 characters mixing upper, lower, digits, and symbols."
                .to_string(),
        );
    }

    JWT_SECRET
        .set(trimmed.to_string())
        .map_err(|_| "JWT_SECRET already initialized".to_string())?;

    Ok(())
}

fn get_jwt_secret() -> &'static str {
    JWT_SECRET
        .get()
        .expect("JWT_SECRET not initialized. Call init_jwt_secret() first.")
        .as_str()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {

    pub sub: String,

    pub role: String,

    pub exp: usize,
}

impl Claims {

    pub fn new(username: String, role: String) -> Self {

        let expiration = Utc::now()
            .checked_add_signed(Duration::hours(24))
            .and_then(|dt| usize::try_from(dt.timestamp()).ok())
            .expect(
                "Failed to calculate JWT expiration timestamp. System time may be misconfigured.",
            );

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
    validation.leeway = 60;
    validation.validate_exp = true;

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )?;

    Ok(token_data.claims)
}

pub fn build_auth_cookie(token: &str) -> Cookie<'static> {

    let mut builder = Cookie::build((AUTH_COOKIE_NAME, token.to_owned()))
        .path("/")
        .http_only(true)
        .same_site(SameSite::Lax)
        .max_age(TimeDuration::seconds(AUTH_COOKIE_TTL_SECONDS));

    if cookies_should_be_secure() {
        builder = builder.secure(true);
    }

    builder.build()
}

pub fn build_cookie_removal() -> Cookie<'static> {

    let mut builder = Cookie::build((AUTH_COOKIE_NAME, ""))
        .path("/")
        .http_only(true)
        .same_site(SameSite::Lax)
        .expires(OffsetDateTime::UNIX_EPOCH)
        .max_age(TimeDuration::seconds(0));

    if cookies_should_be_secure() {
        builder = builder.secure(true);
    }

    builder.build()
}

impl<S> FromRequestParts<S> for Claims
where
    S: Send + Sync,
{

    type Rejection = (StatusCode, String);

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {

        if let Some(claims) = parts.extensions.get::<Claims>() {
            return Ok(claims.clone());
        }

        let token = extract_token(&parts.headers).ok_or_else(|| {
            (
                StatusCode::UNAUTHORIZED,
                "Missing authentication token".to_string(),
            )
        })?;

        let claims = verify_jwt(&token)
            .map_err(|e| (StatusCode::UNAUTHORIZED, format!("Invalid token: {}", e)))?;

        Ok(claims)
    }
}

pub fn append_auth_cookie(headers: &mut HeaderMap, cookie: Cookie<'static>) {

    if let Ok(value) = HeaderValue::from_str(&cookie.to_string()) {
        headers.append(SET_COOKIE, value);
    } else {

        tracing::error!("Failed to serialize auth cookie for Set-Cookie header");
    }
}

fn secret_has_min_entropy(secret: &str) -> bool {

    if secret.len() < MIN_SECRET_LENGTH {
        return false;
    }

    let mut classes = 0;
    if secret.chars().any(|c| c.is_ascii_lowercase()) {
        classes += 1;
    }
    if secret.chars().any(|c| c.is_ascii_uppercase()) {
        classes += 1;
    }
    if secret.chars().any(|c| c.is_ascii_digit()) {
        classes += 1;
    }
    if secret.chars().any(|c| !c.is_ascii_alphanumeric()) {
        classes += 1;
    }

    if classes < MIN_CHAR_CLASSES {
        return false;
    }

    let unique_chars: HashSet<char> = secret.chars().collect();
    unique_chars.len() >= MIN_UNIQUE_CHARS
}

pub fn cookies_should_be_secure() -> bool {
    match env::var("AUTH_COOKIE_SECURE") {

        Ok(value) if value.trim().eq_ignore_ascii_case("false") => {
            tracing::warn!(
                "AUTH_COOKIE_SECURE explicitly set to false. Cookies will be sent over HTTP; only use this in trusted development environments."
            );
            false
        }

        _ => true,
    }
}

fn extract_token(headers: &HeaderMap) -> Option<String> {

    if let Some(header_value) = headers.get(AUTHORIZATION) {
        if let Ok(value_str) = header_value.to_str() {
            if let Some(token) = parse_bearer_token(value_str) {
                return Some(token);
            }
        }
    }

    let jar = CookieJar::from_headers(headers);
    jar.get(AUTH_COOKIE_NAME)
        .map(|cookie| cookie.value().to_string())
}

fn parse_bearer_token(value: &str) -> Option<String> {

    let trimmed = value.trim();
    let (scheme, token) = trimmed.split_once(' ')?;
    

    if scheme.eq_ignore_ascii_case("Bearer") && !token.trim().is_empty() {
        return Some(token.trim().to_string());
    }
    None
}

pub async fn auth_middleware(
    mut request: axum::extract::Request,
    next: axum::middleware::Next,
) -> Result<axum::response::Response, (StatusCode, String)> {

    let token = extract_token(request.headers()).ok_or_else(|| {
        (
            StatusCode::UNAUTHORIZED,
            "Missing authentication token".to_string(),
        )
    })?;

    let claims = verify_jwt(&token)
        .map_err(|e| (StatusCode::UNAUTHORIZED, format!("Invalid token: {}", e)))?;

    request.extensions_mut().insert(claims);

    Ok(next.run(request).await)
}
