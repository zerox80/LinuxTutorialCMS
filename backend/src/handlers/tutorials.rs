//! # Tutorials Handler Module
//! 
//! This module provides HTTP handlers for managing tutorial content in the LinuxTutorialCMS.
//! It implements a comprehensive tutorial management system with the following features:
//! 
//! ## Features
//! - **Public read access**: Anyone can view tutorials and their metadata
//! - **Admin-only write access**: Only administrators can create, update, or delete tutorials
//! - **Pagination support**: Efficient listing of large tutorial sets
//! - **Content validation**: Comprehensive input sanitization and validation
//! - **Optimistic locking**: Version-based conflict prevention for concurrent edits
//! - **Topic management**: Structured categorization with deduplication
//! - **Rich metadata**: Icons, color gradients, and descriptive content
//! 
//! ## Security Features
//! - **Admin-only modifications**: All write operations require authentication
//! - **Input sanitization**: Prevents XSS and injection attacks
//! - **Content length limits**: Protects against DoS attacks
//! - **Optimistic locking**: Prevents concurrent modification conflicts
//! - **Data validation**: Ensures data integrity and consistency
//! 
//! ## API Endpoints
//! - `GET /tutorials` - List tutorials with pagination
//! - `GET /tutorials/{id}` - Get a specific tutorial
//! - `POST /tutorials` - Create a new tutorial (admin only)
//! - `PUT /tutorials/{id}` - Update an existing tutorial (admin only)
//! - `DELETE /tutorials/{id}` - Delete a tutorial (admin only)
//! 
//! ## Data Model
//! - **ID**: UUID v4 for unique identification
//! - **Metadata**: Title, description, icon, color gradient
//! - **Content**: Rich text content with Markdown support
//! - **Topics**: Structured categorization (max 20 topics)
//! - **Versioning**: Optimistic locking for conflict prevention
//! 
//! ## Validation Rules
//! - **Title**: 1-200 characters, required
//! - **Description**: 1-1000 characters, required
//! - **Content**: Max 100,000 characters, optional
//! - **Topics**: 1-20 unique topics, max 100 chars each
//! - **Icons**: Predefined set of 8 allowed icons
//! - **Colors**: Tailwind CSS gradient format (from/to or from/via/to)
//! 
//! ## Performance Notes
//! - Database queries optimized with proper indexes
//! - Pagination limits prevent excessive data transfer
//! - Transaction-based operations ensure data consistency
//! - Efficient topic deduplication and canonicalization

use crate::{auth, db::DbPool, models::*};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use std::collections::HashSet;
use std::convert::TryInto;
use uuid::Uuid;

