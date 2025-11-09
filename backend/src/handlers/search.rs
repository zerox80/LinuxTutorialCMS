//! # Search Handler Module
//!
//! This module provides HTTP handlers for searching tutorials and retrieving related metadata
//! within the LinuxTutorialCMS. It implements a robust search system with the following features:
//!
//! ## Features
//! - **Full-text search**: Utilizes SQLite's FTS5 for efficient and relevant search results
//! - **Topic filtering**: Narrows down search results by specific topics
//! - **Content sanitization**: Cleans search queries to prevent injection attacks
//! - **Pagination**: Supports limiting the number of search results
//! - **Relevance ranking**: Orders results using the BM25 algorithm for better relevance
//!
//! ## API Endpoints
//! - `GET /search/tutorials` - Perform a full-text search across tutorials
//! - `GET /search/topics` - Retrieve a list of all unique tutorial topics
//!
//! ## Security Considerations
//! - All search queries are sanitized to remove potentially harmful characters
//! - Topic filters are escaped to prevent SQL injection in `LIKE` clauses
//! - Pagination limits are enforced to prevent DoS attacks
//! - Search logic uses parameterized queries to ensure database safety
//!
//! ## Performance Notes
//! - Full-text search is accelerated by SQLite's FTS5 virtual table
//! - Topic lookups are optimized with database indexes
//! - The number of returned results is limited to prevent excessive data transfer

use crate::{db::DbPool, models::*};
use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use std::convert::TryInto;

/// Query-string parameters accepted by `/api/search/tutorials`.
///
/// This struct defines the available query parameters for tutorial searches,
/// including the search query, an optional topic filter, and a result limit.
///
/// # Fields
/// - `q`: The full-text search query string (required)
/// - `topic`: An optional topic to filter the search results (case-insensitive)
/// - `limit`: The maximum number of results to return (default: 20, max: 100)
///
/// # Example Query String
/// ```
/// ?q=network+configuration&topic=networking&limit=10
/// ```
#[derive(Deserialize)]
pub struct SearchQuery {
    /// The raw search query string provided by the user.
    q: String,
    /// An optional topic to filter the search results.
    #[serde(default)]
    topic: Option<String>,
    /// The maximum number of results to return.
    #[serde(default = "default_limit")]
    limit: i64,
}

/// Returns the default result limit for search queries.
///
/// # Returns
/// `20` - The default maximum number of search results per request.
fn default_limit() -> i64 {
    20
}

/// Sanitizes a raw full-text search query for use with SQLite FTS5.
///
/// This function processes a user-provided search string to make it safe and
/// effective for FTS5 queries. It splits the query into tokens, sanitizes
/// each token to allow only alphanumeric characters and a few special symbols
/// (`*`, `-`, `_`), and then wraps each token in double quotes to treat them
/// as phrases. This prevents FTS5 syntax injection and improves search accuracy.
///
/// # Arguments
///
/// * `raw` - The raw search string from the user.
///
/// # Returns
///
/// A `Result` containing the sanitized FTS5 query string or an error if the
/// query is empty after sanitization.
fn sanitize_fts_query(raw: &str) -> Result<String, String> {
    let tokens: Vec<String> = raw
        .split_whitespace()
        .filter_map(|token| {
            let sanitized: String = token
                .chars()
                .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '*' | '-' | '_'))
                .collect();
            if sanitized.is_empty() {
                None
            } else {
                Some(format!("\"{}\"", sanitized))
            }
        })
        .collect();

    if tokens.is_empty() {
        Err("Search query must contain at least one searchable character".to_string())
    } else {
        Ok(tokens.join(" "))
    }
}

/// Escapes characters in a string for use in a SQL `LIKE` pattern.
///
/// This utility function escapes wildcard characters (`%`, `_`) and the escape
/// character itself (`\`) to allow literal matching of these characters when
/// using `LIKE`.
///
/// # Arguments
///
/// * `value` - The string to escape.
///
/// # Returns
///
/// An escaped string safe to use in a `LIKE` clause with `ESCAPE '\'`.
fn escape_like_pattern(value: &str) -> String {
    let mut escaped = String::with_capacity(value.len());
    for ch in value.chars() {
        match ch {
            '%' | '_' | '\\' => {
                escaped.push('\\');
                escaped.push(ch);
            }
            _ => escaped.push(ch),
        }
    }
    escaped
}

