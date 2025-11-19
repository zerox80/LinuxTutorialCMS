use axum::http::HeaderValue;

// Default CORS origins for development environment
pub const DEV_DEFAULT_FRONTEND_ORIGINS: &[&str] =
    &["http://localhost:5173", "http://localhost:3000"];

/// Parses and validates a list of allowed CORS origins.
pub fn parse_allowed_origins<'a, I>(origins: I) -> Vec<HeaderValue>
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