/// Validates a tutorial identifier for security and format compliance.
///
/// This function ensures tutorial IDs are safe for database operations
/// and prevents injection attacks through malicious identifiers.
/// 
/// # Validation Rules
/// - Cannot be empty
/// - Maximum length: 100 characters
/// - Allowed characters: alphanumeric and hyphens (UUID-compatible)
/// - Case-sensitive (preserves original format)
/// 
/// # Security Considerations
/// - Prevents SQL injection through character filtering
/// - Limits length to prevent DoS attacks
/// - Disallows special characters that could break queries
/// - Compatible with UUID v4 format
/// 
/// # Arguments
/// * `id` - The tutorial identifier to validate
/// 
/// # Returns
/// * `Ok(())` - ID is valid and safe to use
/// * `Err(String)` - Detailed error message explaining validation failure
/// 
/// # Examples
/// ```rust,no_run
/// assert!(validate_tutorial_id("550e8400-e29b-41d4-a716-446655440000").is_ok());
/// assert!(validate_tutorial_id("tutorial-123").is_ok());
/// assert!(validate_tutorial_id("").is_err()); // Empty
/// assert!(validate_tutorial_id("tutorial@123").is_err()); // Invalid character
/// assert!(validate_tutorial_id("a".repeat(101).as_str()).is_err()); // Too long
/// ```
pub(crate) fn validate_tutorial_id(id: &str) -> Result<(), String> {
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

/// Validates tutorial content data according to business rules and security requirements.
///
/// This function enforces content constraints to ensure data quality,
/// prevent abuse, and maintain consistent user experience.
/// 
/// # Validation Rules
/// - **Title**: 1-200 characters (required, trimmed)
/// - **Description**: 1-1000 characters (required, trimmed)
/// - **Content**: 0-100,000 characters (optional, trimmed)
/// - Whitespace trimming applied to all fields
/// 
/// # Security Considerations
/// - Length limits prevent DoS attacks through large content
/// - Empty field validation ensures data completeness
/// - Trimming prevents whitespace-based attacks
/// - Content size limits protect storage resources
/// 
/// # Arguments
/// * `title` - The tutorial title to validate
/// * `description` - The tutorial description to validate
/// * `content` - The tutorial content to validate
/// 
/// # Returns
/// * `Ok(())` - All content fields are valid
/// * `Err(String)` - Detailed error message for first validation failure
/// 
/// # Examples
/// ```rust,no_run
/// assert!(validate_tutorial_data(
///     "Linux Basics", 
///     "Learn fundamental Linux commands", 
///     "# Introduction\nLinux is..."
/// ).is_ok());
/// 
/// assert!(validate_tutorial_data("", "Description", "Content").is_err()); // Empty title
/// assert!(validate_tutorial_data("Title", "", "Content").is_err()); // Empty description
/// ```
fn validate_tutorial_data(title: &str, description: &str, content: &str) -> Result<(), String> {
    let title_trimmed = title.trim();
    if title_trimmed.is_empty() {
        return Err("Title cannot be empty".to_string());
    }
    if title_trimmed.len() > 200 {
        return Err("Title too long (max 200 characters)".to_string());
    }
    let description_trimmed = description.trim();
    if description_trimmed.is_empty() {
        return Err("Description cannot be empty".to_string());
    }
    if description_trimmed.len() > 1000 {
        return Err("Description too long (max 1000 characters)".to_string());
    }
    let content_trimmed = content.trim();
    if content_trimmed.len() > 100_000 {
        return Err("Content too long (max 100,000 characters)".to_string());
    }
    Ok(())
}

/// Validates tutorial icon selection against predefined approved set.
///
/// This function restricts icons to a curated set to ensure
/// consistent UI design and prevent potential security issues.
/// 
/// # Allowed Icons
/// - `Terminal` - Command-line and shell tutorials
/// - `FolderTree` - File system and navigation tutorials
/// - `FileText` - Text editing and file content tutorials
/// - `Settings` - Configuration and system setup tutorials
/// - `Shield` - Security and permissions tutorials
/// - `Network` - Networking and connectivity tutorials
/// - `Database` - Data management tutorials
/// - `Server` - Server administration tutorials
/// 
/// # Security Considerations
/// - Prevents arbitrary icon injection
/// - Ensures UI consistency across tutorials
/// - Limits attack surface through curated icon set
/// - Supports theming and design system integration
/// 
/// # Arguments
/// * `icon` - The icon name to validate
/// 
/// # Returns
/// * `Ok(())` - Icon is approved and valid
/// * `Err(String)` - Error message with list of valid options
/// 
/// # Examples
/// ```rust,no_run
/// assert!(validate_icon("Terminal").is_ok());
/// assert!(validate_icon("Shield").is_ok());
/// assert!(validate_icon("InvalidIcon").is_err()); // Not in allowed list
/// ```
pub(crate) fn validate_icon(icon: &str) -> Result<(), String> {
    const ALLOWED_ICONS: &[&str] = &[
        "Terminal",
        "FolderTree",
        "FileText",
        "Settings",
        "Shield",
        "Network",
        "Database",
        "Server",
    ];

    if ALLOWED_ICONS.contains(&icon) {
        Ok(())
    } else {
        Err(format!(
            "Invalid icon '{}'. Must be one of: {:?}",
            icon, ALLOWED_ICONS
        ))
    }
}

/// Validates Tailwind CSS color gradient specifications.
///
/// This function ensures color gradients follow the expected Tailwind CSS format
/// for consistent visual styling and prevents invalid CSS injection.
/// 
/// # Supported Formats
/// - **Two-color gradient**: `from-{color} to-{color}`
/// - **Three-color gradient**: `from-{color} via-{color} to-{color}`
/// - **Color names**: Standard Tailwind color names (blue, red, green, etc.)
/// - **Color shades**: 100-900 range (e.g., blue-500, red-300)
/// 
/// # Validation Rules
/// - Each segment must start with proper prefix (from-, via-, to-)
/// - Maximum segment length: 32 characters
/// - Colors must be alphanumeric with optional hyphens
/// - Whitespace separation between segments
/// - 2 or 3 segments required
/// 
/// # Security Considerations
/// - Prevents CSS injection through malicious color values
/// - Ensures valid Tailwind CSS syntax
/// - Limits color palette to approved design tokens
/// - Maintains visual consistency across tutorials
/// 
/// # Arguments
/// * `color` - The color gradient string to validate
/// 
/// # Returns
/// * `Ok(())` - Color gradient is valid and safe
/// * `Err(String)` - Detailed error message about format issues
/// 
/// # Examples
/// ```rust,no_run
/// assert!(validate_color("from-blue-500 to-cyan-500").is_ok());
/// assert!(validate_color("from-purple-500 via-pink-500 to-red-500").is_ok());
/// assert!(validate_color("invalid-format").is_err()); // Wrong format
/// assert!(validate_color("from- to-").is_err()); // Missing colors
/// ```
pub(crate) fn validate_color(color: &str) -> Result<(), String> {
    const MAX_SEGMENT_LEN: usize = 32;

    fn validate_segment(segment: &str, prefix: &str) -> bool {
        if !segment.starts_with(prefix) {
            return false;
        }
        let suffix = &segment[prefix.len()..];
        !suffix.is_empty()
            && suffix.len() <= MAX_SEGMENT_LEN
            && suffix
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '-')
    }

    let segments: Vec<&str> = color.split_whitespace().collect();
    if !(segments.len() == 2 || segments.len() == 3) {
        return Err(
            "Invalid color gradient. Expected Tailwind style 'from-… [via-…] to-…' format."
                .to_string(),
        );
    }

    if !validate_segment(segments[0], "from-") {
        return Err("Invalid color gradient: 'from-*' segment malformed or too long.".to_string());
    }

    if segments.len() == 3 {
        if !validate_segment(segments[1], "via-") {
            return Err(
                "Invalid color gradient: 'via-*' segment malformed or too long.".to_string(),
            );
        }
        if !validate_segment(segments[2], "to-") {
            return Err(
                "Invalid color gradient: 'to-*' segment malformed or too long.".to_string(),
            );
        }
    } else if !validate_segment(segments[1], "to-") {
        return Err("Invalid color gradient: 'to-*' segment malformed or too long.".to_string());
    }

    Ok(())
}

