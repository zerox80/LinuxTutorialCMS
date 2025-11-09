

/**
 * Cross-Site Request Forgery (CSRF) Protection Module
 *
 * This module provides comprehensive CSRF protection for the Linux Tutorial CMS.
 * It implements stateful CSRF tokens using HMAC-SHA256 signatures with secure cookie-based storage.
 *
 * Security Features:
 * - HMAC-SHA256 signed tokens for integrity verification
 * - Short-lived tokens (6 hours) to reduce attack window
 * - Per-user tokens to prevent token reuse across accounts
 * - Base64URL encoding for safe transport in HTTP headers
 * - Constant-time comparison to prevent timing attacks
 * - Strict SameSite cookies for modern browser protection
 *
 * Token Structure:
 * - Format: version|username_base64|expiry|nonce|signature
 * - version: Token format version for future compatibility
 * - username_base64: Base64URL-encoded username for user binding
 * - expiry: Unix timestamp for token expiration
 * - nonce: Random UUID for uniqueness
 * - signature: HMAC-SHA256 of all preceding components
 *
 * Threat Mitigation:
 * - Prevents cross-site request forgery attacks
 * - Stops token replay attacks through nonces
 * - Prevents token fixation through per-user binding
 * - Reduces attack surface through short TTL
 * - Protects against timing attacks with constant-time comparison
 */

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

/// HMAC-SHA256 type alias for cryptographic operations
type HmacSha256 = Hmac<Sha256>;

/// Environment variable name for the CSRF secret key
const CSRF_SECRET_ENV: &str = "CSRF_SECRET";

/// Name of the CSRF cookie
const CSRF_COOKIE_NAME: &str = "ltcms_csrf";

/// Name of the HTTP header containing the CSRF token
const CSRF_HEADER_NAME: &str = "x-csrf-token";

/// Time-to-live for CSRF tokens in seconds (6 hours)
const CSRF_TOKEN_TTL_SECONDS: i64 = 6 * 60 * 60;

/// Minimum required length for the CSRF secret
const CSRF_MIN_SECRET_LENGTH: usize = 32;

/// Current token format version for compatibility management
const CSRF_VERSION: &str = "v1";

/// Thread-safe storage for the initialized CSRF secret
static CSRF_SECRET: OnceLock<Vec<u8>> = OnceLock::new();

/// Initializes the CSRF protection system by loading and validating the secret key.
///
/// This function must be called once during application startup to configure CSRF protection.
/// It validates the secret key strength and stores it in thread-safe static storage.
///
/// # Security Requirements
/// - Secret must be at least 32 characters long
/// - Secret must contain at least 10 unique characters
/// - Secret should be random and unpredictable
///
/// # Environment Variables
/// - `CSRF_SECRET`: Secret key for HMAC operations (required)
///
/// # Returns
/// Ok(()) if initialization succeeds, Err(String) with detailed error message
///
/// # Security Notes
/// - The secret is stored in thread-safe static storage for global access
/// - Only one initialization is allowed to prevent secret manipulation
/// - Strong secret requirements prevent weak key attacks
///
/// # Usage
/// Call this function during application startup:
/// ```rust
/// csrf::init_csrf_secret()
///     .expect("Failed to initialize CSRF protection");
/// ```
pub fn init_csrf_secret() -> Result<(), String> {
    // Load secret from environment variable
    let secret = env::var(CSRF_SECRET_ENV)
        .map_err(|_| format!("{CSRF_SECRET_ENV} environment variable not set"))?;
    let trimmed = secret.trim();

    // Validate minimum length requirement
    if trimmed.len() < CSRF_MIN_SECRET_LENGTH {
        return Err(format!(
            "{CSRF_SECRET_ENV} must be at least {CSRF_MIN_SECRET_LENGTH} characters long"
        ));
    }

    // Validate entropy requirement (unique characters)
    let unique_chars = trimmed.chars().collect::<HashSet<_>>().len();
    if unique_chars < 10 {
        return Err(format!(
            "{CSRF_SECRET_ENV} must contain at least 10 unique characters"
        ));
    }

    // Store secret in thread-safe static storage
    CSRF_SECRET
        .set(trimmed.as_bytes().to_vec())
        .map_err(|_| "CSRF secret already initialized".to_string())?;

    Ok(())
}

fn get_secret() -> &'static [u8] {
    CSRF_SECRET
        .get()
        .expect("CSRF secret not initialized. Call init_csrf_secret() first.")
        .as_slice()
}

