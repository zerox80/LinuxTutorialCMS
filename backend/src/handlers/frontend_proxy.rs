use axum::{
    extract::State,
    response::{Html, IntoResponse},
};
use reqwest::Client;
use std::env;
use crate::db;

// Default frontend URL (internal Docker network)
const DEFAULT_FRONTEND_URL: &str = "http://frontend";

pub async fn serve_index(State(pool): State<db::DbPool>) -> impl IntoResponse {
    let frontend_url = env::var("FRONTEND_URL").unwrap_or_else(|_| DEFAULT_FRONTEND_URL.to_string());
    let index_url = format!("{}/index.html", frontend_url);

    // Fetch index.html from frontend container
    let client = Client::new();
    let html_content = match client.get(&index_url).send().await {
        Ok(resp) => match resp.text().await {
            Ok(text) => text,
            Err(e) => {
                tracing::error!("Failed to read index.html body: {}", e);
                return Html("<h1>Internal Server Error</h1><p>Failed to load application.</p>".to_string()).into_response();
            }
        },
        Err(e) => {
            tracing::error!("Failed to fetch index.html from {}: {}", index_url, e);
            return Html("<h1>Internal Server Error</h1><p>Failed to connect to frontend service.</p>".to_string()).into_response();
        }
    };

    // Fetch site meta from DB
    let site_meta = match db::fetch_site_content_by_section(&pool, "site_meta").await {
        Ok(Some(record)) => {
            match serde_json::from_str::<serde_json::Value>(&record.content_json) {
                Ok(json) => json,
                Err(_) => serde_json::json!({}),
            }
        },
        _ => serde_json::json!({}),
    };

    let title = site_meta.get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("Linux Tutorial - Lerne Linux Schritt für Schritt");
    
    let description = site_meta.get("description")
        .and_then(|v| v.as_str())
        .unwrap_or("Lerne Linux von Grund auf - Interaktiv, modern und praxisnah.");

    // Inject meta tags using simple string replacement
    // We target the specific default tags to replace them
    let mut injected_html = html_content;

    // Replace Title
    injected_html = injected_html.replace(
        "<title>Linux Tutorial - Lerne Linux Schritt für Schritt</title>",
        &format!("<title>{}</title>", title)
    );

    // Replace Meta Description
    // Note: This regex-like replacement is brittle if the HTML formatting changes. 
    // For now, we assume the exact string from index.html or use a more robust regex if needed.
    // Since we don't have regex crate here yet, we'll try to replace the known default description.
    // If it's dynamic, we might need a more robust approach, but for now let's try replacing the known default.
    let default_desc = "Lerne Linux von Grund auf - Interaktiv, modern und praxisnah. Umfassende Tutorials für Einsteiger und Fortgeschrittene.";
    injected_html = injected_html.replace(
        &format!("content=\"{}\"", default_desc),
        &format!("content=\"{}\"", description)
    );

    // Also replace OG tags if possible. 
    // A better approach for robust replacement without full HTML parsing:
    // We can replace the whole <head> block or specific known lines if we are sure about the structure.
    // Given the index.html structure, we can try to replace specific lines.
    
    // Replace OG Title
    injected_html = injected_html.replace(
        "content=\"Linux Tutorial - Lerne Linux Schritt für Schritt\"",
        &format!("content=\"{}\"", title)
    );

    // Replace OG Description (reusing the description replacement above might handle this if content matches)
    // The default OG description in index.html is shorter: "Lerne Linux von Grund auf - Interaktiv, modern und praxisnah."
    let default_og_desc = "Lerne Linux von Grund auf - Interaktiv, modern und praxisnah.";
    injected_html = injected_html.replace(
        &format!("content=\"{}\"", default_og_desc),
        &format!("content=\"{}\"", description)
    );

    Html(injected_html).into_response()
}
