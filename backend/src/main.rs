mod auth;
mod db;
mod handlers;
mod models;

use axum::{
    routing::{delete, get, post, put},
    Router,
};
use dotenv::dotenv;
use std::env;
use http::{
    header::{AUTHORIZATION, CONTENT_TYPE},
    HeaderValue, Method,
};
use tower_http::cors::{AllowHeaders, AllowMethods, AllowOrigin, CorsLayer};
use tracing_subscriber;

#[tokio::main]
async fn main() {
    // Load environment variables
    dotenv().ok();
    
    // Initialize tracing
    tracing_subscriber::fmt::init();

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

    // Build application routes
    let app = Router::new()
        // Auth routes
        .route("/api/auth/login", post(handlers::auth::login))
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
        .with_state(pool);

    // Get port from environment or use default
    let port = env::var("PORT").unwrap_or_else(|_| "8489".to_string());
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
