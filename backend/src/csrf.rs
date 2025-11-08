use async_trait::async_trait;
use axum::{
    extract::FromRequestParts,
    http::{
        header::{HeaderName, SET_COOKIE},
        request::Parts,
        HeaderMap, HeaderValue, Method, StatusCode,
    },
    Json,
};
use axum_extra::extract::cookie::{Cookie, CookieJar, SameSite};
use base64ct::{Base64UrlUnpadded, Encoding};
use chrono::{Duration, Utc};
use hmac::{Hmac, Mac};
use sha2::Sha256;
use std::{collections::HashSet, env, sync::OnceLock};
use time::{Duration as TimeDuration, OffsetDateTime};
use uuid::Uuid;

use crate::{auth, models::ErrorResponse};

type HmacSha256 = Hmac<Sha256>;

const CSRF_SECRET_ENV: &str = "CSRF_SECRET";
const CSRF_COOKIE_NAME: &str = "ltcms_csrf";
const CSRF_HEADER_NAME: &str = "x-csrf-token";
const CSRF_TOKEN_TTL_SECONDS: i64 = 6 * 60 * 60; // 6 hours
const CSRF_MIN_SECRET_LENGTH: usize = 32;
const CSRF_VERSION: &str = "v1";

static CSRF_SECRET: OnceLock<Vec<u8>> = OnceLock::new();

/// Initializes the CSRF secret from the `CSRF_SECRET` environment variable.
///
/// This must be called at application startup. It validates that the secret
/// meets minimum length and complexity requirements.
pub fn init_csrf_secret() -> Result<(), String> {
    let secret = env::var(CSRF_SECRET_ENV)
        .map_err(|_| format!("{CSRF_SECRET_ENV} environment variable not set"))?;
    let trimmed = secret.trim();

    if trimmed.len() < CSRF_MIN_SECRET_LENGTH {
        return Err(format!(
            "{CSRF_SECRET_ENV} must be at least {CSRF_MIN_SECRET_LENGTH} characters long"
        ));
    }

    let unique_chars = trimmed.chars().collect::<HashSet<_>>().len();
    if unique_chars < 10 {
        return Err(format!(
            "{CSRF_SECRET_ENV} must contain at least 10 unique characters"
        ));
    }

    CSRF_SECRET
        .set(trimmed.as_bytes().to_vec())
        .map_err(|_| "CSRF secret already initialized".to_string())?;

    Ok(())
}

/// Retrieves the initialized CSRF secret. Panics if not initialized.
fn get_secret() -> &'static [u8] {
    CSRF_SECRET
        .get()
        .expect("CSRF secret not initialized. Call init_csrf_secret() first.")
        .as_slice()
}

/// Issues a new CSRF token for a given username.
///
/// The token embeds the username, expiry, and a nonce, signed with HMAC-SHA256.
pub fn issue_csrf_token(username: &str) -> Result<String, String> {
    if username.is_empty() {
        return Err("Username required for CSRF token".to_string());
    }

    let expiry = Utc::now()
        .checked_add_signed(Duration::seconds(CSRF_TOKEN_TTL_SECONDS))
        .ok_or_else(|| "Failed to compute CSRF expiry".to_string())?
        .timestamp();

    let nonce = Uuid::new_v4().to_string();
    let username_b64 = Base64UrlUnpadded::encode_string(username.as_bytes());
    let payload = format!("{username_b64}|{expiry}|{nonce}");
    let versioned_payload = format!("{CSRF_VERSION}|{payload}");

    let mut mac = HmacSha256::new_from_slice(get_secret())
        .map_err(|_| "Failed to initialize CSRF HMAC".to_string())?;
    mac.update(versioned_payload.as_bytes());
    let signature = Base64UrlUnpadded::encode_string(&mac.finalize().into_bytes());

    Ok(format!("{versioned_payload}|{signature}"))
}

/// Validates a CSRF token against an expected username.
///
/// Checks the token's signature, expiry, and that it belongs to the authenticated user.
fn validate_csrf_token(token: &str, expected_username: &str) -> Result<(), String> {
    let mut parts = token.split('|');

    let version = parts
        .next()
        .ok_or_else(|| "Malformed CSRF token".to_string())?;
    if version != CSRF_VERSION {
        return Err("Unsupported CSRF token version".to_string());
    }

    let username_b64 = parts
        .next()
        .ok_or_else(|| "Malformed CSRF token".to_string())?;
    let expiry_str = parts
        .next()
        .ok_or_else(|| "Malformed CSRF token".to_string())?;
    let nonce = parts
        .next()
        .ok_or_else(|| "Malformed CSRF token".to_string())?;
    let signature = parts
        .next()
        .ok_or_else(|| "Malformed CSRF token".to_string())?;

    if parts.next().is_some() {
        return Err("Malformed CSRF token".to_string());
    }

    let username_bytes = Base64UrlUnpadded::decode_vec(username_b64)
        .map_err(|_| "Malformed CSRF username segment".to_string())?;
    let username = String::from_utf8(username_bytes)
        .map_err(|_| "Invalid CSRF username encoding".to_string())?;

    if username != expected_username {
        return Err("CSRF token not issued for this account".to_string());
    }

    let expiry: i64 = expiry_str
        .parse()
        .map_err(|_| "Invalid CSRF expiry".to_string())?;

    if expiry < Utc::now().timestamp() {
        return Err("CSRF token expired".to_string());
    }

    if nonce.len() < 16 {
        return Err("CSRF nonce too short".to_string());
    }

    let versioned_payload = format!("{version}|{username_b64}|{expiry}|{nonce}");
    let mut mac = HmacSha256::new_from_slice(get_secret())
        .map_err(|_| "Failed to initialize CSRF HMAC".to_string())?;
    mac.update(versioned_payload.as_bytes());
    let expected_signature = mac.finalize().into_bytes();

    let provided_signature = Base64UrlUnpadded::decode_vec(signature)
        .map_err(|_| "Invalid CSRF signature".to_string())?;

    if expected_signature.len() != provided_signature.len()
        || !subtle_equals(&expected_signature, &provided_signature)
    {
        return Err("CSRF signature mismatch".to_string());
    }

    Ok(())
}