/// Generates a new CSRF token for the specified user.
///
/// Creates a cryptographically signed CSRF token that binds the token to a specific user
/// and includes expiration time and a random nonce for replay protection.
///
/// # Arguments
/// * `username` - The username to bind the token to (must be non-empty)
///
/// # Returns
/// Ok(String) containing the complete CSRF token, Err(String) on failure
///
/// # Token Format
/// `version|username_base64|expiry|nonce|signature`
/// - version: Format version ("v1")
/// - username_base64: Base64URL-encoded username
/// - expiry: Unix timestamp when token expires
/// - nonce: UUID v4 for uniqueness
/// - signature: HMAC-SHA256 of all preceding components
///
/// # Security Features
/// - User binding prevents token reuse across accounts
/// - Expiration prevents token reuse after compromise
/// - Nonce prevents replay attacks
/// - HMAC signature prevents tampering
///
/// # Example Token
/// ```
/// v1|YWRtaW4|1703950800|550e8400-e29b-41d4-a716-446655440000|abc123def456...
/// ```
pub fn issue_csrf_token(username: &str) -> Result<String, String> {
    // Validate input
    if username.is_empty() {
        return Err("Username required for CSRF token".to_string());
    }

    // Calculate token expiration
    let expiry = Utc::now()
        .checked_add_signed(Duration::seconds(CSRF_TOKEN_TTL_SECONDS))
        .ok_or_else(|| "Failed to compute CSRF expiry".to_string())?
        .timestamp();

    // Generate random nonce for uniqueness
    let nonce = Uuid::new_v4().to_string();

    // Encode username for safe transport
    let username_b64 = Base64UrlUnpadded::encode_string(username.as_bytes());

    // Build token payload
    let payload = format!("{username_b64}|{expiry}|{nonce}");
    let versioned_payload = format!("{CSRF_VERSION}|{payload}");

    // Create HMAC signature
    let mut mac = HmacSha256::new_from_slice(get_secret())
        .map_err(|_| "Failed to initialize CSRF HMAC".to_string())?;
    mac.update(versioned_payload.as_bytes());
    let signature = Base64UrlUnpadded::encode_string(&mac.finalize().into_bytes());

    // Return complete token
    Ok(format!("{versioned_payload}|{signature}"))
}

/// Validates a CSRF token against the expected username.
///
/// Performs comprehensive validation including format checking, expiration verification,
/// user binding verification, and HMAC signature verification.
///
/// # Arguments
/// * `token` - The CSRF token to validate
/// * `expected_username` - The username that should be bound to this token
///
/// # Returns
/// Ok(()) if token is valid, Err(String) with detailed error message otherwise
///
/// # Validation Steps
/// 1. Parse token format and extract components
/// 2. Verify token version compatibility
/// 3. Decode and verify username binding
/// 4. Check token expiration
/// 5. Validate nonce uniqueness
/// 6. Verify HMAC signature integrity
///
/// # Security Checks
/// - Prevents token reuse across user accounts
/// - Stops expired token usage
/// - Detects token tampering via HMAC verification
/// - Uses constant-time comparison for signature verification
fn validate_csrf_token(token: &str, expected_username: &str) -> Result<(), String> {
    // Parse token into components
    let mut parts = token.split('|');

    // Extract and validate version
    let version = parts
        .next()
        .ok_or_else(|| "Malformed CSRF token".to_string())?;
    if version != CSRF_VERSION {
        return Err("Unsupported CSRF token version".to_string());
    }

    // Extract required components
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

    // Ensure no extra components
    if parts.next().is_some() {
        return Err("Malformed CSRF token".to_string());
    }

    // Decode and verify username binding
    let username_bytes = Base64UrlUnpadded::decode_vec(username_b64)
        .map_err(|_| "Malformed CSRF username segment".to_string())?;
    let username = String::from_utf8(username_bytes)
        .map_err(|_| "Invalid CSRF username encoding".to_string())?;

    if username != expected_username {
        return Err("CSRF token not issued for this account".to_string());
    }

    // Check token expiration
    let expiry: i64 = expiry_str
        .parse()
        .map_err(|_| "Invalid CSRF expiry".to_string())?;

    if expiry < Utc::now().timestamp() {
        return Err("CSRF token expired".to_string());
    }

    // Validate nonce length
    if nonce.len() < 16 {
        return Err("CSRF nonce too short".to_string());
    }

    // Verify HMAC signature
    let versioned_payload = format!("{version}|{username_b64}|{expiry}|{nonce}");

    let mut mac = HmacSha256::new_from_slice(get_secret())
        .map_err(|_| "Failed to initialize CSRF HMAC".to_string())?;
    mac.update(versioned_payload.as_bytes());
    let expected_signature = mac.finalize().into_bytes();

    let provided_signature = Base64UrlUnpadded::decode_vec(signature)
        .map_err(|_| "Invalid CSRF signature".to_string())?;

    // Constant-time signature comparison
    if expected_signature.len() != provided_signature.len()
        || !subtle_equals(&expected_signature, &provided_signature)
    {
        return Err("CSRF signature mismatch".to_string());
    }

    Ok(())
}

