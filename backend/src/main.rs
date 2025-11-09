//! Main entry point for the Linux Tutorial CMS backend server.
//!
//! This module contains the main application setup including:
//! - Configuration of security headers and CORS
//! - Rate limiting and request body size limits
//! - Database connection and authentication setup
//! - Route definitions for tutorials, comments, site content, and admin functionality
//! - Graceful shutdown handling

// Core application modules
mod auth;
mod csrf;
mod db;
mod handlers;
mod models;

// Axum web framework imports
use axum::http::{
    header::{
        AUTHORIZATION, CACHE_CONTROL, CONTENT_SECURITY_POLICY, CONTENT_TYPE, EXPIRES, PRAGMA,
        STRICT_TRANSPORT_SECURITY, X_CONTENT_TYPE_OPTIONS, X_FRAME_OPTIONS,
    },
    HeaderName, HeaderValue, Method,
};
use axum::{
    extract::Request,
    middleware::{self, Next},
    response::Response,
    routing::{delete, get, post, put},
    Router,
};

// Third-party imports
use dotenv::dotenv;
use std::env;
use std::io::ErrorKind;
use std::net::SocketAddr;
use tokio::signal;
use tower_governor::key_extractor::SmartIpKeyExtractor;
use tower_governor::{governor::GovernorConfigBuilder, GovernorLayer};
use tower_http::cors::{AllowHeaders, AllowMethods, AllowOrigin, CorsLayer};
use tower_http::limit::RequestBodyLimitLayer;
use tracing_subscriber;

// Security header constants for preventing common web vulnerabilities
const PERMISSIONS_POLICY: HeaderName = HeaderName::from_static("permissions-policy");
const REFERRER_POLICY: HeaderName = HeaderName::from_static("referrer-policy");
const X_XSS_PROTECTION: HeaderName = HeaderName::from_static("x-xss-protection");

// Proxy header constants for IP extraction and header stripping
const FORWARDED_HEADER: HeaderName = HeaderName::from_static("forwarded");
const X_FORWARDED_FOR_HEADER: HeaderName = HeaderName::from_static("x-forwarded-for");
const X_FORWARDED_PROTO_HEADER: HeaderName = HeaderName::from_static("x-forwarded-proto");
const X_FORWARDED_HOST_HEADER: HeaderName = HeaderName::from_static("x-forwarded-host");
const X_REAL_IP_HEADER: HeaderName = HeaderName::from_static("x-real-ip");

/// Parses a boolean value from an environment variable.
///
/// Accepts "1", "true", "yes", or "on" as `true` (case-insensitive)
/// and "0", "false", "no", or "off" as `false`.
///
/// # Arguments
///
/// * `key` - The name of the environment variable.
/// * `default` - The default value to return if the variable is not set or invalid.
///
/// # Returns
///
/// The parsed boolean value or the default.
fn parse_env_bool(key: &str, default: bool) -> bool {
    env::var(key)
        .ok()
        .and_then(|value| {
            match value.trim().to_ascii_lowercase().as_str() {
                "1" | "true" | "yes" | "on" => Some(true),
                "0" | "false" | "no" | "off" => Some(false),
                _ => {
                    tracing::warn!(key = %key, value = %value, "Invalid boolean env value; using default");
                    None
                }
            }
        })
        .unwrap_or(default)
}

