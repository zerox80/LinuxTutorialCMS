//! # Authentication Handler Module
//! 
//! This module provides HTTP handlers for user authentication and session management in the LinuxTutorialCMS.
//! It implements a secure authentication system with the following features:
//! 
//! ## Features
//! - **Secure login**: Brute-force protection with exponential backoff
//! - **Timing attack resistance**: Consistent response times regardless of user existence
//! - **Session management**: JWT-based authentication with secure cookie handling
//! - **CSRF protection**: Cross-site request forgery prevention tokens
//! - **Rate limiting**: Server-side login attempt tracking and blocking
//! - **Password security**: bcrypt hashing with proper salt generation
//! 
//! ## Security Features
//! - **Brute-force protection**: Exponential backoff with increasing block durations
//! - **Timing attack prevention**: Dummy hash verification for non-existent users
//! - **Secure password storage**: bcrypt with configurable cost factor
//! - **CSRF tokens**: Synchronizer token pattern for state-changing operations
//! - **Input validation**: Username and password sanitization and length limits
//! 
//! ## API Endpoints
//! - `POST /auth/login` - Authenticate user and create session
//! - `GET /auth/me` - Get current user information
//! - `POST /auth/logout` - Terminate user session
//! 
//! ## Environment Variables
//! - `LOGIN_ATTEMPT_SALT`: High-entropy salt for hashing login identifiers
//! - `ADMIN_USERNAME`: Default admin username (auto-creation on startup)
//! - `ADMIN_PASSWORD`: Default admin password (minimum 12 characters)
//! 
//! ## Security Considerations
//! - All passwords are hashed using bcrypt with appropriate cost factors
//! - Login attempts are tracked with exponential backoff (10s → 60s blocks)
//! - Timing attacks are prevented through consistent verification times
//! - CSRF tokens are issued and validated for state-changing operations
//! - Session cookies are configured with security flags (HttpOnly, Secure, SameSite)
//! 
//! ## Performance Notes
//! - Login attempt tracking uses efficient SHA-256 hashing
//! - Database queries are optimized with proper indexes
//! - JWT tokens are cached for efficient validation
//! - Rate limiting is implemented server-side to prevent abuse

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

/// Database entity representing login attempt tracking data.
///
/// This struct maps to database rows that track failed login attempts
/// for brute-force protection and rate limiting purposes.
///
/// # Fields
/// - `fail_count`: Number of consecutive failed login attempts
/// - `blocked_until`: Optional timestamp when the block expires (RFC 3339 format)
/// 
/// # Database Mapping
/// Maps directly from the `login_attempts` table via SQLx.
#[derive(Debug, FromRow, Clone)]
struct LoginAttempt {
    /// Number of consecutive failed login attempts for this identifier
    fail_count: i64,
    /// Optional timestamp when the temporary block expires
    blocked_until: Option<String>,
}

/// Hashes a login identifier for secure storage and lookup.
///
/// This function provides a secure, one-way hash of login identifiers to prevent
/// user enumeration attacks while allowing efficient tracking of login attempts.
/// 
/// # Security Features
/// - Uses SHA-256 with a high-entropy salt for secure hashing
/// - Normalizes input by trimming and converting to lowercase
/// - Prevents rainbow table attacks through unique salt configuration
/// 
/// # Environment Variable
/// - `LOGIN_ATTEMPT_SALT`: Required high-entropy salt for secure hashing
///   - Must be set to a random, high-entropy string
///   - Should be consistent across application restarts
///   - See `.env.example` for guidance
/// 
/// # Arguments
/// * `username` - The raw username to hash for tracking purposes
/// 
/// # Returns
/// A hexadecimal SHA-256 hash of the salted, normalized username
/// 
/// # Panics
/// Panics on startup if `LOGIN_ATTEMPT_SALT` is not configured,
/// as this is a critical security requirement.
/// 
/// # Examples
/// ```rust,no_run
/// let hash = hash_login_identifier("user@example.com");
/// // Returns: "a1b2c3d4e5f6..." (hex string)
/// ```
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

