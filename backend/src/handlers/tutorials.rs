use crate::{auth, db::DbPool, models::*};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use uuid::Uuid;

pub async fn list_tutorials(
    State(pool): State<DbPool>,
) -> Result<Json<Vec<TutorialResponse>>, (StatusCode, Json<ErrorResponse>)> {
    let tutorials = sqlx::query_as::<_, Tutorial>("SELECT * FROM tutorials ORDER BY created_at ASC")
        .fetch_all(&pool)
        .await
        .map_err(|e| {
            tracing::error!("Database error: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to fetch tutorials".to_string(),
                }),
            )
        })?;

    let response: Vec<TutorialResponse> = tutorials.into_iter().map(|t| t.into()).collect();

    Ok(Json(response))
}

pub async fn get_tutorial(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
) -> Result<Json<TutorialResponse>, (StatusCode, Json<ErrorResponse>)> {
    let tutorial = sqlx::query_as::<_, Tutorial>("SELECT * FROM tutorials WHERE id = ?")
        .bind(&id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| {
            tracing::error!("Database error: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to fetch tutorial".to_string(),
                }),
            )
        })?;

    let tutorial = tutorial.ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "Tutorial not found".to_string(),
            }),
        )
    })?;

    Ok(Json(tutorial.into()))
}

pub async fn create_tutorial(
    claims: auth::Claims,
    State(pool): State<DbPool>,
    Json(payload): Json<CreateTutorialRequest>,
) -> Result<Json<TutorialResponse>, (StatusCode, Json<ErrorResponse>)> {
    // Check if user is admin
    if claims.role != "admin" {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "Insufficient permissions".to_string(),
            }),
        ));
    }

    let id = Uuid::new_v4().to_string();
    let topics_json = serde_json::to_string(&payload.topics).unwrap_or_else(|_| "[]".to_string());
    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        r#"
        INSERT INTO tutorials (id, title, description, icon, color, topics, content, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&payload.title)
    .bind(&payload.description)
    .bind(&payload.icon)
    .bind(&payload.color)
    .bind(&topics_json)
    .bind(&payload.content)
    .bind(&now)
    .bind(&now)
    .execute(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to create tutorial".to_string(),
            }),
        )
    })?;

    Ok(Json(TutorialResponse {
        id,
        title: payload.title,
        description: payload.description,
        icon: payload.icon,
        color: payload.color,
        topics: payload.topics,
        content: payload.content,
        created_at: now.clone(),
        updated_at: now,
    }))
}

pub async fn update_tutorial(
    claims: auth::Claims,
    State(pool): State<DbPool>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateTutorialRequest>,
) -> Result<Json<TutorialResponse>, (StatusCode, Json<ErrorResponse>)> {
    // Check if user is admin
    if claims.role != "admin" {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "Insufficient permissions".to_string(),
            }),
        ));
    }

    // Fetch existing tutorial
    let tutorial = sqlx::query_as::<_, Tutorial>("SELECT * FROM tutorials WHERE id = ?")
        .bind(&id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| {
            tracing::error!("Database error: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to fetch tutorial".to_string(),
                }),
            )
        })?
        .ok_or_else(|| {
            (
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: "Tutorial not found".to_string(),
                }),
            )
        })?;

    let title = payload.title.unwrap_or(tutorial.title);
    let description = payload.description.unwrap_or(tutorial.description);
    let icon = payload.icon.unwrap_or(tutorial.icon);
    let color = payload.color.unwrap_or(tutorial.color);
    let topics = if let Some(t) = payload.topics {
        serde_json::to_string(&t).unwrap_or(tutorial.topics)
    } else {
        tutorial.topics
    };
    let content = payload.content.unwrap_or(tutorial.content);
    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        r#"
        UPDATE tutorials
        SET title = ?, description = ?, icon = ?, color = ?, topics = ?, content = ?, updated_at = ?
        WHERE id = ?
        "#,
    )
    .bind(&title)
    .bind(&description)
    .bind(&icon)
    .bind(&color)
    .bind(&topics)
    .bind(&content)
    .bind(&now)
    .bind(&id)
    .execute(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to update tutorial".to_string(),
            }),
        )
    })?;

    let topics_vec: Vec<String> = serde_json::from_str(&topics).unwrap_or_default();

    Ok(Json(TutorialResponse {
        id,
        title,
        description,
        icon,
        color,
        topics: topics_vec,
        content,
        created_at: tutorial.created_at,
        updated_at: now,
    }))
}

pub async fn delete_tutorial(
    claims: auth::Claims,
    State(pool): State<DbPool>,
    Path(id): Path<String>,
) -> Result<StatusCode, (StatusCode, Json<ErrorResponse>)> {
    // Check if user is admin
    if claims.role != "admin" {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "Insufficient permissions".to_string(),
            }),
        ));
    }

    let result = sqlx::query("DELETE FROM tutorials WHERE id = ?")
        .bind(&id)
        .execute(&pool)
        .await
        .map_err(|e| {
            tracing::error!("Database error: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to delete tutorial".to_string(),
                }),
            )
        })?;

    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "Tutorial not found".to_string(),
            }),
        ));
    }

    Ok(StatusCode::NO_CONTENT)
}