/// Middleware to remove proxy-related headers to prevent IP spoofing.
///
/// This middleware removes all X-Forwarded-* headers from incoming requests
/// when the server is not configured to trust proxy headers. This prevents
/// rate limit bypasses by preventing clients from spoofing their IP address
/// through these headers.
///
/// # Security Context
///
/// This function is critical for maintaining the integrity of rate limiting.
/// When `TRUST_PROXY_IP_HEADERS` is false, we strip these headers to ensure
/// that clients cannot inject fake IP addresses that would affect rate limiting
/// or security calculations.
///
/// # Arguments
///
/// * `request` - The incoming HTTP request to process
/// * `next` - The next middleware in the chain to call after header stripping
///
/// # Returns
///
/// The HTTP response from subsequent middleware with proxy headers removed
async fn strip_untrusted_forwarded_headers(mut request: Request, next: Next) -> Response {
    {
        let headers = request.headers_mut();
        // Remove all proxy-related headers that could be used for IP spoofing
        headers.remove(FORWARDED_HEADER);
        headers.remove(X_FORWARDED_FOR_HEADER);
        headers.remove(X_FORWARDED_PROTO_HEADER);
        headers.remove(X_FORWARDED_HOST_HEADER);
        headers.remove(X_REAL_IP_HEADER);
    }

    next.run(request).await
}

/// Middleware to apply comprehensive security headers to every HTTP response.
///
/// This middleware implements defense-in-depth security by setting multiple
/// security headers including CSP, HSTS, X-Frame-Options, and others.
/// It also handles cache control headers appropriately for different route types.
///
/// # Security Features
///
/// - **Content Security Policy (CSP)**: Prevents XSS and injection attacks
/// - **HTTP Strict Transport Security (HSTS)**: Enforces HTTPS connections
/// - **X-Frame-Options**: Prevents clickjacking attacks
/// - **X-Content-Type-Options**: Prevents MIME sniffing attacks
/// - **Referrer Policy**: Controls referrer information leakage
/// - **Cache Control**: Appropriate caching for static vs dynamic content
///
/// # Environment-Specific Behavior
///
/// - **Development**: Allows WebSocket connections for Vite HMR and inline styles
/// - **Production**: Strict CSP with no inline content, HTTPS upgrade enforcement
///
/// # Arguments
///
/// * `request` - The incoming HTTP request to process
/// * `next` - The next middleware in the chain to call after security processing
///
/// # Returns
///
/// The HTTP response with comprehensive security headers applied
async fn security_headers(request: Request, next: Next) -> Response {
    use axum::http::Method;

    let method = request.method().clone();
    let path = request.uri().path().to_string();

    // Check if request is HTTPS before processing HSTS headers
    let is_https = request
        .headers()
        .get("x-forwarded-proto")
        .and_then(|v| v.to_str().ok())
        .map(|v| v == "https")
        .unwrap_or(false);

    let mut response = next.run(request).await;
    let headers = response.headers_mut();

    // Determine if this response should be cached based on method and path
    let cacheable = method == Method::GET
        && (path == "/api/tutorials"
            || path.starts_with("/api/tutorials/")
            || path.starts_with("/api/public/"));

    // Apply appropriate cache control headers
    if cacheable {
        // Cache for 5 minutes with 1 minute stale-while-revalidate
        headers.insert(
            CACHE_CONTROL,
            HeaderValue::from_static("public, max-age=300, stale-while-revalidate=60"),
        );
        headers.remove(PRAGMA);
        headers.remove(EXPIRES);
    } else {
        // No caching for dynamic/authenticated content
        headers.insert(
            CACHE_CONTROL,
            HeaderValue::from_static("no-store, no-cache, must-revalidate"),
        );
        headers.insert(PRAGMA, HeaderValue::from_static("no-cache"));
        headers.insert(EXPIRES, HeaderValue::from_static("0"));
    }

    // Content Security Policy - Environment-dependent configuration
    let csp = if cfg!(debug_assertions) {
        // Development mode: Allow WebSocket connections for Vite Hot Module Replacement
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';"
    } else {
        // Production mode: Strict CSP with no inline content allowed
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;"
    };

    headers.insert(CONTENT_SECURITY_POLICY, HeaderValue::from_static(csp));

    // HSTS - Only set if request came via HTTPS to prevent HTTPS downgrade attacks
    if is_https {
        headers.insert(
            STRICT_TRANSPORT_SECURITY,
            HeaderValue::from_static("max-age=31536000; includeSubDomains; preload"),
        );
    }

    // Prevent MIME type sniffing attacks in older browsers
    headers.insert(X_CONTENT_TYPE_OPTIONS, HeaderValue::from_static("nosniff"));

    // Prevent clickjacking by disallowing embedding in frames
    headers.insert(X_FRAME_OPTIONS, HeaderValue::from_static("DENY"));

    // Control referrer information leakage
    headers.insert(REFERRER_POLICY, HeaderValue::from_static("no-referrer"));

    // Disable browser features that could be used for fingerprinting or attacks
    headers.insert(
        PERMISSIONS_POLICY,
        HeaderValue::from_static("geolocation=(), microphone=(), camera=()"),
    );

    // Disable deprecated XSS protection filter (modern browsers don't use it)
    headers.insert(X_XSS_PROTECTION, HeaderValue::from_static("0"));

    response
}