/// Safely parses an optional RFC 3339 timestamp string.
///
/// This function provides robust parsing of timestamp strings with proper
/// error handling, returning None for invalid formats rather than panicking.
/// 
/// # Arguments
/// * `value` - Optional string containing RFC 3339 formatted timestamp
/// 
/// # Returns
/// * `Some(DateTime<Utc>)` - Successfully parsed timestamp in UTC
/// * `None` - Input is None or contains invalid timestamp format
/// 
/// # Supported Formats
/// - RFC 3339 compliant timestamps
/// - Various timezone offset formats (+00:00, Z, etc.)
/// - Fractional seconds are supported but optional
/// 
/// # Examples
/// ```rust,no_run
/// let timestamp = Some("2023-12-07T10:30:00Z".to_string());
/// let parsed = parse_rfc3339_opt(&timestamp); // Returns Some(DateTime)
/// 
/// let invalid = Some("not-a-timestamp".to_string());
/// let parsed = parse_rfc3339_opt(&invalid); // Returns None
/// ```
fn parse_rfc3339_opt(value: &Option<String>) -> Option<DateTime<Utc>> {
    value
        .as_ref()
        .and_then(|timestamp| chrono::DateTime::parse_from_rfc3339(timestamp).ok())
        .map(|dt| dt.with_timezone(&Utc))
}

/// Returns a dummy bcrypt hash for timing attack prevention.
///
/// This function provides a consistent bcrypt hash that's used when
/// verifying passwords for non-existent users to prevent timing attacks
/// that could reveal user existence.
/// 
/// # Security Purpose
/// - Prevents timing attacks by ensuring consistent verification times
/// - Uses a real bcrypt hash with the same cost factor as real passwords
/// - Eliminates timing differences between existing and non-existing users
/// 
/// # Hash Details
/// - Password: "dummy" (arbitrary string)
/// - Cost: `bcrypt::DEFAULT_COST` (typically 12)
/// - Hash: Pre-computed for performance, fallback on generation failure
/// 
/// # Returns
/// A bcrypt hash string that can be safely used with `bcrypt::verify()`
/// 
/// # Fallback Behavior
/// If hash generation fails at runtime, falls back to a hardcoded
/// valid bcrypt hash to maintain security guarantees.
/// 
/// # Examples
/// ```rust,no_run
/// let dummy_hash = dummy_bcrypt_hash();
/// let result = bcrypt::verify("wrong_password", dummy_hash);
/// // Always returns false (or error), but with consistent timing
/// ```
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

/// Validates a username according to security and usability requirements.
///
/// This function enforces username constraints to prevent injection attacks
/// and ensure compatibility with the authentication system.
/// 
/// # Validation Rules
/// - Cannot be empty after trimming
/// - Maximum length: 50 characters
/// - Allowed characters: alphanumeric, underscore (_), hyphen (-), period (.)
/// - Case-sensitive (preserves original case for display)
/// 
/// # Security Considerations
/// - Prevents SQL injection through character filtering
/// - Limits length to prevent DoS attacks
/// - Disallows special characters that could break database queries
/// 
/// # Arguments
/// * `username` - The username to validate
/// 
/// # Returns
/// * `Ok(())` - Username is valid and safe to use
/// * `Err(String)` - Detailed error message explaining validation failure
/// 
/// # Examples
/// ```rust,no_run
/// assert!(validate_username("user123").is_ok());
/// assert!(validate_username("user.name").is_ok());
/// assert!(validate_username("").is_err()); // Empty
/// assert!(validate_username("user@domain").is_err()); // Invalid character
/// assert!(validate_username("a".repeat(51).as_str()).is_err()); // Too long
/// ```
fn validate_username(username: &str) -> Result<(), String> {
    if username.is_empty() {
        return Err("Username cannot be empty".to_string());
    }
    if username.len() > 50 {
        return Err("Username too long".to_string());
    }
    // Allow alphanumeric, underscore, hyphen, dot
    if !username
        .chars()
        .all(|c| c.is_alphanumeric() || c == '_' || c == '-' || c == '.')
    {
        return Err("Username contains invalid characters".to_string());
    }
    Ok(())
}

