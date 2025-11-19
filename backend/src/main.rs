
// Module declarations for organizing the backend codebase
pub mod auth;     // Authentication and JWT token management
pub mod csrf;     // Cross-Site Request Forgery protection
pub mod db;       // Database connection and pooling
pub mod handlers; // HTTP request handlers organized by feature
pub mod models;   // Data structures and database models
pub mod middleware; // Middleware modules
pub mod repositories; // Repository modules

use crate::middleware::{cors, security};

// HTTP-related imports for building the web server
use axum::http::{
    header::{
        AUTHORIZATION, CACHE_CONTROL, CONTENT_SECURITY_POLICY, CONTENT_TYPE, EXPIRES, PRAGMA,
        STRICT_TRANSPORT_SECURITY, X_CONTENT_TYPE_OPTIONS, X_FRAME_OPTIONS, ACCEPT,
    },
    HeaderName, HeaderValue, Method,
};
use axum::{
    extract::{DefaultBodyLimit, Request},
    middleware::{self, from_extractor, from_fn, Next},
    response::Response,
    routing::{delete, get, post, put},
    Router,
};

// External dependencies for configuration, async runtime, and middleware
use dotenv::dotenv;
use std::env;
use std::io::ErrorKind;
use std::net::SocketAddr;
use tokio::signal;
use tower_governor::key_extractor::SmartIpKeyExtractor;
use tower_governor::{governor::GovernorConfigBuilder, GovernorLayer};
use tower_http::cors::{AllowHeaders, AllowMethods, AllowOrigin, CorsLayer};
use tower_http::limit::RequestBodyLimitLayer;
use tower_http::services::ServeDir;
use tracing_subscriber;

// Custom HTTP header constants for security policies
const PERMISSIONS_POLICY: HeaderName = HeaderName::from_static("permissions-policy");
const REFERRER_POLICY: HeaderName = HeaderName::from_static("referrer-policy");
const X_XSS_PROTECTION: HeaderName = HeaderName::from_static("x-xss-protection");

// Forwarded header constants for proxy handling
// Standard forwarded header used by RFC 7239
const FORWARDED_HEADER: HeaderName = HeaderName::from_static("forwarded");
// Header containing the originating client IP address
const X_FORWARDED_FOR_HEADER: HeaderName = HeaderName::from_static("x-forwarded-for");
// Header indicating the protocol used by the client (http/https)
const X_FORWARDED_PROTO_HEADER: HeaderName = HeaderName::from_static("x-forwarded-proto");
// Header containing the original host requested by the client
const X_FORWARDED_HOST_HEADER: HeaderName = HeaderName::from_static("x-forwarded-host");
// Header containing the real IP address of the client
const X_REAL_IP_HEADER: HeaderName = HeaderName::from_static("x-real-ip");

/// Parses a boolean value from an environment variable with support for various formats.
///
/// # Arguments
/// * `key` - The environment variable name to parse
/// * `default` - The default value to return if the variable is not set or invalid
///
/// # Returns
/// The parsed boolean value, or the default if parsing fails
///
/// # Supported formats
/// - true: "1", "true", "yes", "on" (case-insensitive)
/// - false: "0", "false", "no", "off" (case-insensitive)
///

/// Middleware to strip potentially spoofable forwarded headers from incoming requests.
///
/// This middleware removes all proxy-related headers that could be spoofed by clients
/// to bypass security measures like rate limiting or IP-based access control.
///
/// # Security considerations
/// When TRUST_PROXY_IP_HEADERS is disabled, this middleware ensures that only the
/// direct connection IP is trusted, preventing clients from faking their IP address.
// These are now likely handled within the `security` module if they are still needed.


// Request body size limits for different endpoint types
// These prevent DoS attacks through large payloads
const LOGIN_BODY_LIMIT: usize = 64 * 1024;      // 64KB for login endpoints
const PUBLIC_BODY_LIMIT: usize = 2 * 1024 * 1024; // 2MB for public endpoints
const ADMIN_BODY_LIMIT: usize = 8 * 1024 * 1024;  // 8MB for admin content uploads