// Request body size limits for different route categories
const LOGIN_BODY_LIMIT: usize = 64 * 1024; // 64 KB for authentication endpoints (login/logout)
const PUBLIC_BODY_LIMIT: usize = 2 * 1024 * 1024; // 2 MB for general public read/write routes
const ADMIN_BODY_LIMIT: usize = 8 * 1024 * 1024; // 8 MB for admin write operations (content creation)

// Default CORS origins for development environment when FRONTEND_ORIGINS is not set
const DEV_DEFAULT_FRONTEND_ORIGINS: &[&str] = &["http://localhost:5173", "http://localhost:3000"];

/// Parses and validates a list of allowed CORS origins from string input.
///
/// This function performs rigorous validation of CORS origins to ensure
/// only properly formatted HTTP/HTTPS URLs are accepted. Invalid origins
/// are logged and filtered out.
///
/// # Validation Rules
///
/// - Origins must be non-empty and start with "http://" or "https://"
/// - Origins must be valid URLs according to the `url` crate
/// - Origins must be valid HTTP header values
///
/// # Arguments
///
/// * `origins` - An iterator of string slices, each representing a potential CORS origin
///
/// # Returns
///
/// A `Vec<HeaderValue>` containing only the validated origins
///
/// # Example
///
/// ```
/// let origins = parse_allowed_origins(["https://example.com", "http://localhost:3000"]);
/// assert_eq!(origins.len(), 2);
/// ```
fn parse_allowed_origins<'a, I>(origins: I) -> Vec<HeaderValue>
where
    I: IntoIterator<Item = &'a str>,
{
    origins
        .into_iter()
        .filter_map(|origin| {
            let trimmed = origin.trim();

            // Skip empty origins
            if trimmed.is_empty() {
                return None;
            }

            // Validate protocol - only HTTP and HTTPS are allowed for CORS
            if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
                tracing::warn!(
                    "Ignoring invalid origin (must start with http:// or https://): '{trimmed}'"
                );
                return None;
            }

            // Validate URL format using the url crate
            if let Err(e) = url::Url::parse(trimmed) {
                tracing::warn!("Ignoring malformed origin URL '{trimmed}': {e}");
                return None;
            }

            // Validate that the origin can be used as an HTTP header value
            match HeaderValue::from_str(trimmed) {
                Ok(value) => Some(value),
                Err(err) => {
                    tracing::warn!("Ignoring invalid origin header value '{trimmed}': {err}");
                    None
                }
            }
        })
        .collect()
}