/// Performs a constant-time comparison of two byte slices.
fn subtle_equals(a: &[u8], b: &[u8]) -> bool {
    use subtle::ConstantTimeEq;
    a.ct_eq(b).into()
}

/// Appends a `Set-Cookie` header for the CSRF token to a `HeaderMap`.
pub fn append_csrf_cookie(headers: &mut HeaderMap, token: &str) {
    let cookie = build_csrf_cookie(token);
    if let Ok(value) = HeaderValue::from_str(&cookie.to_string()) {
        headers.append(SET_COOKIE, value);
    } else {
        tracing::error!("Failed to serialize CSRF cookie");
    }
}

/// Appends a `Set-Cookie` header to clear the CSRF cookie.
pub fn append_csrf_removal(headers: &mut HeaderMap) {
    let cookie = build_csrf_removal();
    if let Ok(value) = HeaderValue::from_str(&cookie.to_string()) {
        headers.append(SET_COOKIE, value);
    } else {
        tracing::error!("Failed to serialize CSRF removal cookie");
    }
}

/// Builds the CSRF cookie with appropriate security flags.
fn build_csrf_cookie(token: &str) -> Cookie<'static> {
    let mut builder = Cookie::build((CSRF_COOKIE_NAME, token.to_owned()))
        .path("/")
        .same_site(SameSite::Strict)
        .max_age(TimeDuration::seconds(CSRF_TOKEN_TTL_SECONDS))
        .http_only(false);

    if auth::cookies_should_be_secure() {
        builder = builder.secure(true);
    }

    builder.build()
}

/// Builds a cookie that instructs the client to remove the CSRF cookie.
fn build_csrf_removal() -> Cookie<'static> {
    let mut builder = Cookie::build((CSRF_COOKIE_NAME, ""))
        .path("/")
        .same_site(SameSite::Strict)
        .expires(OffsetDateTime::UNIX_EPOCH)
        .max_age(TimeDuration::seconds(0))
        .http_only(false);

    if auth::cookies_should_be_secure() {
        builder = builder.secure(true);
    }

    builder.build()
}

/// An Axum extractor that enforces CSRF protection for state-changing requests.
///
/// This guard checks for a valid CSRF token in both the cookie and header,
/// ensuring they match and are valid for the authenticated user.
pub struct CsrfGuard;

#[async_trait]
impl<S> FromRequestParts<S> for CsrfGuard
where
    S: Send + Sync,
{
    type Rejection = (StatusCode, Json<ErrorResponse>);

    async fn from_request_parts<'a>(
        parts: &'a mut Parts,
        _state: &S,
    ) -> Result<Self, Self::Rejection> {
        if matches!(
            parts.method,
            Method::GET | Method::HEAD | Method::OPTIONS | Method::TRACE
        ) {
            return Ok(Self);
        }

        let Some(claims) = parts.extensions.get::<auth::Claims>() else {
            return Err((
                StatusCode::UNAUTHORIZED,
                Json(ErrorResponse {
                    error: "Missing authentication context".to_string(),
                }),
            ));
        };

        let header_value = parts
            .headers
            .get(HeaderName::from_static(CSRF_HEADER_NAME))
            .and_then(|value| value.to_str().ok())
            .ok_or_else(|| {
                (
                    StatusCode::FORBIDDEN,
                    Json(ErrorResponse {
                        error: "Missing CSRF token header".to_string(),
                    }),
                )
            })?;

        let jar = CookieJar::from_headers(&parts.headers);
        let cookie = jar.get(CSRF_COOKIE_NAME).ok_or_else(|| {
            (
                StatusCode::FORBIDDEN,
                Json(ErrorResponse {
                    error: "Missing CSRF cookie".to_string(),
                }),
            )
        })?;

        if cookie.value() != header_value {
            return Err((
                StatusCode::FORBIDDEN,
                Json(ErrorResponse {
                    error: "CSRF token mismatch".to_string(),
                }),
            ));
        }

        validate_csrf_token(header_value, &claims.sub)
            .map_err(|err| (StatusCode::FORBIDDEN, Json(ErrorResponse { error: err })))?;

        Ok(Self)
    }
}

/// Returns the name of the CSRF cookie.
pub fn csrf_cookie_name() -> &'static str {
    CSRF_COOKIE_NAME
}

/// Returns the name of the CSRF header.
pub fn csrf_header_name() -> &'static str {
    CSRF_HEADER_NAME
}
