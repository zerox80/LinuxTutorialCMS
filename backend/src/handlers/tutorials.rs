use crate::{auth, db::DbPool, models::*};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use regex::Regex;
use std::convert::TryInto;
use std::sync::OnceLock;
use uuid::Uuid;

// Input validation
fn validate_tutorial_id(id: &str) -> Result<(), String> {
    // UUID format or numeric ID
    if id.is_empty() || id.len() > 100 {
        return Err("Invalid tutorial ID".to_string());
    }
    // Allow alphanumeric and hyphens (for UUIDs)
    if !id.chars().all(|c| c.is_alphanumeric() || c == '-') {
        return Err("Tutorial ID contains invalid characters".to_string());
    }
    Ok(())
}

fn validate_tutorial_data(title: &str, description: &str, content: &str) -> Result<(), String> {
    if title.is_empty() {
        return Err("Title cannot be empty".to_string());
    }
    if title.len() > 200 {
        return Err("Title too long (max 200 characters)".to_string());
    }
    if description.is_empty() {
        return Err("Description cannot be empty".to_string());
    }
    if description.len() > 1000 {
        return Err("Description too long (max 1000 characters)".to_string());
    }
    if content.len() > 100_000 {
        return Err("Content too long (max 100,000 characters)".to_string());
    }
    Ok(())
}

fn validate_icon(icon: &str) -> Result<(), String> {
    const ALLOWED_ICONS: &[&str] = &[
        "Terminal", "FolderTree", "FileText", "Settings",
        "Shield", "Network", "Database", "Server"
    ];
    
    if ALLOWED_ICONS.contains(&icon) {
        Ok(())
    } else {
        Err(format!("Invalid icon '{}'. Must be one of: {:?}", icon, ALLOWED_ICONS))
    }
}

fn validate_color(color: &str) -> Result<(), String> {
    static COLOR_REGEX: OnceLock<Regex> = OnceLock::new();
    let regex = COLOR_REGEX.get_or_init(|| {
        Regex::new(r"^from-[A-Za-z0-9-]+(?:\s+via-[A-Za-z0-9-]+)?\s+to-[A-Za-z0-9-]+$")
            .expect("Failed to compile gradient regex")
    });

    if regex.is_match(color) {
        Ok(())
    } else {
        Err("Invalid color gradient. Expected Tailwind style 'from-… [via-…] to-…' format.".to_string())
    }
}

fn sanitize_topics(topics: &[String]) -> Result<Vec<String>, String> {
    if topics.len() > 20 {
        return Err("Too many topics (max 20)".to_string());
    }

    let sanitized: Vec<String> = topics
        .iter()
        .map(|topic| topic.trim())
        .filter(|topic| !topic.is_empty())
        .map(|topic| {
            // Validate individual topic length
            if topic.len() > 100 {
                topic.chars().take(100).collect()
            } else {
                topic.to_string()
            }
        })
        .collect();

    if sanitized.is_empty() {
        return Err("At least one topic is required".to_string());
    }

    Ok(sanitized)
}

pub async fn list_tutorials(
    State(pool): State<DbPool>,
) -> Result<Json<Vec<TutorialResponse>>, (StatusCode, Json<ErrorResponse>)> {
    let tutorials = sqlx::query_as::<_, Tutorial>(
        "SELECT * FROM tutorials ORDER BY created_at ASC"
    )
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

    let mut responses = Vec::with_capacity(tutorials.len());
    for tutorial in tutorials {
        let response: TutorialResponse = tutorial
            .try_into()
            .map_err(|err: String| {
                tracing::error!("Tutorial data corruption detected: {}", err);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ErrorResponse {
                        error: "Failed to parse stored tutorial data".to_string(),
                    }),
                )
            })?;
        responses.push(response);
    }

    Ok(Json(responses))
}

