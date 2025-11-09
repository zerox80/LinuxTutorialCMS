

use crate::{db::DbPool, models::*};
use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use std::convert::TryInto;

#[derive(Deserialize)]
pub struct SearchQuery {
    q: String,

    #[serde(default)]
    topic: Option<String>,

    #[serde(default = "default_limit")]
    limit: i64,
}

fn default_limit() -> i64 {
    20
}

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
