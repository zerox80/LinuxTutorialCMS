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
    header::{AUTHORIZATION, CONTENT_TYPE, CONTENT_SECURITY_POLICY, STRICT_TRANSPORT_SECURITY, X_CONTENT_TYPE_OPTIONS, X_FRAME_OPTIONS},
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

// Security headers middleware
async fn security_headers(
    request: Request,
    next: Next,
) -> Response {
    // Check if request is HTTPS before processing
    let is_https = request
        .headers()
        .get("x-forwarded-proto")
        .and_then(|v| v.to_str().ok())
        .map(|v| v == "https")
        .unwrap_or(false);
    
    let mut response = next.run(request).await;
    let headers = response.headers_mut();
    
    // Content Security Policy - Environment-dependent for dev mode support
    let csp = if cfg!(debug_assertions) {
        // Development mode: Allow WebSocket for Vite HMR
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:; object-src 'none'; base-uri 'self'; form-action 'self';"
    } else {
        // Production mode: Strict CSP
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self';"
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
    let allowed_origins_env = env::var("FRONTEND_ORIGINS").unwrap_or_else(|_| {
        tracing::warn!("FRONTEND_ORIGINS not set, using development defaults. This should not happen in production!");
        "http://localhost:5173,http://localhost:3000".to_string()
    });
    let mut allowed_origins: Vec<HeaderValue> = allowed_origins_env
        .split(',')
        .filter_map(|origin| {
            let trimmed = origin.trim();
            if trimmed.is_empty() {
                return None;
            }
            
            // Validate that origin is a valid URL
            if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
                tracing::warn!("Ignoring invalid origin (must start with http:// or https://): '{trimmed}'");
                return None;
            }
            
            // Additional validation: check for valid URL structure
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
        .collect();

    if allowed_origins.is_empty() {
        tracing::warn!("No valid FRONTEND_ORIGINS configured; falling back to localhost:5173");
        allowed_origins.push(HeaderValue::from_static("http://localhost:5173"));
    }

    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list(allowed_origins.clone()))
        .allow_methods(AllowMethods::list(vec![
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,
        ]))
        .allow_headers(AllowHeaders::list(vec![AUTHORIZATION, CONTENT_TYPE]))
        .allow_credentials(true);

    tracing::info!(origins = ?allowed_origins, "Configured CORS origins");

    // Configure rate limiting (average 1 request/sec for login, burst up to 5)
    let rate_limit_config = std::sync::Arc::new(
        GovernorConfigBuilder::default()
            .per_second(1)
            .burst_size(5)
            .finish()
            .expect("Failed to build governor config"),
    );

    // Build application routes
    // Login route with rate limiting
    let login_router = Router::new()
        .route("/api/auth/login", post(handlers::auth::login))
        .layer(GovernorLayer::new(rate_limit_config));

    let write_limit_config = std::sync::Arc::new(
        GovernorConfigBuilder::default()
            .per_second(1)
            .burst_size(3)
            .finish()
            .expect("Failed to build governor config for write routes"),
    );

    let write_routes = Router::new()
        // Tutorial mutations
        .route("/api/tutorials", post(handlers::tutorials::create_tutorial))
        .route("/api/tutorials/:id", put(handlers::tutorials::update_tutorial))
        .route("/api/tutorials/:id", delete(handlers::tutorials::delete_tutorial))
        // Site content mutations
        .route(
            "/api/content/:section",
            put(handlers::site_content::update_site_content),
        )
        // Site page mutations
        .route("/api/pages", post(handlers::site_pages::create_site_page))
        .route("/api/pages/:id", put(handlers::site_pages::update_site_page))
        .route("/api/pages/:id", delete(handlers::site_pages::delete_site_page))
        // Site post mutations
        .route(
            "/api/pages/:page_id/posts",
            post(handlers::site_posts::create_post),
        )
        .route("/api/posts/:id", put(handlers::site_posts::update_post))
        .route("/api/posts/:id", delete(handlers::site_posts::delete_post))
        .layer(GovernorLayer::new(write_limit_config.clone()));
    
    let app = Router::new()
        .merge(login_router)
        // Auth routes
        .route("/api/auth/me", get(handlers::auth::me))
        
        // Tutorial routes
        .route("/api/tutorials", get(handlers::tutorials::list_tutorials))
        .route("/api/tutorials/:id", get(handlers::tutorials::get_tutorial))

        // Site content routes
        .route("/api/content", get(handlers::site_content::list_site_content))
        .route("/api/content/:section", get(handlers::site_content::get_site_content))

        // Site pages routes (admin)
        .route("/api/pages", get(handlers::site_pages::list_site_pages))
        .route("/api/pages/:id", get(handlers::site_pages::get_site_page))

        // Site posts routes (admin)
        .route(
            "/api/pages/:page_id/posts",
            get(handlers::site_posts::list_posts_for_page),
        )
        .route("/api/posts/:id", get(handlers::site_posts::get_post))
        .merge(write_routes)

        // Public page routes
        .route(
            "/api/public/pages/:slug",
            get(handlers::site_pages::get_published_page_by_slug),
        )
        .route(
            "/api/public/pages/:slug/posts/:post_slug",
            get(handlers::site_pages::get_published_post_by_slug),
        )
        .route("/api/public/navigation", get(handlers::site_pages::get_navigation))
        .route(
            "/api/public/published-pages",
            get(handlers::site_pages::list_published_page_slugs),
        )

        // Health check
        .route("/api/health", get(|| async { "OK" }))
        
        .layer(RequestBodyLimitLayer::new(10 * 1024 * 1024)) // 10 MB limit
        .layer(cors)
        .layer(middleware::from_fn(security_headers))
        .with_state(pool);

    // Get port from environment or use default
    let port_str = env::var("PORT").unwrap_or_else(|_| "8489".to_string());
    let port: u16 = port_str.parse().unwrap_or_else(|e| {
        tracing::error!("Invalid PORT '{}': {}. Using default 8489", port_str, e);
        8489
    });
    
    if port < 1024 {
        tracing::warn!("PORT {} is in privileged range (< 1024). May require elevated permissions.", port);
    }
    
    let addr = format!("0.0.0.0:{}", port);
    
    tracing::info!("Starting server on {}", addr);

    // Start server
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("Failed to bind to address");
    
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
