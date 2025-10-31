use crate::{
    auth,
    db,
    models::{ErrorResponse, SiteContentListResponse, SiteContentResponse, UpdateSiteContentRequest},
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde_json::Value;
use std::collections::HashSet;

const MAX_CONTENT_BYTES: usize = 200_000;

fn allowed_sections() -> &'static HashSet<&'static str> {
    use std::sync::OnceLock;

    static ALLOWED: OnceLock<HashSet<&'static str>> = OnceLock::new();
    ALLOWED.get_or_init(|| {
        [
            "hero",
            "tutorial_section",
            "header",
            "footer",
            "grundlagen_page",
        ]
        .into_iter()
        .collect()
    })
}

fn validate_section(section: &str) -> Result<(), (StatusCode, Json<ErrorResponse>)> {
    if allowed_sections().contains(section) {
        Ok(())
    } else {
        Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: format!("Unknown content section '{section}'"),
            }),
        ))
    }
}

fn validate_content_size(content: &Value) -> Result<(), (StatusCode, Json<ErrorResponse>)> {
    match serde_json::to_string(content) {
        Ok(serialized) if serialized.len() <= MAX_CONTENT_BYTES => Ok(()),
        Ok(_) => Err((
            StatusCode::PAYLOAD_TOO_LARGE,
            Json(ErrorResponse {
                error: format!("Content too large (max {MAX_CONTENT_BYTES} bytes)"),
            }),
        )),
        Err(err) => Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: format!("Invalid JSON content: {err}"),
            }),
        )),
    }
}

fn map_record(
    record: crate::models::SiteContent,
) -> Result<SiteContentResponse, (StatusCode, Json<ErrorResponse>)> {
    let content: Value = serde_json::from_str(&record.content_json).map_err(|err| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Failed to parse stored content JSON: {err}"),
            }),
        )
    })?;

    Ok(SiteContentResponse {
        section: record.section,
        content,
        updated_at: record.updated_at,
    })
}

pub async fn list_site_content(
    State(pool): State<db::DbPool>,
) -> Result<Json<SiteContentListResponse>, (StatusCode, Json<ErrorResponse>)> {
    let records = db::fetch_all_site_content(&pool).await.map_err(|err| {
        tracing::error!("Failed to load site content: {}", err);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to load site content".to_string(),
            }),
        )
    })?;

    let mut items = Vec::with_capacity(records.len());
    for record in records {
        items.push(map_record(record)?);
    }

    Ok(Json(SiteContentListResponse { items }))
}

pub async fn get_site_content(
    State(pool): State<db::DbPool>,
    Path(section): Path<String>,
) -> Result<Json<SiteContentResponse>, (StatusCode, Json<ErrorResponse>)> {
    validate_section(&section)?;

    let record = db::fetch_site_content_by_section(&pool, &section)
        .await
        .map_err(|err| {
            tracing::error!("Failed to load site content '{}': {}", section, err);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to load site content".to_string(),
                }),
            )
        })?
        .ok_or_else(|| {
            (
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: format!("Content section '{section}' not found"),
                }),
            )
        })?;

    Ok(Json(map_record(record)?))
}

pub async fn update_site_content(
    claims: auth::Claims,
    State(pool): State<db::DbPool>,
    Path(section): Path<String>,
    Json(payload): Json<UpdateSiteContentRequest>,
) -> Result<Json<SiteContentResponse>, (StatusCode, Json<ErrorResponse>)> {
    if claims.role != "admin" {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "Insufficient permissions".to_string(),
            }),
        ));
    }

    validate_section(&section)?;
    validate_content_size(&payload.content)?;

    let record = db::upsert_site_content(&pool, &section, &payload.content)
        .await
        .map_err(|err| {
            tracing::error!("Failed to update site content '{}': {}", section, err);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to update site content".to_string(),
                }),
            )
        })?;

    Ok(Json(map_record(record)?))
}
