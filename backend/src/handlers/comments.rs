use crate::{auth, db::DbPool, models::*, handlers::tutorials::validate_tutorial_id};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct CreateCommentRequest {
    content: String,
}

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

#[derive(Serialize, sqlx::FromRow)]
pub struct Comment {
    pub id: String,
    pub tutorial_id: String,
    pub author: String,
    pub content: String,
    pub created_at: String,
}

pub async fn list_comments(
    State(pool): State<DbPool>,
    Path(tutorial_id): Path<String>,
    Query(params): Query<CommentListQuery>,
) -> Result<Json<Vec<Comment>>, (StatusCode, Json<ErrorResponse>)> {
    if let Err(e) = validate_tutorial_id(&tutorial_id) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: e,
            }),
        ));
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
         FROM comments WHERE tutorial_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
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

pub async fn create_comment(
    claims: auth::Claims,
    State(pool): State<DbPool>,
    Path(tutorial_id): Path<String>,
    Json(payload): Json<CreateCommentRequest>,
) -> Result<Json<Comment>, (StatusCode, Json<ErrorResponse>)> {
    if let Err(e) = validate_tutorial_id(&tutorial_id) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: e,
            }),
        ));
    }

    let exists: Option<(i64,)> = sqlx::query_as("SELECT 1 FROM tutorials WHERE id = ? LIMIT 1")
        .bind(&tutorial_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to verify tutorial existence before comment creation: {}", e);
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

    // Validate content
    if payload.content.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Comment content cannot be empty".to_string(),
            }),
        ));
    }

    if payload.content.len() > 1000 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Comment too long (max 1000 characters)".to_string(),
            }),
        ));
    }

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO comments (id, tutorial_id, author, content, created_at) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&tutorial_id)
    .bind(&claims.sub)
    .bind(&payload.content)
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
        author: claims.sub,
        content: payload.content,
        created_at: now,
    }))
}

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