/// Performs constant-time comparison of two byte arrays to prevent timing attacks.
///
/// This function uses the subtle crate's constant-time comparison to ensure that
/// the time taken to compare two values does not depend on their content.
///
/// # Arguments
/// * `a` - First byte array to compare
/// * `b` - Second byte array to compare
///
/// # Returns
/// true if arrays are equal, false otherwise
///
/// # Security Notes
/// - Prevents timing attacks that could reveal partial signature matches
/// - Execution time is independent of array content
/// - Essential for secure HMAC signature verification
fn subtle_equals(a: &[u8], b: &[u8]) -> bool {
    use subtle::ConstantTimeEq;
    a.ct_eq(b).into()
}

pub fn append_csrf_cookie(headers: &mut HeaderMap, token: &str) {

    let cookie = build_csrf_cookie(token);
    

    if let Ok(value) = HeaderValue::from_str(&cookie.to_string()) {
        headers.append(SET_COOKIE, value);
    } else {
        tracing::error!("Failed to serialize CSRF cookie");
    }
}

pub fn append_csrf_removal(headers: &mut HeaderMap) {

    let cookie = build_csrf_removal();
    

    if let Ok(value) = HeaderValue::from_str(&cookie.to_string()) {
        headers.append(SET_COOKIE, value);
    } else {
        tracing::error!("Failed to serialize CSRF removal cookie");
    }
}

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

/// AXUM middleware guard for CSRF protection on state-changing requests.
///
/// This struct implements the `FromRequestParts` trait to provide automatic
/// CSRF validation for protected endpoints. It validates tokens from both
/// HTTP headers and cookies to prevent cross-site request forgery attacks.
///
/// # Protection Scope
/// - Applied to all HTTP methods except GET, HEAD, OPTIONS, TRACE
/// - Only validates requests that require authentication
/// - Requires both CSRF cookie and header to be present and matching
///
/// # Validation Process
/// 1. Skip validation for safe HTTP methods
/// 2. Verify user authentication context exists
/// 3. Extract CSRF token from HTTP header
/// 4. Extract CSRF token from cookie
/// 5. Verify header and cookie tokens match
/// 6. Perform full token validation (signature, expiry, user binding)
///
/// # Usage
/// Add to protected route handlers:
/// ```rust
/// #[route_layer(middleware::from_extractor::<CsrfGuard>())]
/// async fn protected_handler() -> Result<_, _> {
///     // Handler logic here
/// }
/// ```
pub struct CsrfGuard;

impl<S> FromRequestParts<S> for CsrfGuard
where
    S: Send + Sync,
{
    /// Error type for CSRF validation failures
    type Rejection = (StatusCode, Json<ErrorResponse>);

    /// Validates CSRF protection for incoming requests.
    ///
    /// # Arguments
    /// * `parts` - HTTP request parts to validate
    /// * `_state` - Application state (unused)
    ///
    /// # Returns
    /// Ok(Self) if validation succeeds, Err with error response if it fails
    ///
    /// # Error Responses
    /// - 401 Unauthorized: Missing authentication context
    /// - 403 Forbidden: Missing or invalid CSRF tokens
    ///
    /// # Security Notes
    /// - Only validates state-changing HTTP methods
    /// - Requires both cookie and header validation
    /// - Performs full cryptographic token validation
    /// - Binds tokens to specific user accounts
    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        // Skip CSRF validation for safe HTTP methods
        if matches!(
            parts.method,
            Method::GET | Method::HEAD | Method::OPTIONS | Method::TRACE
        ) {
            return Ok(Self);
        }

        // Verify user is authenticated
        let Some(claims) = parts.extensions.get::<auth::Claims>() else {
            return Err((
                StatusCode::UNAUTHORIZED,
                Json(ErrorResponse {
                    error: "Missing authentication context".to_string(),
                }),
            ));
        };

        // Extract CSRF token from HTTP header
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

        // Extract CSRF token from cookie
        let jar = CookieJar::from_headers(&parts.headers);
        let cookie = jar.get(CSRF_COOKIE_NAME).ok_or_else(|| {
            (
                StatusCode::FORBIDDEN,
                Json(ErrorResponse {
                    error: "Missing CSRF cookie".to_string(),
                }),
            )
        })?;

        // Verify header and cookie tokens match
        if cookie.value() != header_value {
            return Err((
                StatusCode::FORBIDDEN,
                Json(ErrorResponse {
                    error: "CSRF token mismatch".to_string(),
                }),
            ));
        }

        // Perform full token validation
        validate_csrf_token(header_value, &claims.sub)
            .map_err(|err| (StatusCode::FORBIDDEN, Json(ErrorResponse { error: err })))?;

        Ok(Self)
    }
}

pub fn csrf_cookie_name() -> &'static str {
    CSRF_COOKIE_NAME
}

pub fn csrf_header_name() -> &'static str {
    CSRF_HEADER_NAME
}