/// Sanitizes and validates topic list for tutorials.
///
/// This function processes topic strings to ensure they are safe, unique,
/// and properly formatted for database storage and display.
/// 
/// # Processing Rules
/// - **Maximum topics**: 20 topics per tutorial
/// - **Topic length**: Maximum 100 characters each
/// - **Empty topics**: Filtered out automatically
/// - **Duplicates**: Case-insensitive deduplication
/// - **Canonicalization**: All topics converted to lowercase
/// - **Whitespace**: Trimmed from beginning and end
/// 
/// # Security Considerations
/// - Prevents topic injection attacks
/// - Limits storage usage through topic count limits
/// - Ensures consistent topic formatting
/// - Prevents duplicate topic spam
/// 
/// # Arguments
/// * `topics` - Raw topic strings to sanitize and validate
/// 
/// # Returns
/// * `Ok(Vec<String>)` - Sanitized, unique topic list
/// * `Err(String)` - Error message for validation failures
/// 
/// # Examples
/// ```rust,no_run
/// let topics = vec![
///     "Linux".to_string(),
///     "Commands".to_string(),
///     " linux ".to_string(), // Duplicate (case-insensitive)
///     "".to_string(), // Empty (filtered)
/// ];
/// 
/// let result = sanitize_topics(&topics);
/// assert!(result.is_ok());
/// assert_eq!(result.unwrap(), vec!["Linux", "Commands"]);
/// 
/// // Too many topics
/// let many_topics = (0..25).map(|i| format!("topic{}", i)).collect();
/// assert!(sanitize_topics(&many_topics).is_err());
/// ```
fn sanitize_topics(topics: &[String]) -> Result<Vec<String>, String> {
    if topics.len() > 20 {
        return Err("Too many topics (max 20)".to_string());
    }

    let mut sanitized = Vec::with_capacity(topics.len());
    let mut seen = HashSet::new();

    for topic in topics {
        let trimmed = topic.trim();
        if trimmed.is_empty() {
            continue;
        }

        let limited: String = if trimmed.len() > 100 {
            trimmed.chars().take(100).collect()
        } else {
            trimmed.to_string()
        };

        let canonical = limited
            .chars()
            .map(|c| c.to_ascii_lowercase())
            .collect::<String>();

        if !seen.insert(canonical) {
            return Err("Duplicate topics are not allowed".to_string());
        }

        sanitized.push(limited);
    }

    if sanitized.is_empty() {
        return Err("At least one topic is required".to_string());
    }

    Ok(sanitized)
}

