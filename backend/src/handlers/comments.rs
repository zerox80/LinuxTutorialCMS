use crate::{auth, db::DbPool, handlers::tutorials::validate_tutorial_id, models::*};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use std::{env, sync::OnceLock};

/// Payload accepted when an admin submits a new tutorial comment via the API.
///
/// Field validations (trimmed, max length) happen inside `create_comment`.
#[derive(Deserialize)]
pub struct CreateCommentRequest {
    content: String,
}

/// Pagination parameters understood by `list_comments`.
#[derive(Deserialize)]
pub struct CommentListQuery {
    #[serde(default = "default_comment_limit")]
    limit: i64,
    #[serde(default)]
    offset: i64,
}

fn default_comment_limit() -> i64 {
    50
}

/// Database row/JSON payload for a persisted comment.
#[derive(Serialize, sqlx::FromRow)]
pub struct Comment {
    pub id: String,
    pub tutorial_id: String,
    pub author: String,
    pub content: String,
    pub created_at: String,
}

fn comment_author_display_name(claims: &auth::Claims) -> String {
    static DISPLAY_NAME: OnceLock<Option<String>> = OnceLock::new();

    let configured = DISPLAY_NAME.get_or_init(|| {
        env::var("COMMENT_AUTHOR_DISPLAY_NAME")
            .ok()
            .and_then(|value| {
                let trimmed = value.trim();
                if trimmed.is_empty() {
                    None
                } else {
                    Some(trimmed.to_string())
                }
            })
    });

    configured
        .as_ref()
        .cloned()
        .unwrap_or_else(|| claims.sub.clone())
}

fn sanitize_comment_content(raw: &str) -> Result<String, (StatusCode, Json<ErrorResponse>)> {
    let trimmed = raw.trim();

    if trimmed.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Comment content cannot be empty".to_string(),
            }),
        ));
    }

    if trimmed.len() > 1_000 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Comment too long (max 1000 characters)".to_string(),
            }),
        ));
    }

    let sanitized: String = trimmed
        .chars()
        .filter(|c| match c {
            '\n' | '\r' | '\t' => true,
            c if c.is_control() => false,
            _ => true,
        })
        .collect();

    Ok(sanitized)
}

/// Lists all comments for a specific tutorial, with pagination.
///
/// # Arguments
///
/// * `State(pool)` - Database pool used to execute comment queries.
/// * `Path(tutorial_id)` - ID of the tutorial whose comments should be listed.
/// * `Query(params)` - Pagination parameters (`limit` and `offset`).
///
/// # Returns
///
/// A JSON array of comments or an error tuple with status and payload.
pub async fn list_comments(
    State(pool): State<DbPool>,
    Path(tutorial_id): Path<String>,
    Query(params): Query<CommentListQuery>,
) -> Result<Json<Vec<Comment>>, (StatusCode, Json<ErrorResponse>)> {
    if let Err(e) = validate_tutorial_id(&tutorial_id) {
        return Err((StatusCode::BAD_REQUEST, Json(ErrorResponse { error: e })));
    }

    let exists: Option<(i64,)> = sqlx::query_as("SELECT 1 FROM tutorials WHERE id = ? LIMIT 1")
        .bind(&tutorial_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to verify tutorial existence for comments: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to fetch comments".to_string(),
                }),
            )
        })?;

    if exists.is_none() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "Tutorial not found".to_string(),
            }),
        ));
    }

    let limit = params.limit.clamp(1, 200);
    let offset = params.offset.max(0);

    let comments = sqlx::query_as::<_, Comment>(
        "SELECT id, tutorial_id, author, content, created_at \
         FROM comments WHERE tutorial_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
    )
    .bind(&tutorial_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to fetch comments".to_string(),
            }),
        )
    })?;

    Ok(Json(comments))
}

/// Creates a new comment for a tutorial. (Admin only)
///
/// # Arguments
///
/// * `claims` - Authenticated user claims, used to enforce admin-only access.
/// * `State(pool)` - Database pool.
/// * `Path(tutorial_id)` - ID of the tutorial to attach the comment to.
/// * `Json(payload)` - Comment body payload.
///
/// # Returns
///
/// JSON representation of the created comment or an error tuple.
pub async fn create_comment(
    claims: auth::Claims,
    State(pool): State<DbPool>,
    Path(tutorial_id): Path<String>,
    Json(payload): Json<CreateCommentRequest>,
) -> Result<Json<Comment>, (StatusCode, Json<ErrorResponse>)> {
    if claims.role != "admin" {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "Insufficient permissions".to_string(),
            }),
        ));
    }

    if let Err(e) = validate_tutorial_id(&tutorial_id) {
        return Err((StatusCode::BAD_REQUEST, Json(ErrorResponse { error: e })));
    }

    let exists: Option<(i64,)> = sqlx::query_as("SELECT 1 FROM tutorials WHERE id = ? LIMIT 1")
        .bind(&tutorial_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| {
            tracing::error!(
                "Failed to verify tutorial existence before comment creation: {}",
                e
            );
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to create comment".to_string(),
                }),
            )
        })?;

    if exists.is_none() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "Tutorial not found".to_string(),
            }),
        ));
    }

    let comment_content = sanitize_comment_content(&payload.content)?;
    let author = comment_author_display_name(&claims);

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO comments (id, tutorial_id, author, content, created_at) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&tutorial_id)
    .bind(&author)
    .bind(&comment_content)
    .bind(&now)
    .execute(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to create comment".to_string(),
            }),
        )
    })?;

    Ok(Json(Comment {
        id,
        tutorial_id,
        author,
        content: comment_content,
        created_at: now,
    }))
}

/// Deletes a comment by its ID. (Admin only)
///
/// # Arguments
///
/// * `claims` - Authenticated user claims, used to enforce admin-only access.
/// * `State(pool)` - Database pool.
/// * `Path(id)` - Identifier of the comment to delete.
///
/// # Returns
///
/// `StatusCode::NO_CONTENT` on success or an error tuple.
pub async fn delete_comment(
    claims: auth::Claims,
    State(pool): State<DbPool>,
    Path(id): Path<String>,
) -> Result<StatusCode, (StatusCode, Json<ErrorResponse>)> {
    if claims.role != "admin" {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "Insufficient permissions".to_string(),
            }),
        ));
    }

    let result = sqlx::query("DELETE FROM comments WHERE id = ?")
        .bind(&id)
        .execute(&pool)
        .await
        .map_err(|e| {
            tracing::error!("Database error: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to delete comment".to_string(),
                }),
            )
        })?;

    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "Comment not found".to_string(),
            }),
        ));
    }

    Ok(StatusCode::NO_CONTENT)
}