/// Performs a full-text search across tutorials.
///
/// This endpoint provides a powerful search capability over tutorial content,
/// including titles, descriptions, and topics. It sanitizes the user's query,
/// optionally filters by a specific topic, and returns a list of matching tutorials
/// ranked by relevance using SQLite's FTS5 `bm25` function.
///
/// # HTTP Endpoint
/// `GET /api/search/tutorials`
///
/// # Query Parameters
/// - `q` (required): The search term(s).
/// - `topic` (optional): A topic to narrow down the search.
/// - `limit` (optional): The maximum number of results to return (default 20, max 100).
///
/// # Returns
///
/// A JSON array of `TutorialResponse` objects, ranked by relevance, or an error response.
///
/// # Example Usage
/// ```bash
/// curl "http://localhost:8489/api/search/tutorials?q=bash+scripting&topic=automation&limit=5"
/// ```
pub async fn search_tutorials(
    State(pool): State<DbPool>,
    Query(params): Query<SearchQuery>,
) -> Result<Json<Vec<TutorialResponse>>, (StatusCode, Json<ErrorResponse>)> {
    // Validate query
    if params.q.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Search query cannot be empty".to_string(),
            }),
        ));
    }

    if params.q.len() > 500 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Search query too long".to_string(),
            }),
        ));
    }

    let limit = params.limit.min(100).max(1);

    let search_query = sanitize_fts_query(params.q.trim())
        .map_err(|err| (StatusCode::BAD_REQUEST, Json(ErrorResponse { error: err })))?;

    let topic_pattern = params.topic.as_ref().and_then(|topic| {
        let trimmed = topic.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(format!("%{}%", escape_like_pattern(trimmed)))
        }
    });

    let tutorials = if let Some(pattern) = topic_pattern {
        sqlx::query_as::<_, Tutorial>(
            r#"
            SELECT t.* FROM tutorials t
            INNER JOIN tutorials_fts fts ON t.id = fts.tutorial_id
            WHERE fts MATCH ?
            AND t.topics LIKE ? ESCAPE '\\'
            ORDER BY bm25(fts)
            LIMIT ?
            "#,
        )
        .bind(&search_query)
        .bind(&pattern)
        .bind(limit)
        .fetch_all(&pool)
        .await
    } else {
        sqlx::query_as::<_, Tutorial>(
            r#"
            SELECT t.* FROM tutorials t
            INNER JOIN tutorials_fts fts ON t.id = fts.tutorial_id
            WHERE fts MATCH ?
            ORDER BY bm25(fts)
            LIMIT ?
            "#,
        )
        .bind(&search_query)
        .bind(limit)
        .fetch_all(&pool)
        .await
    }
    .map_err(|e| {
        tracing::error!("Search error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to search tutorials".to_string(),
            }),
        )
    })?;

    let mut responses = Vec::with_capacity(tutorials.len());
    for tutorial in tutorials {
        let response: TutorialResponse = tutorial.try_into().map_err(|err: String| {
            tracing::error!("Tutorial data corruption detected: {}", err);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to parse tutorial data".to_string(),
                }),
            )
        })?;
        responses.push(response);
    }

    Ok(Json(responses))
}

/// Retrieves a list of all unique topics from the database.
///
/// This endpoint provides a way to discover all available topics that tutorials
/// are tagged with. The topics are returned as a sorted, unique list of strings,
/// which is useful for building topic filters in a user interface.
///
/// # HTTP Endpoint
/// `GET /api/search/topics`
///
/// # Returns
///
/// A JSON array of strings, where each string is a unique topic, sorted alphabetically.
///
/// # Example Usage
/// ```bash
/// curl "http://localhost:8489/api/search/topics"
/// ```
///
/// # Example Response
/// ```json
/// [
///   "automation",
///   "bash",
///   "networking",
///   "security",
///   "scripting"
/// ]
/// ```
pub async fn get_all_topics(
    State(pool): State<DbPool>,
) -> Result<Json<Vec<String>>, (StatusCode, Json<ErrorResponse>)> {
    let topics: Vec<(String,)> =
        sqlx::query_as("SELECT DISTINCT topic FROM tutorial_topics ORDER BY topic ASC")
            .fetch_all(&pool)
            .await
            .map_err(|e| {
                tracing::error!("Failed to fetch topics: {}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ErrorResponse {
                        error: "Failed to fetch topics".to_string(),
                    }),
                )
            })?;

    Ok(Json(topics.into_iter().map(|(t,)| t).collect()))
}
