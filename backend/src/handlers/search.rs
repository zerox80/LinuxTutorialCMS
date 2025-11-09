

/**
 * Full-Text Search Handlers Module
 *
 * This module provides comprehensive search functionality for tutorials using SQLite FTS5.
 * It handles tutorial searches, topic discovery, and search query sanitization.
 *
 * Features:
 * - Full-text search with FTS5 virtual tables
 * - Topic-based filtering and discovery
 * - Query sanitization to prevent injection attacks
 * - Configurable result limits and pagination
 * - Relevance-based result ranking
 *
 * Security:
 * - SQL injection prevention through query sanitization
 * - Input validation and size limits
 * - Safe FTS query construction
 * - Proper error handling without information leakage
 *
 * Performance:
 * - FTS5 indexing for fast text search
 * - Efficient database queries
 * - Configurable result limits to prevent resource exhaustion
 */

use crate::{db::DbPool, models::*};
use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use std::convert::TryInto;

/// Search query parameters for tutorial search endpoint.
///
/// This struct represents the query parameters accepted by the search endpoint.
/// It supports full-text search with optional topic filtering and result limiting.
///
/// # Fields
/// - `q`: Search query string (required, trimmed)
/// - `topic`: Optional topic filter for narrowing results
/// - `limit`: Maximum number of results to return (default: 20, max: 100)
///
/// # Usage Example
/// ```
/// GET /api/search/tutorials?q=linux%20commands&topic=basics&limit=10
/// ```
#[derive(Deserialize)]
pub struct SearchQuery {
    /// Search query string for full-text search
    /// Will be trimmed and sanitized before processing
    q: String,

    /// Optional topic filter to narrow search results
    /// Must match tutorial topics exactly
    #[serde(default)]
    topic: Option<String>,

    /// Maximum number of results to return
    /// Defaults to 20, capped at 100 to prevent resource exhaustion
    #[serde(default = "default_limit")]
    limit: i64,
}

/// Returns the default search result limit.
///
/// Provides a sensible default that balances user experience
/// with system resource usage.
fn default_limit() -> i64 {
    20
}

/// Sanitizes and prepares a search query for safe FTS5 usage.
///
/// This function cleans user input to prevent FTS injection attacks while
/// preserving search functionality. It removes dangerous characters and
/// formats the query for SQLite FTS5.
///
/// # Arguments
/// * `raw` - Raw user search query
///
/// # Returns
/// Ok(String) with sanitized FTS query, Err(String) if no valid content
///
/// # Security Features
/// - Removes all non-alphanumeric characters except *, -, _
/// - Wraps each token in quotes for exact phrase matching
/// - Prevents FTS syntax injection attacks
/// - Ensures query has searchable content
///
/// # Example
/// Input: "linux commands -advanced*"
/// Output: "\"linux\" \"commands\" \"-advanced*\""
fn sanitize_fts_query(raw: &str) -> Result<String, String> {
    let tokens: Vec<String> = raw
        .split_whitespace()
        .filter_map(|token| {
            // Keep only safe characters for FTS5 queries
            let sanitized: String = token
                .chars()
                .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '*' | '-' | '_'))
                .collect();
            if sanitized.is_empty() {
                None
            } else {
                // Wrap each token in quotes for safe FTS usage
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

/// Escapes special characters for SQL LIKE pattern matching.
///
/// This function escapes SQL LIKE wildcard characters to prevent pattern
/// injection when using LIKE clauses for topic filtering.
///
/// # Arguments
/// * `value` - String to escape for LIKE pattern
///
/// # Returns
/// Escaped string safe for use in SQL LIKE clauses
///
/// # Security Notes
/// - Escapes % (percent) wildcard matches zero or more characters
/// - Escapes _ (underscore) wildcard matches exactly one character
/// - Escapes \ (backslash) escape character
/// - Prevents pattern injection attacks in LIKE queries
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

pub async fn search_tutorials(
    State(pool): State<DbPool>,
    Query(params): Query<SearchQuery>,
) -> Result<Json<Vec<TutorialResponse>>, (StatusCode, Json<ErrorResponse>)> {

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