/// Main application entry point.
///
/// This function initializes and starts the web server with all necessary
/// middleware, routes, and security configurations.
///
/// # Initialization steps
/// 1. Load environment variables from .env file
/// 2. Initialize logging with tracing
/// 3. Initialize JWT secret for authentication
/// 4. Initialize CSRF token secret
/// 5. Initialize login attempt salt for rate limiting
/// 6. Create database connection pool
/// 7. Configure CORS with allowed origins
/// 8. Set up rate limiting for different endpoint types
/// 9. Configure routes and middleware layers
/// 10. Start the HTTP server
///
/// # Panics
/// The function will panic if:
/// - JWT secret initialization fails
/// - CSRF secret initialization fails
/// - Login attempt salt initialization fails
/// - Database pool creation fails
/// - FRONTEND_ORIGINS is invalid or missing in production
/// - PORT environment variable is invalid
/// - Server fails to bind to the specified port
#[tokio::main]
async fn main() {
    // Load environment variables from .env file (if present)
    dotenv().ok();

    // Initialize structured logging
    tracing_subscriber::fmt::init();

    auth::init_jwt_secret().expect("Failed to initialize JWT secret");
    tracing::info!("JWT secret initialized successfully");

    csrf::init_csrf_secret().expect("Failed to initialize CSRF secret");
    tracing::info!("CSRF secret initialized successfully");

    handlers::auth::init_login_attempt_salt().expect("Failed to initialize login attempt salt");
    tracing::info!("Login attempt salt initialized successfully");

    let pool = db::create_pool()
        .await
        .expect("Failed to create database pool");

    // Ensure uploads directory exists
    let upload_dir = env::var("UPLOAD_DIR").unwrap_or_else(|_| "uploads".to_string());
    if !std::path::Path::new(&upload_dir).exists() {
        tokio::fs::create_dir_all(&upload_dir)
            .await
            .expect("Failed to create uploads directory");
    }

    // Configure CORS (Cross-Origin Resource Sharing)
    let cors_origins = env::var("CORS_ALLOWED_ORIGINS")
        .map(|val| {
            val.split(',')
                .map(|s| s.trim().to_string())
                .collect::<Vec<_>>()
        })
        .unwrap_or_else(|_| {
            cors::DEV_DEFAULT_FRONTEND_ORIGINS
                .iter()
                .map(|&s| s.to_string())
                .collect()
            });

    let allowed_origins = cors::parse_allowed_origins(cors_origins.iter().map(|s| s.as_str()));

    let cors_layer = CorsLayer::new()
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([CONTENT_TYPE, AUTHORIZATION, ACCEPT])
        .allow_credentials(true)
        .allow_origin(allowed_origins);

    tracing::info!(origins = ?cors_origins, "Configured CORS origins");

    let trust_proxy_ip_headers = security::parse_env_bool("TRUST_PROXY_IP_HEADERS", false);
    if trust_proxy_ip_headers {
        tracing::info!("Trusting X-Forwarded-* headers for client IP extraction");
    } else {
        tracing::info!("Proxy headers will be stripped before rate limiting to prevent spoofing");
    }

    let rate_limit_config = std::sync::Arc::new(
        GovernorConfigBuilder::default()
            .per_second(1)
            .burst_size(5)
            .key_extractor(SmartIpKeyExtractor)
            .finish()
            .expect("Failed to build governor config"),
    );

    let login_router = Router::new()
        .route("/api/auth/login", post(handlers::auth::login))
        .route("/api/auth/logout", post(handlers::auth::logout))
        .layer(RequestBodyLimitLayer::new(LOGIN_BODY_LIMIT))
        .layer(GovernorLayer::new(rate_limit_config))
        .with_state(pool.clone());

    let admin_rate_limit_config = std::sync::Arc::new(
        GovernorConfigBuilder::default()
            .per_second(1)
            .burst_size(3)
            .key_extractor(SmartIpKeyExtractor)
            .finish()
            .expect("Failed to build governor config for write routes"),
    );

    let admin_routes = Router::new()
        .route("/api/tutorials", post(handlers::tutorials::create_tutorial))
        .route(
            "/api/tutorials/{id}",
            put(handlers::tutorials::update_tutorial).delete(handlers::tutorials::delete_tutorial),
        )
        .route(
            "/api/content/{section}",
            put(handlers::site_content::update_site_content),
        )
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
        .route(
            "/api/tutorials/{id}/comments",
            post(handlers::comments::create_comment),
        )
        .route(
            "/api/comments/{id}",
            delete(handlers::comments::delete_comment),
        )
        .route(
            "/api/upload",
            post(handlers::upload::upload_image),
        )
        .with_state(pool.clone())
        .route_layer(from_extractor::<csrf::CsrfGuard>())
        .route_layer(from_fn(middleware::auth::auth_middleware))
        .layer(RequestBodyLimitLayer::new(ADMIN_BODY_LIMIT))
        .layer(GovernorLayer::new(admin_rate_limit_config.clone()));

    // Define the application router with all routes and middleware
    let mut app = Router::new()
        .with_state(pool)
        // Merge all route modules
        .merge(login_router)

        .route("/api/auth/me", get(handlers::auth::me))

        .route("/api/tutorials", get(handlers::tutorials::list_tutorials))
        .route(
            "/api/tutorials/{id}",
            get(handlers::tutorials::get_tutorial),
        )

        .route(
            "/api/search/tutorials",
            get(handlers::search::search_tutorials),
        )
        .route("/api/search/topics", get(handlers::search::get_all_topics))

        .route(
            "/api/tutorials/{id}/comments",
            get(handlers::comments::list_comments),
        )

        .route(
            "/api/content",
            get(handlers::site_content::list_site_content),
        )
        .route(
            "/api/content/{section}",
            get(handlers::site_content::get_site_content),
        )

        .merge(admin_routes)

        .route(
            "/api/posts/{id}/comments",
            get(handlers::comments::list_post_comments)
                .post(handlers::comments::create_post_comment)
                .route_layer(GovernorLayer::new(admin_rate_limit_config.clone())),
        )
        .route(
            "/api/comments/{id}/vote",
            post(handlers::comments::vote_comment),
        )

        .route(
            "/api/public/pages/{slug}",
            get(handlers::site_pages::get_published_page_by_slug),
        )
        .route(
            "/api/public/pages/{slug}/posts/{post_slug}",
            get(handlers::site_pages::get_published_post_by_slug),
        )
        .route(
            "/api/public/navigation",
            get(handlers::site_pages::get_navigation),
        )
        .route(
            "/api/public/published-pages",
            get(handlers::site_pages::list_published_page_slugs),
        )
        .nest_service("/uploads", ServeDir::new(upload_dir))

        .route("/api/health", get(|| async { "OK" }))

        // Serve index.html with server-side injection for root and fallback
        .route("/", get(handlers::frontend_proxy::serve_index))
        .route("/{*path}", get(handlers::frontend_proxy::serve_index));
        .layer(axum::middleware::from_fn(security::security_headers))
        .layer(cors_layer)
        .layer(DefaultBodyLimit::max(10 * 1024 * 1024)); // 10MB body limit

    // Apply trusted proxy middleware if configured
    let app = if trust_proxy_ip_headers {
        app
    } else {
        app.layer(axum::middleware::from_fn(
            security::strip_untrusted_forwarded_headers,
        ))
    };
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

    if port < 1024 {
        tracing::warn!(
            "PORT {} is in privileged range (< 1024). May require elevated permissions.",
            port
        );
    }

    let addr = format!("0.0.0.0:{}", port);

    tracing::info!("Starting server on {}", addr);

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

    let make_service = app.into_make_service_with_connect_info::<SocketAddr>();

    let server = axum::serve(listener, make_service).with_graceful_shutdown(shutdown_signal());

    tracing::info!("Server is ready to accept connections");

    if let Err(e) = server.await {
        tracing::error!("Server error: {}", e);
    }

    tracing::info!("Server shutdown complete");
}

/// Waits for a shutdown signal and initiates graceful shutdown.
///
/// This function listens for termination signals to allow the server to shut down
/// gracefully, completing in-flight requests before stopping.
///
/// # Signals handled
/// - Ctrl+C (SIGINT): Handles user interruption from terminal
/// - SIGTERM: Handles termination signal from process managers (Unix only)
///
/// On non-Unix systems, only Ctrl+C is handled as SIGTERM is Unix-specific.
///
/// # Graceful shutdown
/// When a signal is received, the server:
/// 1. Stops accepting new connections
/// 2. Waits for existing requests to complete
/// 3. Closes database connections
/// 4. Exits cleanly
async fn shutdown_signal() {
    // Handle Ctrl+C signal (works on all platforms)
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("Failed to install Ctrl+C handler");
    };

    // Handle SIGTERM on Unix systems (used by Docker, systemd, etc.)
    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("Failed to install SIGTERM handler")
            .recv()
            .await;
    };

    // On non-Unix systems, SIGTERM doesn't exist, so use a pending future
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    // Wait for either Ctrl+C or SIGTERM
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