/// Main application entry point and server initialization.
///
/// This function sets up the entire web server including:
/// - Environment configuration and logging
/// - Authentication (JWT) and CSRF protection
/// - Database connection pooling
/// - CORS configuration and security middleware
/// - Rate limiting and request size limits
/// - Route definition and mounting
/// - Server binding and graceful shutdown handling
///
/// # Security Considerations
///
/// - JWT and CSRF secrets must be properly configured before startup
/// - Database connections are pooled for performance and reliability
/// - Rate limiting prevents brute force attacks on authentication endpoints
/// - All routes have appropriate middleware for security and performance
///
/// # Panics
///
/// This function will panic if:
/// - JWT secret cannot be initialized
/// - CSRF secret cannot be initialized
/// - Database connection cannot be established
/// - Invalid FRONTEND_ORIGINS configuration in production
/// - Cannot bind to the configured PORT
#[tokio::main]
async fn main() {
    // Load environment variables from .env file if present
    dotenv().ok();

    // Initialize structured logging for debugging and monitoring
    tracing_subscriber::fmt::init();

    // Initialize JWT secret for authentication token signing/verification
    // This is a critical security component - fail fast if misconfigured
    auth::init_jwt_secret().expect("Failed to initialize JWT secret");
    tracing::info!("JWT secret initialized successfully");

    // Initialize CSRF secret for cross-site request forgery protection
    // This prevents CSRF attacks on state-changing operations
    csrf::init_csrf_secret().expect("Failed to initialize CSRF secret");
    tracing::info!("CSRF secret initialized successfully");

    // Initialize database connection pool for efficient connection management
    let pool = db::create_pool()
        .await
        .expect("Failed to create database pool");

    // Configure Cross-Origin Resource Sharing (CORS) for frontend integration
    let allowed_origins: Vec<HeaderValue> = match env::var("FRONTEND_ORIGINS") {
        Ok(value) => {
            // Parse and validate user-provided CORS origins
            let parsed = parse_allowed_origins(value.split(','));
            if parsed.is_empty() {
                panic!("FRONTEND_ORIGINS provided but no valid origins were found. Configure at least one valid http(s) origin.");
            }
            parsed
        }
        Err(_) if cfg!(debug_assertions) => {
            // Development mode: Use safe defaults for local development
            tracing::warn!(
                "FRONTEND_ORIGINS not set; using development defaults: {:?}",
                DEV_DEFAULT_FRONTEND_ORIGINS
            );
            parse_allowed_origins(DEV_DEFAULT_FRONTEND_ORIGINS.iter().copied())
        }
        Err(_) => {
            // Production mode: Require explicit CORS configuration for security
            panic!("FRONTEND_ORIGINS environment variable must be set to at least one valid http(s) origin in production.");
        }
    };

    // Build CORS layer with appropriate origins, methods, headers, and credential support
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list(allowed_origins.clone()))
        .allow_methods(AllowMethods::list(vec![
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,
            Method::HEAD,
        ]))
        .allow_headers(AllowHeaders::list(vec![AUTHORIZATION, CONTENT_TYPE]))
        .allow_credentials(true); // Allow cookies/authorization headers for authenticated requests

    tracing::info!(origins = ?allowed_origins, "Configured CORS origins");

    // Configure proxy header trust level for IP-based rate limiting
    let trust_proxy_ip_headers = parse_env_bool("TRUST_PROXY_IP_HEADERS", false);
    if trust_proxy_ip_headers {
        tracing::info!("Trusting X-Forwarded-* headers for client IP extraction");
    } else {
        tracing::info!("Proxy headers will be stripped before rate limiting to prevent spoofing");
    }

    // Configure rate limiting for authentication endpoints (1 req/sec, burst of 5)
    // Prevents brute force attacks on login/logout endpoints
    let rate_limit_config = std::sync::Arc::new(
        GovernorConfigBuilder::default()
            .per_second(1)
            .burst_size(5)
            .key_extractor(SmartIpKeyExtractor)
            .finish()
            .expect("Failed to build governor config"),
    );

    // Build login router with authentication-specific rate limiting and size limits
    let login_router = Router::new()
        .route("/api/auth/login", post(handlers::auth::login))
        .route("/api/auth/logout", post(handlers::auth::logout))
        .layer(RequestBodyLimitLayer::new(LOGIN_BODY_LIMIT))
        .layer(GovernorLayer::new(rate_limit_config));

    // Configure stricter rate limiting for admin write operations (1 req/sec, burst of 3)
    // Admin operations are more sensitive and warrant stricter protection
    let admin_rate_limit_config = std::sync::Arc::new(
        GovernorConfigBuilder::default()
            .per_second(1)
            .burst_size(3)
            .key_extractor(SmartIpKeyExtractor)
            .finish()
            .expect("Failed to build governor config for write routes"),
    );

    // Build admin routes with authentication, CSRF protection, and rate limiting
    // These routes require authenticated users and have stricter security controls
    let admin_routes = Router::new()
        // Tutorial CRUD operations (Create, Update, Delete)
        .route("/api/tutorials", post(handlers::tutorials::create_tutorial))
        .route(
            "/api/tutorials/{id}",
            put(handlers::tutorials::update_tutorial).delete(handlers::tutorials::delete_tutorial),
        )
        // Site content management (header, footer, etc.)
        .route(
            "/api/content/{section}",
            put(handlers::site_content::update_site_content),
        )
        // Site page management (static pages like About, Contact)
        .route(
            "/api/pages",
            get(handlers::site_pages::list_site_pages).post(handlers::site_pages::create_site_page),
        )
        .route(
            "/api/pages/{id}",
            get(handlers::site_pages::get_site_page)
                .put(handlers::site_pages::update_site_page)
                .delete(handlers::site_pages::delete_site_page),
        )
        // Blog post management within pages
        .route(
            "/api/pages/{page_id}/posts",
            get(handlers::site_posts::list_posts_for_page).post(handlers::site_posts::create_post),
        )
        .route(
            "/api/posts/{id}",
            get(handlers::site_posts::get_post)
                .put(handlers::site_posts::update_post)
                .delete(handlers::site_posts::delete_post),
        )
        // Comment moderation and management
        .route(
            "/api/tutorials/{id}/comments",
            post(handlers::comments::create_comment),
        )
        .route(
            "/api/comments/{id}",
            delete(handlers::comments::delete_comment),
        )
        // Apply CSRF protection first (outermost layer)
        .route_layer(middleware::from_extractor::<csrf::CsrfGuard>())
        // Apply authentication middleware (require valid JWT)
        .route_layer(middleware::from_fn(auth::auth_middleware))
        // Apply request body size limit for content creation
        .layer(RequestBodyLimitLayer::new(ADMIN_BODY_LIMIT))
        // Apply admin-specific rate limiting
        .layer(GovernorLayer::new(admin_rate_limit_config.clone()));

    // Build main application router with all routes and middleware
    let mut app = Router::new()
        // Merge authentication routes with their specific rate limiting
        .merge(login_router)

        // Public authentication routes (no auth required)
        .route("/api/auth/me", get(handlers::auth::me)) // Get current user info

        // Public tutorial routes (read-only access)
        .route("/api/tutorials", get(handlers::tutorials::list_tutorials)) // List all tutorials
        .route(
            "/api/tutorials/{id}",
            get(handlers::tutorials::get_tutorial), // Get specific tutorial
        )

        // Search functionality for content discovery
        .route(
            "/api/search/tutorials",
            get(handlers::search::search_tutorials), // Search tutorials by text
        )
        .route("/api/search/topics", get(handlers::search::get_all_topics)) // Get all topic tags

        // Public comment routes (read-only, admin manages writes)
        .route(
            "/api/tutorials/{id}/comments",
            get(handlers::comments::list_comments), // List comments for tutorial
        )

        // Public site content routes (read-only access to site configuration)
        .route(
            "/api/content",
            get(handlers::site_content::list_site_content), // List all content sections
        )
        .route(
            "/api/content/{section}",
            get(handlers::site_content::get_site_content), // Get specific content section
        )

        // Merge protected admin routes (requires auth + CSRF)
        .merge(admin_routes)

        // Public frontend routes (for the public website)
        .route(
            "/api/public/pages/{slug}",
            get(handlers::site_pages::get_published_page_by_slug), // Get page by slug
        )
        .route(
            "/api/public/pages/{slug}/posts/{post_slug}",
            get(handlers::site_pages::get_published_post_by_slug), // Get blog post
        )
        .route(
            "/api/public/navigation",
            get(handlers::site_pages::get_navigation), // Get site navigation
        )
        .route(
            "/api/public/published-pages",
            get(handlers::site_pages::list_published_page_slugs), // List all page slugs
        )

        // Health check endpoint for monitoring/load balancers
        .route("/api/health", get(|| async { "OK" }))

        // Apply middleware in reverse order (bottom applied first)
        .with_state(pool) // Database connection pool available to all handlers
        .layer(middleware::from_fn(security_headers)) // Security headers on all responses
        .layer(cors) // CORS configuration for frontend integration
        .layer(RequestBodyLimitLayer::new(PUBLIC_BODY_LIMIT)); // Default body size limit

    // Apply proxy header stripping middleware if not trusting proxy headers
    if !trust_proxy_ip_headers {
        app = app.layer(middleware::from_fn(strip_untrusted_forwarded_headers));
    }

    // Parse and validate server port from environment
    let port_str = env::var("PORT").unwrap_or_else(|_| "8489".to_string());
    let port: u16 = match port_str.parse() {
        Ok(port) => port,
        Err(e) => {
            panic!(
                "Invalid PORT '{}': {}. Please set PORT to a valid u16 value.",
                port_str, e
            );
        }
    };

    // Warn about privileged ports that may require elevated permissions
    if port < 1024 {
        tracing::warn!(
            "PORT {} is in privileged range (< 1024). May require elevated permissions.",
            port
        );
    }

    let addr = format!("0.0.0.0:{}", port);

    tracing::info!("Starting server on {}", addr);

    // Bind TCP listener with comprehensive error handling
    let listener = match tokio::net::TcpListener::bind(&addr).await {
        Ok(listener) => listener,
        Err(err) => {
            if err.kind() == ErrorKind::AddrInUse {
                panic!("Failed to bind to {addr}: port {port} is already in use. Choose a different PORT value.");
            } else {
                panic!("Failed to bind to {addr}: {err}");
            }
        }
    };

    // Create service with socket address information for logging/rate limiting
    let make_service = app.into_make_service_with_connect_info::<SocketAddr>();

    // Start server with graceful shutdown support
    let server = axum::serve(listener, make_service).with_graceful_shutdown(shutdown_signal());

    tracing::info!("Server is ready to accept connections");

    // Run server until shutdown signal or error occurs
    if let Err(e) = server.await {
        tracing::error!("Server error: {}", e);
    }

    tracing::info!("Server shutdown complete");
}

