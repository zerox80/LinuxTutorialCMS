

// Module declarations for organizing the backend codebase
mod auth;     // Authentication and JWT token management
mod csrf;     // Cross-Site Request Forgery protection
mod db;       // Database connection and pooling
mod handlers; // HTTP request handlers organized by feature
mod models;   // Data structures and database models

// HTTP-related imports for building the web server
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
use tracing_subscriber;

// Custom HTTP header constants for security policies
const PERMISSIONS_POLICY: HeaderName = HeaderName::from_static("permissions-policy");
const REFERRER_POLICY: HeaderName = HeaderName::from_static("referrer-policy");
const X_XSS_PROTECTION: HeaderName = HeaderName::from_static("x-xss-protection");

// Forwarded header constants for proxy handling
const FORWARDED_HEADER: HeaderName = HeaderName::from_static("forwarded");
const X_FORWARDED_FOR_HEADER: HeaderName = HeaderName::from_static("x-forwarded-for");
const X_FORWARDED_PROTO_HEADER: HeaderName = HeaderName::from_static("x-forwarded-proto");
const X_FORWARDED_HOST_HEADER: HeaderName = HeaderName::from_static("x-forwarded-host");
const X_REAL_IP_HEADER: HeaderName = HeaderName::from_static("x-real-ip");

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

async fn strip_untrusted_forwarded_headers(mut request: Request, next: Next) -> Response {
    {
        let headers = request.headers_mut();

        // Remove all potentially spoofable forwarded headers
        headers.remove(FORWARDED_HEADER);
        headers.remove(X_FORWARDED_FOR_HEADER);
        headers.remove(X_FORWARDED_PROTO_HEADER);
        headers.remove(X_FORWARDED_HOST_HEADER);
        headers.remove(X_REAL_IP_HEADER);
    }

    next.run(request).await
}

async fn security_headers(request: Request, next: Next) -> Response {
    use axum::http::Method;

    let method = request.method().clone();
    let path = request.uri().path().to_string();

    // Detect if request is over HTTPS for HSTS header
    let is_https = request
        .headers()
        .get("x-forwarded-proto")
        .and_then(|v| v.to_str().ok())
        .map(|v| v == "https")
        .unwrap_or(false);

    let mut response = next.run(request).await;
    let headers = response.headers_mut();

    // Configure cache control based on endpoint type
    // Public endpoints can be cached, sensitive endpoints cannot
    let cacheable = method == Method::GET
        && (path == "/api/tutorials"
            || path.starts_with("/api/tutorials/")
            || path.starts_with("/api/public/"));

    if cacheable {
        // Allow caching for public read-only endpoints (5 minutes)
        headers.insert(
            CACHE_CONTROL,
            HeaderValue::from_static("public, max-age=300, stale-while-revalidate=60"),
        );
        headers.remove(PRAGMA);
        headers.remove(EXPIRES);
    } else {
        // No caching for sensitive endpoints (auth, admin, etc.)
        headers.insert(
            CACHE_CONTROL,
            HeaderValue::from_static("no-store, no-cache, must-revalidate"),
        );
        headers.insert(PRAGMA, HeaderValue::from_static("no-cache"));
        headers.insert(EXPIRES, HeaderValue::from_static("0"));
    }

    // Content Security Policy - varies between dev and production
    let csp = if cfg!(debug_assertions) {
        // Development CSP - allows unsafe-inline for easier debugging
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';"
    } else {
        // Production CSP - stricter, no unsafe-inline
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;"
    };

    headers.insert(CONTENT_SECURITY_POLICY, HeaderValue::from_static(csp));

    // HSTS - only add if already using HTTPS
    if is_https {
        headers.insert(
            STRICT_TRANSPORT_SECURITY,
            HeaderValue::from_static("max-age=31536000; includeSubDomains; preload"),
        );
    }

    // Anti-MIME-sniffing header
    headers.insert(X_CONTENT_TYPE_OPTIONS, HeaderValue::from_static("nosniff"));

    // Clickjacking protection
    headers.insert(X_FRAME_OPTIONS, HeaderValue::from_static("DENY"));

    // Referrer privacy
    headers.insert(REFERRER_POLICY, HeaderValue::from_static("no-referrer"));

    // Disable browser features that could compromise privacy
    headers.insert(
        PERMISSIONS_POLICY,
        HeaderValue::from_static("geolocation=(), microphone=(), camera=()"),
    );

    // Legacy XSS filter (disabled in favor of CSP)
    headers.insert(X_XSS_PROTECTION, HeaderValue::from_static("0"));

    response
}

