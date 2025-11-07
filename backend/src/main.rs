mod auth;
mod db;
mod handlers;
mod models;

use axum::{
    extract::Request,
    middleware::{self, Next},
    response::Response,
    routing::{delete, get, post, put},
    Router,
};
use dotenv::dotenv;
use std::env;
use axum::http::{
    header::{
        AUTHORIZATION, CACHE_CONTROL, CONTENT_SECURITY_POLICY, CONTENT_TYPE, EXPIRES,
        PRAGMA, STRICT_TRANSPORT_SECURITY, X_CONTENT_TYPE_OPTIONS, X_FRAME_OPTIONS,
    },
    HeaderValue, Method,
};
use tower_http::cors::{AllowHeaders, AllowMethods, AllowOrigin, CorsLayer};
use tower_http::limit::RequestBodyLimitLayer;
use tower_governor::{
    governor::GovernorConfigBuilder,
    GovernorLayer,
};
use tracing_subscriber;
use tokio::signal;
use std::net::SocketAddr;
use std::io::ErrorKind;
use tower_governor::key_extractor::SmartIpKeyExtractor;

// Security headers middleware
async fn security_headers(
    request: Request,
    next: Next,
) -> Response {
    use axum::http::Method;

    let method = request.method().clone();
    let path = request.uri().path().to_string();

    // Check if request is HTTPS before processing
    let is_https = request
        .headers()
        .get("x-forwarded-proto")
        .and_then(|v| v.to_str().ok())
        .map(|v| v == "https")
        .unwrap_or(false);
    let mut response = next.run(request).await;
    let headers = response.headers_mut();
    
    let cacheable = method == Method::GET
        && (path == "/api/tutorials"
            || path.starts_with("/api/tutorials/")
            || path.starts_with("/api/public/"));

    if cacheable {
        headers.insert(
            CACHE_CONTROL,
            HeaderValue::from_static("public, max-age=300, stale-while-revalidate=60"),
        );
        headers.remove(PRAGMA);
        headers.remove(EXPIRES);
    } else {
        headers.insert(
            CACHE_CONTROL,
            HeaderValue::from_static("no-store, no-cache, must-revalidate"),
        );
        headers.insert(PRAGMA, HeaderValue::from_static("no-cache"));
        headers.insert(EXPIRES, HeaderValue::from_static("0"));
    }
    
    // Content Security Policy - Environment-dependent for dev mode support
    let csp = if cfg!(debug_assertions) {
        // Development mode: Allow WebSocket for Vite HMR
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:; object-src 'none'; base-uri 'self'; form-action 'self';"
    } else {
        // Production mode: Strict CSP (no inline styles)
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self';"
    };
    
    headers.insert(
        CONTENT_SECURITY_POLICY,
        HeaderValue::from_static(csp),
    );
    
    // HSTS - Only set if request came via HTTPS
    if is_https {
        headers.insert(
            STRICT_TRANSPORT_SECURITY,
            HeaderValue::from_static("max-age=31536000; includeSubDomains; preload"),
        );
    }
    
    // Prevent MIME sniffing
    headers.insert(
        X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    
    // Prevent clickjacking
    headers.insert(
        X_FRAME_OPTIONS,
        HeaderValue::from_static("DENY"),
    );
    
    response
}

const LOGIN_BODY_LIMIT: usize = 64 * 1024; // 64 KB for auth
const PUBLIC_BODY_LIMIT: usize = 2 * 1024 * 1024; // 2 MB for general routes
const ADMIN_BODY_LIMIT: usize = 8 * 1024 * 1024; // 8 MB for admin write operations

const DEV_DEFAULT_FRONTEND_ORIGINS: &[&str] = &[
    "http://localhost:5173",
    "http://localhost:3000",
];

fn parse_allowed_origins<'a, I>(origins: I) -> Vec<HeaderValue>
where
    I: IntoIterator<Item = &'a str>,
{
    origins
        .into_iter()
        .filter_map(|origin| {
            let trimmed = origin.trim();
            if trimmed.is_empty() {
                return None;
            }

            if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
                tracing::warn!("Ignoring invalid origin (must start with http:// or https://): '{trimmed}'");
                return None;
            }

            if let Err(e) = url::Url::parse(trimmed) {
                tracing::warn!("Ignoring malformed origin URL '{trimmed}': {e}");
                return None;
            }

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
    // Load environment variables
    dotenv().ok();
    
    // Initialize tracing
    tracing_subscriber::fmt::init();

    // Initialize JWT secret (fail-fast if not set correctly)
    auth::init_jwt_secret().expect("Failed to initialize JWT secret");
    tracing::info!("JWT secret initialized successfully");

    // Initialize database
    let pool = db::create_pool().await.expect("Failed to create database pool");

    // Configure CORS
    let allowed_origins: Vec<HeaderValue> = match env::var("FRONTEND_ORIGINS") {
        Ok(value) => {
            let parsed = parse_allowed_origins(value.split(','));
            if parsed.is_empty() {
                panic!("FRONTEND_ORIGINS provided but no valid origins were found. Configure at least one valid http(s) origin.");
            }
            parsed
        }
        Err(_) if cfg!(debug_assertions) => {
            tracing::warn!("FRONTEND_ORIGINS not set; using development defaults: {:?}", DEV_DEFAULT_FRONTEND_ORIGINS);
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

    // Configure rate limiting (average 1 request/sec for login, burst up to 5)
    let rate_limit_config = std::sync::Arc::new(
        GovernorConfigBuilder::default()
            .per_second(1)
            .burst_size(5)
            .key_extractor(SmartIpKeyExtractor)
            .finish()
            .expect("Failed to build governor config"),
    );

    // Build application routes
    // Login route with rate limiting
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
        // Tutorial admin routes
        .route("/api/tutorials", post(handlers::tutorials::create_tutorial))
        .route(
            "/api/tutorials/{id}",
            put(handlers::tutorials::update_tutorial)
                .delete(handlers::tutorials::delete_tutorial),
        )
        // Site content admin routes
        .route(
            "/api/content/{section}",
            put(handlers::site_content::update_site_content),
        )
        // Site page admin routes
        .route(
            "/api/pages",
            get(handlers::site_pages::list_site_pages)
                .post(handlers::site_pages::create_site_page),
        )
        .route(
            "/api/pages/{id}",
            get(handlers::site_pages::get_site_page)
                .put(handlers::site_pages::update_site_page)
                .delete(handlers::site_pages::delete_site_page),
        )
        // Site post admin routes
        .route(
            "/api/pages/{page_id}/posts",
            get(handlers::site_posts::list_posts_for_page)
                .post(handlers::site_posts::create_post),
        )
        .route(
            "/api/posts/{id}",
            get(handlers::site_posts::get_post)
                .put(handlers::site_posts::update_post)
                .delete(handlers::site_posts::delete_post),
        )
        // Comment admin routes
        .route(
            "/api/tutorials/{id}/comments",
            post(handlers::comments::create_comment),
        )
        .route(
            "/api/comments/{id}",
            delete(handlers::comments::delete_comment),
        )
        .route_layer(middleware::from_extractor::<auth::Claims>())
        .layer(RequestBodyLimitLayer::new(ADMIN_BODY_LIMIT))
        .layer(GovernorLayer::new(admin_rate_limit_config.clone()));

    let app = Router::new()
        .merge(login_router)
        // Auth routes
        .route("/api/auth/me", get(handlers::auth::me))
        
        // Tutorial routes
        .route("/api/tutorials", get(handlers::tutorials::list_tutorials))
        .route("/api/tutorials/{id}", get(handlers::tutorials::get_tutorial))
        
        // Search routes
        .route("/api/search/tutorials", get(handlers::search::search_tutorials))
        .route("/api/search/topics", get(handlers::search::get_all_topics))
        
        // Comment routes (public read, admin write)
        .route("/api/tutorials/{id}/comments", get(handlers::comments::list_comments))

        // Site content routes
        .route("/api/content", get(handlers::site_content::list_site_content))
        .route("/api/content/{section}", get(handlers::site_content::get_site_content))

        .merge(admin_routes)

        // Public page routes
        .route(
            "/api/public/pages/{slug}",
            get(handlers::site_pages::get_published_page_by_slug),
        )
        .route(
            "/api/public/pages/{slug}/posts/{post_slug}",
            get(handlers::site_pages::get_published_post_by_slug),
        )
        .route("/api/public/navigation", get(handlers::site_pages::get_navigation))
        .route(
            "/api/public/published-pages",
            get(handlers::site_pages::list_published_page_slugs),
        )

        // Health check
        .route("/api/health", get(|| async { "OK" }))
        
        .layer(RequestBodyLimitLayer::new(PUBLIC_BODY_LIMIT))
        .layer(cors)
        .layer(middleware::from_fn(security_headers))
        .with_state(pool);

    // Get port from environment or use default
    let port_str = env::var("PORT").unwrap_or_else(|_| "8489".to_string());
    let port: u16 = match port_str.parse() {
        Ok(port) => port,
        Err(e) => {
            panic!("Invalid PORT '{}': {}. Please set PORT to a valid u16 value.", port_str, e);
        }
    };
    
    if port < 1024 {
        tracing::warn!("PORT {} is in privileged range (< 1024). May require elevated permissions.", port);
    }
    
    let addr = format!("0.0.0.0:{}", port);
    
    tracing::info!("Starting server on {}", addr);

    // Start server
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
    
    // Graceful shutdown handler
    let make_service = app.into_make_service_with_connect_info::<SocketAddr>();

    let server = axum::serve(listener, make_service)
        .with_graceful_shutdown(shutdown_signal());
        
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