/// Listens for shutdown signals to trigger graceful server shutdown.
///
/// This function handles both platform-specific and cross-platform shutdown signals:
/// - **Unix systems**: SIGTERM (from container orchestrators) and Ctrl+C
/// - **Windows/Other**: Ctrl+C only
///
/// The graceful shutdown ensures that in-flight requests are completed
/// before the server exits, preventing dropped connections.
///
/// # Signal Handling
///
/// - **SIGTERM**: Sent by container orchestrators (Docker, Kubernetes) for graceful shutdown
/// - **Ctrl+C**: Manual shutdown signal from terminal
///
/// # Behavior
///
/// - Logs the received signal type
/// - Initiates graceful shutdown process
/// - Allows existing requests to complete
/// - Prevents new connections from being accepted
async fn shutdown_signal() {
    // Handle Ctrl+C (cross-platform)
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("Failed to install Ctrl+C handler");
    };

    // Handle SIGTERM on Unix systems (container orchestration signals)
    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("Failed to install SIGTERM handler")
            .recv()
            .await;
    };

    // No SIGTERM handling on non-Unix systems
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    // Wait for either shutdown signal
    tokio::select! {
        _ = ctrl_c => {
            tracing::info!("Received Ctrl+C signal");
        },
        _ = terminate => {
            tracing::info!("Received SIGTERM signal");
        },
    }

    tracing::info!("Starting graceful shutdown...");
}