// Request body size limits for different endpoint types
// These prevent DoS attacks through large payloads
const LOGIN_BODY_LIMIT: usize = 64 * 1024;      // 64KB for login endpoints
const PUBLIC_BODY_LIMIT: usize = 2 * 1024 * 1024; // 2MB for public endpoints
const ADMIN_BODY_LIMIT: usize = 8 * 1024 * 1024;  // 8MB for admin content uploads

// Default CORS origins for development environment
// In production, FRONTEND_ORIGINS environment variable must be set
const DEV_DEFAULT_FRONTEND_ORIGINS: &[&str] = &["http://localhost:5173", "http://localhost:3000"];

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

            // Only allow HTTP and HTTPS protocols
            if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
                tracing::warn!(
                    "Ignoring invalid origin (must start with http:// or https://): '{trimmed}'"
                );
                return None;
            }

            // Validate URL format
            if let Err(e) = url::Url::parse(trimmed) {
                tracing::warn!("Ignoring malformed origin URL '{trimmed}': {e}");
                return None;
            }

            // Convert to HeaderValue for AXUM CORS
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

#[tokio::main]
async fn main() {

    dotenv().ok();

    tracing_subscriber::fmt::init();

    auth::init_jwt_secret().expect("Failed to initialize JWT secret");
    tracing::info!("JWT secret initialized successfully");

    csrf::init_csrf_secret().expect("Failed to initialize CSRF secret");
    tracing::info!("CSRF secret initialized successfully");

    let pool = db::create_pool()
        .await
        .expect("Failed to create database pool");

    let allowed_origins: Vec<HeaderValue> = match env::var("FRONTEND_ORIGINS") {
        Ok(value) => {

            let parsed = parse_allowed_origins(value.split(','));
            if parsed.is_empty() {
                panic!("FRONTEND_ORIGINS provided but no valid origins were found. Configure at least one valid http(s) origin.");
            }
            parsed
        }
        Err(_) if cfg!(debug_assertions) => {

            tracing::warn!(
                "FRONTEND_ORIGINS not set; using development defaults: {:?}",
                DEV_DEFAULT_FRONTEND_ORIGINS
            );
            parse_allowed_origins(DEV_DEFAULT_FRONTEND_ORIGINS.iter().copied())
        }
        Err(_) => {

            panic!("FRONTEND_ORIGINS environment variable must be set to at least one valid http(s) origin in production.");
        }
    };

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
        .allow_credentials(true);

    tracing::info!(origins = ?allowed_origins, "Configured CORS origins");

    let trust_proxy_ip_headers = parse_env_bool("TRUST_PROXY_IP_HEADERS", false);
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
        .layer(GovernorLayer::new(rate_limit_config));

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

        .route_layer(middleware::from_extractor::<csrf::CsrfGuard>())

        .route_layer(middleware::from_fn(auth::auth_middleware))

        .layer(RequestBodyLimitLayer::new(ADMIN_BODY_LIMIT))

        .layer(GovernorLayer::new(admin_rate_limit_config.clone()));

    let mut app = Router::new()

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

        .route("/api/health", get(|| async { "OK" }))

        .with_state(pool)
        .layer(middleware::from_fn(security_headers))
        .layer(cors)
        .layer(RequestBodyLimitLayer::new(PUBLIC_BODY_LIMIT));

    if !trust_proxy_ip_headers {
        app = app.layer(middleware::from_fn(strip_untrusted_forwarded_headers));
    }

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

async fn shutdown_signal() {

    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("Failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("Failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

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
