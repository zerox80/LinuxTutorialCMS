use crate::{
    auth, db,
    models::{
        ErrorResponse, SiteContentListResponse, SiteContentResponse, UpdateSiteContentRequest,
    },
    repositories,
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
            "site_meta",
            "stats",
        "stats",
            "cta_section",
            "settings",
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

fn validate_content_structure(
    section: &str,
    content: &Value,
) -> Result<(), (StatusCode, Json<ErrorResponse>)> {
    let result = match section {
        "hero" => validate_hero_structure(content),
        "tutorial_section" => validate_tutorial_section_structure(content),
        "header" => validate_header_structure(content),
        "footer" => validate_footer_structure(content),
        "settings" => validate_settings_structure(content),
        "stats" => Ok(()),
        "cta_section" => Ok(()),
        _ => Ok(()),
    };

    result.map_err(|err| {
        (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: format!("Invalid structure for section '{section}': {err}"),
            }),
        )
    })
}

fn validate_hero_structure(content: &Value) -> Result<(), &'static str> {
    let obj = content.as_object().ok_or("Expected JSON object")?;
    if !obj.contains_key("title") || !obj.contains_key("features") {
        return Err("Missing required fields 'title' or 'features'");
    }
    if !obj.get("features").map(|v| v.is_array()).unwrap_or(false) {
        return Err("Field 'features' must be an array");
    }
    Ok(())
}

fn validate_tutorial_section_structure(content: &Value) -> Result<(), &'static str> {
    let obj = content.as_object().ok_or("Expected JSON object")?;
    if !obj.contains_key("title") || !obj.contains_key("description") {
        return Err("Missing required fields 'title' or 'description'");
    }
    Ok(())
}

fn validate_header_structure(content: &Value) -> Result<(), &'static str> {
    let obj = content.as_object().ok_or("Expected JSON object")?;
    if !obj.contains_key("brand") || !obj.contains_key("navItems") {
        return Err("Missing required fields 'brand' or 'navItems'");
    }
    if !obj
        .get("navItems")
        .and_then(|items| items.as_array())
        .map(|items| {
            items.iter().all(|item| {
                let has_id_label = item.get("id").is_some() && item.get("label").is_some();
                // Ensure at least one target property exists
                let has_target = item.get("slug").is_some()
                    || item.get("href").is_some()
                    || item.get("path").is_some();
                has_id_label && has_target
            })
        })
        .unwrap_or(false)
    {
        return Err("Each navigation item must include 'id', 'label', and a target ('slug', 'href', or 'path')");
    }
    Ok(())
}

fn validate_footer_structure(content: &Value) -> Result<(), &'static str> {
    let obj = content.as_object().ok_or("Expected JSON object")?;
    if !obj.contains_key("brand") || !obj.contains_key("quickLinks") {
        return Err("Missing required fields 'brand' or 'quickLinks'");
    }
    Ok(())
}

fn validate_settings_structure(content: &Value) -> Result<(), &'static str> {
    let obj = content.as_object().ok_or("Expected JSON object")?;
    // We expect at least pdfEnabled, but we can be lenient or strict.
    // Let's be strict about the type if it exists.
    if let Some(val) = obj.get("pdfEnabled") {
        if !val.is_boolean() {
            return Err("Field 'pdfEnabled' must be a boolean");
        }
    }
    Ok(())
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
    let records = repositories::content::fetch_all_site_content(&pool)
        .await
        .map_err(|err| {
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

    let record = repositories::content::fetch_site_content_by_section(&pool, &section)
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
    validate_content_structure(&section, &payload.content)?;

    let record = repositories::content::upsert_site_content(&pool, &section, &payload.content)
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