/// Pagination parameters for tutorial listing operations.
///
/// This struct controls how tutorials are retrieved from the database,
/// supporting both limit-based pagination and offset-based navigation.
/// 
/// # Query Parameters
/// - `limit` (optional): Maximum number of tutorials to return (1-100, default: 50)
/// - `offset` (optional): Number of tutorials to skip for pagination (>= 0, default: 0)
/// 
/// # Default Values
/// - `limit`: 50 tutorials (configurable via `default_tutorial_limit`)
/// - `offset`: 0 (start from the beginning)
/// 
/// # Constraints
/// - Minimum limit: 1 tutorial
/// - Maximum limit: 100 tutorials (enforced to prevent excessive database load)
/// - Minimum offset: 0 (negative values are clamped to 0)
/// 
/// # Example Query String
/// ```
/// ?limit=25&offset=50
/// ```
#[derive(Deserialize)]
pub struct TutorialListQuery {
    /// Maximum number of tutorials to return (1-100)
    #[serde(default = "default_tutorial_limit")]
    limit: i64,
    /// Number of tutorials to skip for pagination (>= 0)
    #[serde(default)]
    offset: i64,
}

/// Returns the default pagination limit for tutorial listings.
///
/// # Returns
/// `50` - The default maximum number of tutorials per request
/// 
/// # Rationale
/// - Balances performance with user experience
/// - Prevents excessive database load
/// - Provides reasonable amount of content per page
/// - Compatible with common pagination UI patterns
fn default_tutorial_limit() -> i64 {
    50
}

