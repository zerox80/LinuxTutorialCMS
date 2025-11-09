//! # Site Content Handler Module
//!
//! This module provides HTTP handlers for managing global, reusable content sections
//! of the website, such as the hero banner, header, footer, and other metadata.
//! These content sections are stored as flexible JSON objects, allowing for rich,
//! structured data that can be easily consumed by the frontend.
//!
//! ## Features
//! - **Public Read Access**: Site content is publicly readable to construct the website UI.
//! - **Admin-Only Write Access**: Modifications are restricted to authenticated administrators.
//! - **Flexible JSON Storage**: Content is stored as `serde_json::Value` for maximum flexibility.
//! - **Schema Validation**: Each content section has a defined structure that is validated on write.
//! - **Size Limits**: Payloads are limited in size to prevent abuse.
//!
//! ## API Endpoints
//! - `GET /api/content`: Retrieves all site content sections.
//! - `GET /api/content/{section}`: Retrieves a single content section by its name.
//! - `PUT /api/content/{section}`: Updates a content section (admin only).
//!
//! ## Content Sections
//! The following sections are managed by this handler:
//! - `hero`: The main hero section of the homepage.
//! - `tutorial_section`: Content related to the tutorial list display.
//! - `header`: Global site header, including navigation links.
//! - `footer`: Global site footer.
//! - `grundlagen_page`: Specific content for a "foundations" page.
//! - `site_meta`: Site-wide metadata like titles and descriptions.

use crate::{
    auth, db,
    models::{
        ErrorResponse, SiteContentListResponse, SiteContentResponse, UpdateSiteContentRequest,
    },
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde_json::Value;
use std::collections::HashSet;

/// The maximum allowed size in bytes for a single site content JSON payload.
const MAX_CONTENT_BYTES: usize = 200_000;

/// Returns a static, lazily-initialized `HashSet` of allowed section names.
///
/// This function defines the canonical list of editable site content sections.
/// Using `OnceLock` ensures that the `HashSet` is created only once, providing
/// efficient, thread-safe access.
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
            "site_meta",
        ]
        .into_iter()
        .collect()
    })
}

/// Validates that a given section name is in the set of allowed sections.
///
/// # Arguments
///
/// * `section` - The section name to validate.
///
/// # Returns
///
/// `Ok(())` if the section is allowed, or an error response tuple if not.
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

/// Validates the JSON structure of a content payload against section-specific rules.
///
/// This function acts as a dispatcher, calling the appropriate validation function
/// based on the section name. This ensures that the JSON data for each section
/// conforms to the expected schema before it is saved to the database.
///
/// # Arguments
///
/// * `section` - The name of the section being validated.
/// * `content` - The `serde_json::Value` payload to validate.
///
/// # Returns
///
/// `Ok(())` if the structure is valid, or a `400 Bad Request` error otherwise.
fn validate_content_structure(
    section: &str,
    content: &Value,
) -> Result<(), (StatusCode, Json<ErrorResponse>)> {
    let result = match section {
        "hero" => validate_hero_structure(content),
        "tutorial_section" => validate_tutorial_section_structure(content),
        "header" => validate_header_structure(content),
        "footer" => validate_footer_structure(content),
        "grundlagen_page" => Ok(()), // For complex layouts, we rely on size and basic JSON format.
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

/// Validates the structure of the "hero" section JSON.
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

/// Validates the structure of the "tutorial_section" JSON.
fn validate_tutorial_section_structure(content: &Value) -> Result<(), &'static str> {
    let obj = content.as_object().ok_or("Expected JSON object")?;
    if !obj.contains_key("title") || !obj.contains_key("description") {
        return Err("Missing required fields 'title' or 'description'");
    }
    Ok(())
}

/// Validates the structure of the "header" section JSON.
fn validate_header_structure(content: &Value) -> Result<(), &'static str> {
    let obj = content.as_object().ok_or("Expected JSON object")?;
    if !obj.contains_key("brand") || !obj.contains_key("navItems") {
        return Err("Missing required fields 'brand' or 'navItems'");
    }
    if !obj
        .get("navItems")
        .and_then(|items| items.as_array())
        .map(|items| {
            items
                .iter()
                .all(|item| item.get("id").is_some() && item.get("label").is_some())
        })
        .unwrap_or(false)
    {
        return Err("Each navigation item must include 'id' and 'label'");
    }
    Ok(())
}

/// Validates the structure of the "footer" section JSON.
fn validate_footer_structure(content: &Value) -> Result<(), &'static str> {
    let obj = content.as_object().ok_or("Expected JSON object")?;
    if !obj.contains_key("brand") || !obj.contains_key("quickLinks") {
        return Err("Missing required fields 'brand' or 'quickLinks'");
    }
    Ok(())
}

/// Validates that the serialized JSON content does not exceed the maximum allowed size.
///
/// # Arguments
///
/// * `content` - The `serde_json::Value` to validate.
///
/// # Returns
///
/// `Ok(())` if the size is within limits, or a `413 Payload Too Large` error otherwise.
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

/// Maps a database `SiteContent` model to a `SiteContentResponse`.
///
/// This function handles the deserialization of the `content_json` string into a
/// `serde_json::Value`, preparing it for the API response.
///
/// # Arguments
///
/// * `record` - The `SiteContent` model from the database.
///
/// # Returns
///
/// A `Result` containing the `SiteContentResponse` or an error if JSON parsing fails.
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

/// Fetches all site content sections.
///
/// This public endpoint retrieves all global content sections from the database.
/// It's typically used by the frontend to populate various parts of the UI.
///
/// # HTTP Endpoint
/// `GET /api/content`
///
/// # Returns
///
/// A JSON response containing a list of all site content sections.
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

/// Fetches a single site content section by its name.
///
/// This public endpoint retrieves the content for a specific section, such as "header" or "footer".
///
/// # HTTP Endpoint
/// `GET /api/content/{section}`
///
/// # Path Parameters
/// - `section`: The name of the content section to retrieve.
///
/// # Returns
///
/// A JSON response for the requested section, or a `404 Not Found` error if the
/// section does not exist.
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

/// Updates a site content section. (Admin only)
///
/// This endpoint allows authenticated administrators to update the content of a specific
/// section. The provided JSON payload is validated for size and structure before being
-/// saved.
///
/// # HTTP Endpoint
/// `PUT /api/content/{section}`
///
/// # Authentication
/// Requires admin privileges.
///
/// # Path Parameters
/// - `section`: The name of the content section to update.
///
/// # Request Body
/// A JSON object containing the new content for the section.
///
/// # Returns
///
/// The updated `SiteContentResponse` on success, or an error if validation fails
/// or the user is not authorized.
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