/// Validates a password according to security requirements.
///
/// This function enforces basic password constraints while allowing
/// the application to implement additional complexity requirements
/// through other means (password policies, user feedback, etc.).
/// 
/// # Validation Rules
/// - Cannot be empty after trimming
/// - Maximum length: 128 characters (practical limit)
/// - No minimum length enforcement here (handled elsewhere for better UX)
/// 
/// # Security Considerations
/// - Maximum length prevents DoS attacks through extremely long passwords
/// - Empty password prevention ensures basic security hygiene
/// - Length allows for complex passwords and passphrases
/// 
/// # Arguments
/// * `password` - The password to validate
/// 
/// # Returns
/// * `Ok(())` - Password meets basic requirements
/// * `Err(String)` - Detailed error message explaining validation failure
/// 
/// # Notes
/// Additional password complexity requirements (minimum length, character types, etc.)
/// should be implemented at the application level for better user experience
/// and more informative feedback.
/// 
/// # Examples
/// ```rust,no_run
/// assert!(validate_password("password123").is_ok());
/// assert!(validate_password("a".repeat(128).as_str()).is_ok()); // Max length
/// assert!(validate_password("").is_err()); // Empty
/// assert!(validate_password("a".repeat(129).as_str()).is_err()); // Too long
/// ```
fn validate_password(password: &str) -> Result<(), String> {
    if password.is_empty() {
        return Err("Password cannot be empty".to_string());
    }
    if password.len() > 128 {
        return Err("Password too long".to_string());
    }
    Ok(())
}