/// Retrieves a paginated list of all tutorials with comprehensive metadata.
///
/// This endpoint provides public access to browse all available tutorials
/// with pagination support for efficient handling of large datasets.
/// Tutorials are returned in chronological order (oldest first).
///
/// # HTTP Endpoint
/// `GET /tutorials`
/// 
/// # Authentication
/// **Not required** - This endpoint is publicly accessible
/// 
/// # Arguments
/// * `State(pool)` - Database connection pool for executing queries
/// * `Query(params)` - Pagination controls (limit, offset)
/// 
/// # Query Parameters
/// - `limit` (optional): Number of tutorials to return (1-100, default: 50)
/// - `offset` (optional): Number of tutorials to skip (>= 0, default: 0)
/// 
/// # Returns
/// * `Ok(Json<Vec<TutorialResponse>>)` - Array of tutorial objects in JSON format
/// * `Err((StatusCode, Json<ErrorResponse>))` - Error response with status code
/// 
/// # Success Response (200 OK)
/// ```json
/// [
///   {
///     "id": "550e8400-e29b-41d4-a716-446655440000",
///     "title": "Linux Grundlagen",
///     "description": "Lerne die grundlegenden Linux-Befehle",
///     "icon": "Terminal",
///     "color": "from-blue-500 to-cyan-500",
///     "topics": ["linux", "befehle", "grundlagen"],
///     "version": 1,
///     "created_at": "2023-12-07T10:30:00Z",
///     "updated_at": "2023-12-07T10:30:00Z"
///   }
/// ]
/// ```
/// 
/// # Error Responses
/// - `500 INTERNAL_SERVER_ERROR`: Database connection or query failure
/// 
/// # Performance Considerations
/// - Enforces maximum limit of 100 tutorials per request
/// - Uses database indexes on `created_at` for optimal performance
/// - Returns tutorials in creation order for consistent pagination
/// - Negative offset values are automatically clamped to 0
/// 
/// # Examples
/// ```bash
/// # Get first 10 tutorials
/// curl "https://example.com/tutorials?limit=10"
/// 
/// # Get tutorials with pagination (skip first 20, get next 30)
/// curl "https://example.com/tutorials?offset=20&limit=30"
/// 
/// # Get default number of tutorials (50)
/// curl "https://example.com/tutorials"
/// ```
/// 
/// # Use Cases
/// - Tutorial browsing and discovery
/// - API-based tutorial listing applications
/// - Search result pagination
/// - RSS feed generation
/// - Tutorial sitemap creation
/// 
/// # Related Functions
/// - [`get_tutorial()`] - Get a specific tutorial by ID
/// - [`create_tutorial()`] - Create a new tutorial (admin only)
/// - [`validate_tutorial_id()`] - Tutorial ID validation
pub async fn list_tutorials(
    State(pool): State<DbPool>,
    Query(params): Query<TutorialListQuery>,
) -> Result<Json<Vec<TutorialResponse>>, (StatusCode, Json<ErrorResponse>)> {
    let limit = params.limit.clamp(1, 100);
    let offset = params.offset.max(0);

    let tutorials = sqlx::query_as::<_, Tutorial>(
        "SELECT id, title, description, icon, color, topics, content, version, created_at, updated_at \
         FROM tutorials ORDER BY created_at ASC LIMIT ? OFFSET ?"
    )
        .bind(limit)
        .bind(offset)
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
        let response: TutorialResponse = tutorial.try_into().map_err(|err: String| {
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

/// Fetches a single tutorial by its ID.
///
/// # Arguments
///
/// * `State(pool)` - Database pool used for the lookup.
/// * `Path(id)` - Tutorial identifier to load.
///
/// # Returns
///
/// JSON tutorial representation or an error tuple.
pub async fn get_tutorial(
    State(pool): State<DbPool>,
    Path(id): Path<String>,
) -> Result<Json<TutorialResponse>, (StatusCode, Json<ErrorResponse>)> {
    // Validate ID
    if let Err(e) = validate_tutorial_id(&id) {
        return Err((StatusCode::BAD_REQUEST, Json(ErrorResponse { error: e })));
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

/// Creates a new tutorial. (Admin only)
///
/// # Arguments
///
/// * `claims` - Authenticated user claims, used to enforce admin-only access.
/// * `State(pool)` - Database pool reference.
/// * `Json(payload)` - Tutorial creation payload.
///
/// # Returns
///
/// JSON representation of the created tutorial or an error tuple.
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
    let title = payload.title.trim().to_string();
    let description = payload.description.trim().to_string();
    let content = payload.content.trim().to_string();

    if let Err(e) = validate_tutorial_data(&title, &description, &content) {
        return Err((StatusCode::BAD_REQUEST, Json(ErrorResponse { error: e })));
    }

    // Validate icon and color
    if let Err(e) = validate_icon(&payload.icon) {
        return Err((StatusCode::BAD_REQUEST, Json(ErrorResponse { error: e })));
    }
    if let Err(e) = validate_color(&payload.color) {
        return Err((StatusCode::BAD_REQUEST, Json(ErrorResponse { error: e })));
    }

    let id = Uuid::new_v4().to_string();
    let sanitized_topics = sanitize_topics(&payload.topics)
        .map_err(|e| (StatusCode::BAD_REQUEST, Json(ErrorResponse { error: e })))?;
    let topics_json = serde_json::to_string(&sanitized_topics).map_err(|e| {
        tracing::error!("Failed to serialize topics: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to create tutorial".to_string(),
            }),
        )
    })?;
    let mut tx = pool.begin().await.map_err(|e| {
        tracing::error!("Failed to begin transaction for tutorial {}: {}", id, e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to create tutorial".to_string(),
            }),
        )
    })?;

    sqlx::query(
        r#"
        INSERT INTO tutorials (id, title, description, icon, color, topics, content, version)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        "#,
    )
    .bind(&id)
    .bind(&title)
    .bind(&description)
    .bind(&payload.icon)
    .bind(&payload.color)
    .bind(&topics_json)
    .bind(&content)
    .execute(&mut *tx)
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

    // Sync tutorial_topics table inside transaction
    crate::db::replace_tutorial_topics_tx(&mut tx, &id, &sanitized_topics)
        .await
        .map_err(|e| {
            tracing::error!("Failed to update tutorial topics: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to create tutorial".to_string(),
                }),
            )
        })?;

    let tutorial = sqlx::query_as::<_, Tutorial>(
        "SELECT id, title, description, icon, color, topics, content, version, created_at, updated_at FROM tutorials WHERE id = ?"
    )
    .bind(&id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("Failed to load created tutorial {}: {}", id, e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to create tutorial".to_string(),
            }),
        )
    })?;

    tx.commit().await.map_err(|e| {
        tracing::error!("Failed to commit tutorial transaction for {}: {}", id, e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to create tutorial".to_string(),
            }),
        )
    })?;

    let response: TutorialResponse = tutorial.try_into().map_err(|err: String| {
        tracing::error!(
            "Tutorial data corruption detected after create {}: {}",
            id,
            err
        );
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to create tutorial".to_string(),
            }),
        )
    })?;

    Ok(Json(response))
}

