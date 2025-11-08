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

pub static JWT_SECRET: OnceLock<String> = OnceLock::new();

const SECRET_BLACKLIST: &[&str] = &[
    "CHANGE_ME_OR_APP_WILL_FAIL",
    "your-super-secret-jwt-key-min-32-chars-change-me-in-production",
    "PLEASE-SET-THIS-VIA-DOCKER-COMPOSE-ENV",
];
const MIN_SECRET_LENGTH: usize = 43; // ~256 bits when base64 encoded
const MIN_UNIQUE_CHARS: usize = 10;
const MIN_CHAR_CLASSES: usize = 3;

/// The name of the authentication cookie.
pub const AUTH_COOKIE_NAME: &str = "ltcms_session";
const AUTH_COOKIE_TTL_SECONDS: i64 = 24 * 60 * 60; // 24 hours

/// Initializes the JWT secret from the `JWT_SECRET` environment variable.
///
/// This function performs critical security checks to ensure the secret is not a placeholder
/// and meets minimum entropy requirements. It must be called successfully at startup.
///
/// # Returns
///
/// * `Ok(())` if the secret is valid and initialized.
/// * `Err(String)` if the secret is missing, empty, a placeholder, or too weak.
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
        return Err("JWT_SECRET uses a known placeholder value. Generate a fresh random secret (e.g. `openssl rand -base64 48`).".to_string());
    }

    if !secret_has_min_entropy(trimmed) {
        return Err("JWT_SECRET must be a high-entropy value (~256 bits). Use a cryptographically random string of at least 43 characters mixing upper, lower, digits, and symbols.".to_string());
    }

    JWT_SECRET
        .set(trimmed.to_string())
        .map_err(|_| "JWT_SECRET already initialized".to_string())?;

    Ok(())
}

/// Retrieves the initialized JWT secret.
///
/// # Panics
///
/// Panics if `init_jwt_secret` has not been called.
fn get_jwt_secret() -> &'static str {
    JWT_SECRET
        .get()
        .expect("JWT_SECRET not initialized. Call init_jwt_secret() first.")
        .as_str()
}

/// Represents the claims contained within a JWT.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    /// The subject of the token (username).
    pub sub: String,
    /// The role of the user.
    pub role: String,
    /// The expiration timestamp.
    pub exp: usize,
}

impl Claims {
    /// Creates new `Claims` for a user with a 24-hour expiration.
    ///
    /// # Arguments
    ///
    /// * `username` - The username to encode in the token.
    /// * `role` - The user's role.
    pub fn new(username: String, role: String) -> Self {
        // Use checked arithmetic to prevent overflow
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

/// Creates a JWT for the given user.
///
/// # Arguments
///
/// * `username` - The username.
/// * `role` - The user's role.
///
/// # Returns
///
/// A `Result` containing the signed JWT string or a `jsonwebtoken::errors::Error`.
pub fn create_jwt(username: String, role: String) -> Result<String, jsonwebtoken::errors::Error> {
    let claims = Claims::new(username, role);
    let secret = get_jwt_secret();

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
}

/// Verifies a JWT and returns its claims.
///
/// # Arguments
///
/// * `token` - The JWT string to verify.
///
/// # Returns
///
/// A `Result` containing the decoded `Claims` or a `jsonwebtoken::errors::Error`.
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

/// Builds an authentication cookie containing the JWT.
///
/// The cookie is configured with `HttpOnly`, `SameSite=Lax`, and a secure flag if not in a development environment.
///
/// # Arguments
///
/// * `token` - The JWT string to embed in the cookie.
///
/// # Returns
///
/// A `Cookie` struct ready to be added to a response.
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

/// Builds a cookie that instructs the client to remove the authentication cookie.
///
/// This is achieved by setting an immediate expiration date.
///
/// # Returns
///
/// A `Cookie` struct for removal.
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

/// Axum extractor for `Claims`.
///
/// This allows handlers to easily require authentication by including `Claims` in their arguments.
/// It extracts the token from the `Authorization` header or the auth cookie.
impl<S> FromRequestParts<S> for Claims
where
    S: Send + Sync,
{
    type Rejection = (StatusCode, String);

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let token = extract_token(&parts.headers).ok_or_else(|| {
            (
                StatusCode::UNAUTHORIZED,
                "Missing authentication token".to_string(),
            )
        })?;

        // Decode the user data
        let claims = verify_jwt(&token)
            .map_err(|e| (StatusCode::UNAUTHORIZED, format!("Invalid token: {}", e)))?;

        Ok(claims)
    }
}

/// Appends a `Set-Cookie` header to a `HeaderMap`.
///
/// # Arguments
///
/// * `headers` - The `HeaderMap` to modify.
/// * `cookie` - The `Cookie` to append.
pub fn append_auth_cookie(headers: &mut HeaderMap, cookie: Cookie<'static>) {
    if let Ok(value) = HeaderValue::from_str(&cookie.to_string()) {
        headers.append(SET_COOKIE, value);
    } else {
        tracing::error!("Failed to serialize auth cookie for Set-Cookie header");
    }
}

/// Checks if a secret meets minimum entropy requirements.
///
/// A secret is considered high-entropy if it:
/// - Is at least `MIN_SECRET_LENGTH` characters long.
/// - Contains at least `MIN_CHAR_CLASSES` character classes (lower, upper, digit, symbol).
/// - Has at least `MIN_UNIQUE_CHARS` unique characters.
///
/// # Arguments
///
/// * `secret` - The secret string to check.
///
/// # Returns
///
/// `true` if the secret meets the criteria, `false` otherwise.
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

/// Determines if the `Secure` flag should be set on cookies.
///
/// The flag is set unless the `AUTH_COOKIE_SECURE` environment variable is explicitly "false".
///
/// # Returns
///
/// `true` if cookies should be secure, `false` otherwise.
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

/// Extracts a JWT from request headers.
///
/// It first checks for an `Authorization: Bearer <token>` header, falling back
/// to the authentication cookie if not found.
///
/// # Arguments
///
/// * `headers` - The `HeaderMap` from the incoming request.
///
/// # Returns
///
/// An `Option<String>` containing the token if found.
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

/// Parses a token from an `Authorization: Bearer <token>` header value.
///
/// # Arguments
///
/// * `value` - The raw string from the `Authorization` header.
///
/// # Returns
///
/// An `Option<String>` containing the token if parsing is successful.
fn parse_bearer_token(value: &str) -> Option<String> {
    let trimmed = value.trim();
    let (scheme, token) = trimmed.split_once(' ')?;
    if scheme.eq_ignore_ascii_case("Bearer") && !token.trim().is_empty() {
        return Some(token.trim().to_string());
    }
    None
}