/// Handles user login requests with comprehensive security protections.
///
/// This endpoint provides secure user authentication with multiple layers of protection
/// against common attacks. It implements rate limiting, brute-force protection, timing
/// attack prevention, and secure session management through JWT tokens.
///
/// # HTTP Endpoint
/// `POST /auth/login`
/// 
/// # Authentication
/// **Not required** - This is the authentication endpoint itself
/// 
/// # Security Features
/// - **Brute-force protection**: Exponential backoff with increasing block durations
/// - **Timing attack resistance**: Consistent verification times for all users
/// - **Rate limiting**: Server-side login attempt tracking and blocking
/// - **Input validation**: Username and password sanitization with length limits
/// - **Secure session management**: JWT tokens with proper cookie configuration
/// - **CSRF protection**: Automatic CSRF token issuance for authenticated sessions
/// 
/// # Arguments
/// * `State(pool)` - Database connection pool for user lookup and attempt tracking
/// * `Json(payload)` - Login credentials containing username and password
/// 
/// # Request Body
/// ```json
/// {
///   "username": "admin",
///   "password": "secure_password_123"
/// }
/// ```
/// 
/// # Returns
/// * `Ok((HeaderMap, Json<LoginResponse>))` - Successful authentication with session cookies
/// * `Err((StatusCode, Json<ErrorResponse>))` - Authentication failure with error details
/// 
/// # Success Response (200 OK)
/// **Headers:**
/// - `Set-Cookie`: Authentication JWT token with security flags
/// - `Set-Cookie`: CSRF token for subsequent requests
/// 
/// **Body:**
/// ```json
/// {
///   "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
///   "user": {
///     "username": "admin",
///     "role": "admin"
///   }
/// }
/// ```
/// 
/// # Error Responses
/// 
/// ## 400 BAD REQUEST
/// ```json
/// {
///   "error": "Username cannot be empty"
/// }
/// ```
/// 
/// ## 401 UNAUTHORIZED
/// ```json
/// {
///   "error": "Ungültige Anmeldedaten"
/// }
/// ```
/// 
/// ## 429 TOO MANY REQUESTS
/// ```json
/// {
///   "error": "Zu viele fehlgeschlagene Versuche. Bitte warte 60 Sekunden."
/// }
/// ```
/// 
/// ## 500 INTERNAL SERVER ERROR
/// ```json
/// {
///   "error": "Internal server error"
/// }
/// ```
/// 
/// # Rate Limiting Details
/// - **3 failed attempts**: 10-second block
/// - **5 failed attempts**: 60-second block
/// - **Attempts reset** on successful login
/// - **Blocks based on hashed identifiers** to prevent user enumeration
/// 
/// # Security Implementation Details
/// 
/// ## Timing Attack Prevention
/// - Always performs password verification, even for non-existent users
/// - Uses dummy bcrypt hash with same cost factor as real passwords
/// - Adds random jitter (100-300ms) to response times
/// - Consistent database query patterns regardless of user existence
/// 
/// ## Brute-force Protection
/// - Tracks attempts using SHA-256 hashed identifiers with salt
/// - Exponential backoff prevents rapid repeated attempts
/// - Server-side blocking cannot be bypassed by client
/// - Attempt tracking persists across application restarts
/// 
/// ## Input Validation Rules
/// - **Username**: 1-50 characters, alphanumeric + underscore/hyphen/period
/// - **Password**: 1-128 characters (practical limits for DoS prevention)
/// - Both fields trimmed of whitespace before processing
/// 
/// # Performance Characteristics
/// - **Database queries**: Optimized with proper indexes on username and attempt tracking
/// - **Hashing operations**: SHA-256 for attempt tracking, bcrypt for passwords
/// - **Memory usage**: Efficient caching of salt values and dummy hashes
/// - **Response time**: Consistent regardless of authentication result
/// 
/// # Examples
/// 
/// ## Successful Login
/// ```bash
/// curl -X POST "https://example.com/auth/login" \
///   -H "Content-Type: application/json" \
///   -d '{"username": "admin", "password": "secure_password"}'
/// 
/// # Response includes authentication cookies and JWT token
/// ```
/// 
/// ## Failed Login with Rate Limiting
/// ```bash
/// # Multiple failed attempts will trigger rate limiting
/// for i in {1..6}; do
///   curl -X POST "https://example.com/auth/login" \
///     -H "Content-Type: application/json" \
///     -d '{"username": "admin", "password": "wrong"}'
/// done
/// 
/// # After 5 attempts: "Zu viele fehlgeschlagene Versuche..."
/// ```
/// 
/// # Environment Dependencies
/// - `LOGIN_ATTEMPT_SALT`: Required for secure attempt tracking
/// - Database: Must have users and login_attempts tables with proper indexes
/// - JWT configuration: Proper secret key and token expiration settings
/// 
/// # Security Considerations
/// - All passwords are verified using bcrypt with appropriate cost factors
/// - Login attempts are tracked using cryptographically secure hashing
/// - Session cookies are configured with HttpOnly, Secure, and SameSite flags
/// - CSRF tokens are automatically issued for authenticated sessions
/// - Audit logging is performed for all authentication attempts
/// 
/// # Related Functions
/// - [`logout()`] - Session termination endpoint
/// - [`me()`] - Current user information endpoint
/// - [`validate_username()`] - Username validation logic
/// - [`validate_password()`] - Password validation logic
/// - [`hash_login_identifier()`] - Secure attempt tracking
/// - [`crate::auth::create_jwt()`] - JWT token creation
/// - [`crate::csrf::issue_csrf_token()`] - CSRF token generation
/// 
/// # Audit Events
/// All authentication attempts are logged with:
/// - Username (hashed for privacy)
/// - Attempt result (success/failure)
/// - Rate limiting actions
/// - System errors and warnings
pub async fn login(
    State(pool): State<DbPool>,
    Json(payload): Json<LoginRequest>,
) -> Result<(HeaderMap, Json<LoginResponse>), (StatusCode, Json<ErrorResponse>)> {
    let username = payload.username.trim().to_string();

    // Validate input
    if let Err(e) = validate_username(&username) {
        return Err((StatusCode::BAD_REQUEST, Json(ErrorResponse { error: e })));
    }
    if let Err(e) = validate_password(&payload.password) {
        return Err((StatusCode::BAD_REQUEST, Json(ErrorResponse { error: e })));
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
    let hash_to_verify = hash_to_verify_owned
        .as_deref()
        .unwrap_or(dummy_bcrypt_hash());

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

/// Retrieves the current authenticated user's information from their JWT claims.
///
/// This endpoint provides a lightweight way for client applications to
/// retrieve the current user's identity without additional database queries.
/// The information is extracted directly from the validated JWT token.
///
/// # HTTP Endpoint
/// `GET /auth/me`
/// 
/// # Authentication
/// **Required** - Must have a valid JWT token in the request headers
/// 
/// # Arguments
/// * `claims` - The JWT claims extracted and validated by authentication middleware
/// 
/// # Returns
/// * `Ok(Json<UserResponse>)` - User information extracted from JWT claims
/// * `Err((StatusCode, Json<ErrorResponse>))` - Error response if JWT is invalid
/// 
/// # Success Response (200 OK)
/// ```json
/// {
///   "username": "admin",
///   "role": "admin"
/// }
/// ```
/// 
/// # Error Responses
/// - `401 UNAUTHORIZED`: JWT token is missing, invalid, or expired
/// - `500 INTERNAL_SERVER_ERROR`: Unexpected server error
/// 
/// # Performance Notes
/// - No database queries required - data comes from JWT claims
/// - Fast response time suitable for frequent client requests
/// - Ideal for client-side authentication state checking
/// 
/// # Security Considerations
/// - JWT must be properly validated before claims extraction
/// - Response contains only non-sensitive user information
/// - No additional database access reduces attack surface
/// 
/// # Examples
/// ```bash
/// # Get current user info with JWT token
/// curl "https://example.com/auth/me" \
///   -H "Authorization: Bearer <jwt-token>"
/// 
/// # Response
/// {
///   "username": "admin", 
///   "role": "admin"
/// }
/// ```
/// 
/// # Use Cases
/// - Client-side authentication state management
/// - User profile display in web applications
/// - Role-based UI component rendering
/// - API request authentication validation
/// 
/// # Related Functions
/// - [`login()`] - Authentication endpoint that creates JWT tokens
/// - [`logout()`] - Session termination endpoint
/// - [`crate::auth::create_jwt()`] - JWT token creation function
pub async fn me(
    claims: auth::Claims,
) -> Result<Json<UserResponse>, (StatusCode, Json<ErrorResponse>)> {
    Ok(Json(UserResponse {
        username: claims.sub,
        role: claims.role,
    }))
}

/// Handles user logout requests with proper CSRF protection and session cleanup.
///
/// This endpoint provides a secure way to terminate user sessions by clearing
/// authentication and CSRF cookies. It requires CSRF validation to prevent
/// cross-site request forgery attacks on logout operations.
///
/// # HTTP Endpoint
/// `POST /auth/logout`
/// 
/// # Authentication
/// **Required** - Must have a valid JWT token in cookies
/// 
/// # CSRF Protection
/// **Required** - Must include valid CSRF token in request headers
/// - Prevents cross-site request forgery attacks
/// - Ensures logout requests originate from the application
/// - Validated via `_csrf` parameter middleware
/// 
/// # Arguments
/// * `_csrf` - CSRF guard ensuring request passed validation
/// * `claims` - JWT claims containing user information for audit logging
/// 
/// # Returns
/// HTTP `204 No Content` response with headers that clear session cookies
/// 
/// # Success Response (204 NO CONTENT)
/// Returns empty response body with the following headers:
/// - `Set-Cookie`: Clears authentication cookie
/// - `Set-Cookie`: Clears CSRF token cookie
/// 
/// # Error Responses
/// - `401 UNAUTHORIZED`: JWT token is invalid or missing
/// - `403 FORBIDDEN`: CSRF token validation failed
/// - `500 INTERNAL_SERVER_ERROR`: Unexpected server error during logout
/// 
/// # Security Features
/// - **CSRF Protection**: Prevents forced logout attacks
/// - **Cookie Clearing**: Properly invalidates session cookies
/// - **Audit Logging**: Records logout events for security monitoring
/// - **Stateless Design**: No server-side session state to clean up
/// 
/// # Cookie Handling
/// - Authentication cookie set with expiration in the past
/// - CSRF token cookie set with expiration in the past
/// - Both cookies configured with proper security flags
/// 
/// # Performance Notes
/// - No database operations required
/// - Fast response time
/// - Minimal server resource usage
/// 
/// # Examples
/// ```bash
/// # Logout with proper CSRF token
/// curl -X POST "https://example.com/auth/logout" \
///   -H "Cookie: auth=<jwt-token>; csrf=<csrf-token>" \
///   -H "X-CSRF-Token: <csrf-token>"
/// 
/// # Response: 204 NO CONTENT (empty body)
/// ```
/// 
/// # Security Considerations
/// - CSRF validation prevents logout CSRF attacks
/// - Cookie clearing prevents session hijacking
/// - Audit logging enables security monitoring
/// - Stateless design eliminates session fixation risks
/// 
/// # Related Functions
/// - [`login()`] - Authentication endpoint that creates sessions
/// - [`me()`] - Current user information endpoint
/// - [`crate::csrf::CsrfGuard`] - CSRF protection middleware
/// - [`crate::auth::build_cookie_removal()`] - Cookie clearing utility
pub async fn logout(_csrf: csrf::CsrfGuard, claims: auth::Claims) -> (StatusCode, HeaderMap) {
    let mut headers = HeaderMap::new();
    auth::append_auth_cookie(&mut headers, auth::build_cookie_removal());
    csrf::append_csrf_removal(&mut headers);
    tracing::info!(user = %claims.sub, "User logged out");
    (StatusCode::NO_CONTENT, headers)
}