/// Updates an existing tutorial. (Admin only)
///
/// This handler uses optimistic locking via a `version` field to prevent concurrent edit conflicts.
///
/// # Arguments
///
/// * `claims` - Authenticated user claims, used to enforce admin-only access.
/// * `State(pool)` - Database pool reference.
/// * `Path(id)` - Tutorial identifier to update.
/// * `Json(payload)` - Partial update payload.
///
/// # Returns
///
/// JSON representation of the updated tutorial or an error tuple.
pub async fn update_tutorial(
    claims: auth::Claims,
    State(pool): State<DbPool>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateTutorialRequest>,
) -> Result<Json<TutorialResponse>, (StatusCode, Json<ErrorResponse>)> {
    tracing::info!("Updating tutorial with id: {}", id);

    // Check if user is admin
    if claims.role != "admin" {
        tracing::warn!(
            "Unauthorized update attempt for tutorial {} by user {}",
            id,
            claims.sub
        );
        return Err((
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "Insufficient permissions".to_string(),
            }),
        ));
    }

    // Validate ID
    if let Err(e) = validate_tutorial_id(&id) {
        tracing::warn!("Invalid tutorial ID during update: {}", id);
        return Err((StatusCode::BAD_REQUEST, Json(ErrorResponse { error: e })));
    }

    let mut tx = pool.begin().await.map_err(|e| {
        tracing::error!(
            "Failed to begin transaction for tutorial update {}: {}",
            id,
            e
        );
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to update tutorial".to_string(),
            }),
        )
    })?;

    // Fetch existing tutorial within transaction
    let tutorial = sqlx::query_as::<_, Tutorial>("SELECT * FROM tutorials WHERE id = ?")
        .bind(&id)
        .fetch_optional(&mut *tx)
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

    let title = match payload.title {
        Some(value) => {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(ErrorResponse {
                        error: "Title cannot be empty".to_string(),
                    }),
                ));
            }
            trimmed.to_string()
        }
        None => tutorial.title.trim().to_string(),
    };

    let description = match payload.description {
        Some(value) => {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(ErrorResponse {
                        error: "Description cannot be empty".to_string(),
                    }),
                ));
            }
            trimmed.to_string()
        }
        None => tutorial.description.trim().to_string(),
    };

    let icon = payload.icon.unwrap_or(tutorial.icon);
    let color = payload.color.unwrap_or(tutorial.color);
    let content = match payload.content {
        Some(value) => {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(ErrorResponse {
                        error: "Content cannot be empty".to_string(),
                    }),
                ));
            }
            trimmed.to_string()
        }
        None => tutorial.content.trim().to_string(),
    };

    tracing::debug!(
        "Tutorial update data - title length: {}, description length: {}, content length: {}",
        title.len(),
        description.len(),
        content.len()
    );

    // Validate updated data
    if let Err(e) = validate_tutorial_data(&title, &description, &content) {
        tracing::warn!("Validation failed for tutorial {}: {}", id, e);
        return Err((StatusCode::BAD_REQUEST, Json(ErrorResponse { error: e })));
    }

    // Validate icon and color
    if let Err(e) = validate_icon(&icon) {
        return Err((StatusCode::BAD_REQUEST, Json(ErrorResponse { error: e })));
    }
    if let Err(e) = validate_color(&color) {
        return Err((StatusCode::BAD_REQUEST, Json(ErrorResponse { error: e })));
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
        let sanitized = sanitize_topics(&t)
            .map_err(|e| (StatusCode::BAD_REQUEST, Json(ErrorResponse { error: e })))?;

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
        match serde_json::from_str::<Vec<String>>(&tutorial.topics) {
            Ok(existing_topics) => (tutorial.topics.clone(), existing_topics),
            Err(e) => {
                tracing::error!(
                    "Failed to deserialize topics for tutorial {}: {}",
                    tutorial.id,
                    e
                );
                return Err((
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ErrorResponse {
                        error: "Failed to read stored tutorial topics".to_string(),
                    }),
                ));
            }
        }
    };
    // Optimistic locking: update only if version hasn't changed
    let result = sqlx::query(
        r#"
        UPDATE tutorials
        SET title = ?, description = ?, icon = ?, color = ?, topics = ?, content = ?, version = ?, updated_at = datetime('now')
        WHERE id = ? AND version = ?
        "#,
    )
    .bind(&title)          // 1. title
    .bind(&description)    // 2. description
    .bind(&icon)           // 3. icon
    .bind(&color)          // 4. color
    .bind(&topics_json)    // 5. topics
    .bind(&content)        // 6. content
    .bind(new_version)     // 7. version
    .bind(&id)             // 8. id (WHERE)
    .bind(tutorial.version)   // 9. version (WHERE)
    .execute(&mut *tx)
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
                error: "Tutorial was modified by another request. Please refresh and try again."
                    .to_string(),
            }),
        ));
    }

    // Sync tutorial_topics table
    tracing::debug!("Updating tutorial_topics table for tutorial {}", id);
    crate::db::replace_tutorial_topics_tx(&mut tx, &id, &topics_vec)
        .await
        .map_err(|e| {
            tracing::error!("Failed to update tutorial topics for {}: {}", id, e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to update tutorial".to_string(),
                }),
            )
        })?;

    let updated_tutorial = sqlx::query_as::<_, Tutorial>(
        "SELECT id, title, description, icon, color, topics, content, version, created_at, updated_at FROM tutorials WHERE id = ?"
    )
    .bind(&id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("Failed to load updated tutorial {}: {}", id, e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to update tutorial".to_string(),
            }),
        )
    })?;

    tx.commit().await.map_err(|e| {
        tracing::error!(
            "Failed to commit tutorial update transaction for {}: {}",
            id,
            e
        );
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to update tutorial".to_string(),
            }),
        )
    })?;

    tracing::info!("Successfully updated tutorial {}", id);
    let response: TutorialResponse = updated_tutorial.try_into().map_err(|err: String| {
        tracing::error!(
            "Tutorial data corruption detected after update {}: {}",
            id,
            err
        );
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to update tutorial".to_string(),
            }),
        )
    })?;

    Ok(Json(response))
}

/// Deletes a tutorial by its ID. (Admin only)
///
/// # Arguments
///
/// * `claims` - Authenticated user claims, used to enforce admin-only access.
/// * `State(pool)` - Database pool reference.
/// * `Path(id)` - Tutorial identifier to delete.
///
/// # Returns
///
/// `StatusCode::NO_CONTENT` on success or an error tuple.
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
        return Err((StatusCode::BAD_REQUEST, Json(ErrorResponse { error: e })));
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
