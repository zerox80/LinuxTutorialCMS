mod auth;
mod db;
mod handlers;
mod models;

use axum::{
    body::Body,
    extract::Request,
    middleware::{self, Next},
    response::Response,
    routing::{delete, get, post, put},
    Router,
};
use dotenv::dotenv;
use std::env;
use http::{
    header::{AUTHORIZATION, CONTENT_TYPE, CONTENT_SECURITY_POLICY, STRICT_TRANSPORT_SECURITY, X_CONTENT_TYPE_OPTIONS, X_FRAME_OPTIONS},
    HeaderValue, Method, StatusCode,
};
use tower_http::cors::{AllowHeaders, AllowMethods, AllowOrigin, CorsLayer};
use tower_http::limit::RequestBodyLimitLayer;
use tower_governor::{GovernorConfigBuilder, governor::GovernorConfig};
use std::time::Duration;
use tracing_subscriber;

// Security headers middleware
async fn security_headers(
    request: Request,
    next: Next,
) -> Response {
    let mut response = next.run(request).await;
    let headers = response.headers_mut();
    
    // Content Security Policy
    headers.insert(
        CONTENT_SECURITY_POLICY,
        HeaderValue::from_static("default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;"),
    );
    
    // HSTS - Enforce HTTPS
    headers.insert(
        STRICT_TRANSPORT_SECURITY,
        HeaderValue::from_static("max-age=31536000; includeSubDomains"),
    );
    
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
    db::run_migrations(&pool).await.expect("Failed to run migrations");

    // Configure CORS
    let allowed_origins_env = env::var("FRONTEND_ORIGINS").unwrap_or_else(|_| {
        "http://localhost:5173,http://localhost:3000".to_string()
    });
    let mut allowed_origins: Vec<HeaderValue> = allowed_origins_env
        .split(',')
        .filter_map(|origin| {
            let trimmed = origin.trim();
            if trimmed.is_empty() {
                return None;
            }
            match HeaderValue::from_str(trimmed) {
                Ok(value) => Some(value),
                Err(err) => {
                    tracing::warn!("Ignoring invalid origin '{trimmed}': {err}");
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

    // Configure rate limiting (5 requests per 60 seconds for login)
    let rate_limit_config = Box::new(
        GovernorConfigBuilder::default()
            .per_second(60)
            .burst_size(5)
            .finish()
            .unwrap(),
    );

    // Build application routes
    // Login route with rate limiting
    let login_router = Router::new()
        .route("/api/auth/login", post(handlers::auth::login))
        .layer(tower_governor::GovernorLayer {
            config: rate_limit_config,
        });
    
    let app = Router::new()
        .merge(login_router)
        // Auth routes
        .route("/api/auth/me", get(handlers::auth::me))
        
        // Tutorial routes
        .route("/api/tutorials", get(handlers::tutorials::list_tutorials))
        .route("/api/tutorials", post(handlers::tutorials::create_tutorial))
        .route("/api/tutorials/:id", get(handlers::tutorials::get_tutorial))
        .route("/api/tutorials/:id", put(handlers::tutorials::update_tutorial))
        .route("/api/tutorials/:id", delete(handlers::tutorials::delete_tutorial))
        
        // Health check
        .route("/api/health", get(|| async { "OK" }))
        .route("/health", get(|| async { "OK" }))
        
        .layer(cors)
        .layer(RequestBodyLimitLayer::new(10 * 1024 * 1024)) // 10 MB limit
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
        
    axum::serve(listener, app)
        .await
        .expect("Failed to start server");
}