pub async fn get_tutorial(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
) -> Result<Json<TutorialResponse>, (StatusCode, Json<ErrorResponse>)> {
    // Validate ID
    if let Err(e) = validate_tutorial_id(&id) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse { error: e }),
        ));
    }

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

    let response: TutorialResponse = tutorial.try_into().map_err(|err: String| {
        tracing::error!("Tutorial data corruption detected: {}", err);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to parse stored tutorial data".to_string(),
            }),
        )
    })?;

    Ok(Json(response))
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

    // Validate input
    if let Err(e) = validate_tutorial_data(&payload.title, &payload.description, &payload.content) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse { error: e }),
        ));
    }
    
    // Validate icon and color
    if let Err(e) = validate_icon(&payload.icon) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse { error: e }),
        ));
    }
    if let Err(e) = validate_color(&payload.color) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse { error: e }),
        ));
    }

    let id = Uuid::new_v4().to_string();
    let sanitized_topics = sanitize_topics(&payload.topics).map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse { error: e }),
        )
    })?;
    let topics_json = serde_json::to_string(&sanitized_topics).map_err(|e| {
        tracing::error!("Failed to serialize topics: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to create tutorial".to_string(),
            }),
        )
    })?;
    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        r#"
        INSERT INTO tutorials (id, title, description, icon, color, topics, content, version, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
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
        topics: sanitized_topics,
        content: payload.content,
        version: 1,
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

    // Validate ID
    if let Err(e) = validate_tutorial_id(&id) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse { error: e }),
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

    let title = payload.title.unwrap_or(tutorial.title.clone());
    let description = payload.description.unwrap_or(tutorial.description.clone());
    let icon = payload.icon.unwrap_or(tutorial.icon);
    let color = payload.color.unwrap_or(tutorial.color);
    let content = payload.content.unwrap_or(tutorial.content);

    // Validate updated data
    if let Err(e) = validate_tutorial_data(&title, &description, &content) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse { error: e }),
        ));
    }
    
    // Validate icon and color
    if let Err(e) = validate_icon(&icon) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse { error: e }),
        ));
    }
    if let Err(e) = validate_color(&color) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse { error: e }),
        ));
    }
    // Check for version overflow (extremely unlikely but theoretically possible)
    let new_version = tutorial.version.checked_add(1).ok_or_else(|| {
        tracing::error!("Tutorial version overflow for id: {}", id);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Tutorial version overflow".to_string(),
            }),
        )
    })?;
    
    let (topics_json, topics_vec) = if let Some(t) = payload.topics {
        let sanitized = sanitize_topics(&t).map_err(|e| {
            (
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse { error: e }),
            )
        })?;

        let serialized = serde_json::to_string(&sanitized).map_err(|e| {
            tracing::error!("Failed to serialize topics: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to update tutorial".to_string(),
                }),
            )
        })?;

        (serialized, sanitized)
    } else {
        let existing_topics: Vec<String> = serde_json::from_str(&tutorial.topics).map_err(|e| {
            tracing::error!(
                "Failed to deserialize topics for tutorial {}: {}",
                tutorial.id, e
            );
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to read stored tutorial topics".to_string(),
                }),
            )
        })?;
        let serialized = serde_json::to_string(&existing_topics).map_err(|e| {
            tracing::error!("Failed to serialize topics: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to update tutorial".to_string(),
                }),
            )
        })?;
        (serialized, existing_topics)
    };
    let now = chrono::Utc::now().to_rfc3339();

    // Optimistic locking: update only if version hasn't changed
    let result = sqlx::query(
        r#"
        UPDATE tutorials
        SET title = ?, description = ?, icon = ?, color = ?, topics = ?, content = ?, version = ?, updated_at = ?
        WHERE id = ? AND version = ?
        "#,
    )
    .bind(&title)
    .bind(&description)
    .bind(&icon)
    .bind(&color)
    .bind(&topics_json)
    .bind(&content)
    .bind(new_version)
    .bind(&now)
    .bind(&id)
    .bind(tutorial.version)
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
    
    // Check if the update actually happened (optimistic lock check)
    if result.rows_affected() == 0 {
        return Err((
            StatusCode::CONFLICT,
            Json(ErrorResponse {
                error: "Tutorial was modified by another request. Please refresh and try again.".to_string(),
            }),
        ));
    }

    Ok(Json(TutorialResponse {
        id,
        title,
        description,
        icon,
        color,
        topics: topics_vec,
        content,
        version: new_version,
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

    // Validate ID
    if let Err(e) = validate_tutorial_id(&id) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse { error: e }),
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
