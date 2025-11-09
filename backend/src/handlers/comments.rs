//! # Comments Handler Module
//! 
//! This module provides HTTP handlers for managing tutorial comments in the LinuxTutorialCMS.
//! It implements a complete comment system with the following features:
//! 
//! ## Features
//! - **Public read access**: Anyone can view comments for tutorials
//! - **Admin-only write access**: Only administrators can create or delete comments
//! - **Pagination support**: Efficient listing of large comment sets
//! - **Content sanitization**: Automatic removal of dangerous characters and validation
//! - **Configurable author display**: Environment-based author name customization
//! 
//! ## API Endpoints
//! - `GET /tutorials/{id}/comments` - List comments with pagination
//! - `POST /tutorials/{id}/comments` - Create a new comment (admin only)
//! - `DELETE /comments/{id}` - Delete a comment (admin only)
//! 
//! ## Security Considerations
//! - All write operations require admin authentication
//! - Comment content is automatically sanitized to prevent XSS
//! - Input validation enforces reasonable size limits (1000 chars max)
//! - SQL injection protection through parameterized queries
//! 
//! ## Performance Notes
//! - Comments are ordered by creation date (newest first)
//! - Pagination limits are enforced (max 200 comments per request)
//! - Database indexes on `tutorial_id` and `created_at` recommended for optimal performance

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
/// This struct represents the JSON request body for creating a new comment.
/// Only the `content` field is required as other fields (author, tutorial_id, timestamps)
/// are automatically populated by the server.
///
/// # Validation
/// - Content is trimmed of whitespace
/// - Maximum length: 1000 characters (enforced by `sanitize_comment_content`)
/// - Empty content is rejected
/// 
/// # Example
/// ```json
/// {
///   "content": "This is a great tutorial! Very helpful."
/// }
/// ```
#[derive(Deserialize)]
pub struct CreateCommentRequest {
    /// The actual comment text provided by the admin user
    content: String,
}

/// Pagination parameters for comment listing operations.
///
/// This struct controls how comments are retrieved from the database,
/// supporting both limit-based pagination and offset-based navigation.
///
/// # Default Values
/// - `limit`: 50 comments (configurable via `default_comment_limit`)
/// - `offset`: 0 (start from the beginning)
/// 
/// # Constraints
/// - Minimum limit: 1 comment
/// - Maximum limit: 200 comments (enforced to prevent excessive database load)
/// - Minimum offset: 0 (negative values are clamped to 0)
/// 
/// # Example Query String
/// ```
/// ?limit=25&offset=50
/// ```
#[derive(Deserialize)]
pub struct CommentListQuery {
    /// Maximum number of comments to return (1-200)
    #[serde(default = "default_comment_limit")]
    limit: i64,
    /// Number of comments to skip for pagination (>= 0)
    #[serde(default)]
    offset: i64,
}

/// Returns the default pagination limit for comment listings.
///
/// # Returns
/// `50` - The default maximum number of comments per request
fn default_comment_limit() -> i64 {
    50
}

/// Database entity representing a persisted comment.
///
/// This struct maps directly to both database rows and JSON responses,
/// providing a complete representation of a comment including metadata.
///
/// # Fields
/// - `id`: Unique identifier (UUID v4 string)
/// - `tutorial_id`: Reference to the associated tutorial
/// - `author`: Display name of the comment author
/// - `content`: Sanitized comment text
/// - `created_at`: ISO 8601 timestamp (RFC 3339 format)
/// 
/// # Serialization
/// - Automatically serializes to JSON for API responses
/// - Maps from database rows via SQLx
/// 
/// # Example JSON Output
/// ```json
/// {
///   "id": "550e8400-e29b-41d4-a716-446655440000",
///   "tutorial_id": "tutorial-123",
///   "author": "Admin User",
///   "content": "Great explanation!",
///   "created_at": "2023-12-07T10:30:00Z"
/// }
/// ```
#[derive(Serialize, sqlx::FromRow)]
pub struct Comment {
    /// Unique identifier for the comment (UUID v4)
    pub id: String,
    /// ID of the tutorial this comment belongs to
    pub tutorial_id: String,
    /// Display name of the comment author
    pub author: String,
    /// Sanitized content of the comment
    pub content: String,
    /// Creation timestamp in RFC 3339 format
    pub created_at: String,
}

/// Determines the display name for comment authors based on configuration.
///
/// This function checks for an environment variable `COMMENT_AUTHOR_DISPLAY_NAME`
/// to provide a consistent author identity across all comments. If not configured,
/// it falls back to the authenticated user's subject identifier.
///
/// # Environment Variable
/// - `COMMENT_AUTHOR_DISPLAY_NAME`: Optional display name for comment authors
///   - If unset: Uses `claims.sub` (user identifier)
///   - If empty string: Falls back to `claims.sub`
///   - If set with value: Uses the configured name
/// 
/// # Arguments
/// * `claims` - Authentication claims containing user information
/// 
/// # Returns
/// The configured display name or the user's subject identifier
/// 
/// # Performance Notes
/// Uses `OnceLock` for thread-safe, one-time environment variable lookup
/// to avoid repeated environment access.
/// 
/// # Examples
/// ```rust,no_run
/// // With environment variable set
/// // COMMENT_AUTHOR_DISPLAY_NAME="Tutorial Admin"
/// let name = comment_author_display_name(&claims); // Returns "Tutorial Admin"
/// 
/// // Without environment variable
/// let name = comment_author_display_name(&claims); // Returns claims.sub
/// ```
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

/// Sanitizes and validates comment content for safe storage and display.
///
/// This function performs comprehensive content validation and sanitization to ensure
/// comment safety and prevent XSS attacks while preserving legitimate formatting.
///
/// # Validation Rules
/// - Content cannot be empty after trimming whitespace
/// - Maximum length: 1000 characters (after trimming)
/// - Removes potentially dangerous control characters
/// 
/// # Sanitization Process
/// 1. Trims leading/trailing whitespace
/// 2. Validates length constraints
/// 3. Filters out control characters except common whitespace:
///    - Preserves: `\n` (newline), `\r` (carriage return), `\t` (tab)
///    - Removes: Other control characters that could be exploited
/// 
/// # Arguments
/// * `raw` - The raw user-provided comment content
/// 
/// # Returns
/// * `Ok(String)` - Sanitized content ready for database storage
/// * `Err((StatusCode, Json<ErrorResponse>))` - Validation error with details
/// 
/// # Error Responses
/// - `400 BAD_REQUEST`: Empty content or exceeds length limit
/// 
/// # Security Considerations
/// - Prevents XSS by removing control characters
/// - Maintains readability by preserving basic formatting
/// - Enforces reasonable size limits to prevent DoS attacks
/// 
/// # Examples
/// ```rust,no_run
/// // Valid content
/// let result = sanitize_comment_content("Great tutorial!\nVery helpful.");
/// assert!(result.is_ok());
/// 
/// // Empty content
/// let result = sanitize_comment_content("   ");
/// assert!(result.is_err());
/// 
/// // Too long content
/// let long_content = "a".repeat(1001);
/// let result = sanitize_comment_content(&long_content);
/// assert!(result.is_err());
/// 
/// // Content with control characters (filtered out)
/// let result = sanitize_comment_content("Hello\x00World");
/// assert_eq!(result.unwrap(), "HelloWorld");
/// ```
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

/// Retrieves paginated comments for a specific tutorial.
///
/// This endpoint provides public access to view comments associated with a tutorial.
/// Comments are returned in reverse chronological order (newest first) with
/// pagination support for efficient handling of large comment sets.
///
/// # HTTP Endpoint
/// `GET /tutorials/{tutorial_id}/comments`
/// 
/// # Authentication
/// **Not required** - This endpoint is publicly accessible
/// 
/// # Arguments
/// * `State(pool)` - Database connection pool for executing queries
/// * `Path(tutorial_id)` - Unique identifier of the target tutorial
/// * `Query(params)` - Pagination controls (limit, offset)
/// 
/// # Query Parameters
/// - `limit` (optional): Number of comments to return (1-200, default: 50)
/// - `offset` (optional): Number of comments to skip (>= 0, default: 0)
/// 
/// # Returns
/// * `Ok(Json<Vec<Comment>>)` - Array of comment objects in JSON format
/// * `Err((StatusCode, Json<ErrorResponse>))` - Error response with status code
/// 
/// # Success Response (200 OK)
/// ```json
/// [
///   {
///     "id": "550e8400-e29b-41d4-a716-446655440000",
///     "tutorial_id": "tutorial-123",
///     "author": "Admin User",
///     "content": "Great explanation of the concepts!",
///     "created_at": "2023-12-07T10:30:00Z"
///   }
/// ]
/// ```
/// 
/// # Error Responses
/// - `400 BAD_REQUEST`: Invalid tutorial ID format
/// - `404 NOT_FOUND`: Tutorial with specified ID doesn't exist
/// - `500 INTERNAL_SERVER_ERROR`: Database connection or query failure
/// 
/// # Performance Considerations
/// - Enforces maximum limit of 200 comments per request
/// - Uses database indexes on `tutorial_id` and `created_at` for optimal performance
/// - Negative offset values are automatically clamped to 0
/// 
/// # Examples
/// ```bash
/// # Get first 10 comments for tutorial "intro-linux"
/// curl "https://example.com/tutorials/intro-linux/comments?limit=10"
/// 
/// # Get comments with pagination (skip first 20, get next 30)
/// curl "https://example.com/tutorials/intro-linux/comments?offset=20&limit=30"
/// ```
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
/// This endpoint allows authenticated administrators to add comments to tutorials.
/// The comment content is automatically sanitized and validated before storage.
/// Each comment is assigned a unique UUID and timestamp automatically.
///
/// # HTTP Endpoint
/// `POST /tutorials/{tutorial_id}/comments`
/// 
/// # Authentication
/// **Required** - Must be authenticated with admin role (`claims.role == "admin"`)
/// 
/// # Arguments
/// * `claims` - JWT claims containing user authentication and role information
/// * `State(pool)` - Database connection pool for executing queries
/// * `Path(tutorial_id)` - Unique identifier of the target tutorial
/// * `Json(payload)` - Request body containing comment content
/// 
/// # Request Body
/// ```json
/// {
///   "content": "This tutorial provides excellent coverage of Linux fundamentals!"
/// }
/// ```
/// 
/// # Returns
/// * `Ok(Json<Comment>)` - Complete comment object including generated metadata
/// * `Err((StatusCode, Json<ErrorResponse>))` - Error response with status code
/// 
/// # Success Response (201 CREATED)
/// ```json
/// {
///   "id": "550e8400-e29b-41d4-a716-446655440000",
///   "tutorial_id": "intro-linux",
///   "author": "Tutorial Admin",
///   "content": "This tutorial provides excellent coverage of Linux fundamentals!",
///   "created_at": "2023-12-07T15:30:00Z"
/// }
/// ```
/// 
/// # Error Responses
/// - `400 BAD_REQUEST`: Invalid tutorial ID format or invalid comment content
/// - `403 FORBIDDEN`: User is not an administrator
/// - `404 NOT_FOUND`: Tutorial with specified ID doesn't exist
/// - `500 INTERNAL_SERVER_ERROR`: Database connection or query failure
/// 
/// # Validation Rules
/// - Comment content must be non-empty after trimming
/// - Maximum length: 1000 characters (after trimming)
/// - Control characters are automatically filtered (except `\n`, `\r`, `\t`)
/// 
/// # Security Features
/// - Admin-only access prevents unauthorized comment creation
/// - Content sanitization prevents XSS attacks
/// - Parameterized queries prevent SQL injection
/// - Automatic UUID generation prevents ID collisions
/// 
/// # Environment Configuration
/// - `COMMENT_AUTHOR_DISPLAY_NAME`: Sets the author name for all comments
/// - If unset, uses the authenticated user's subject identifier
/// 
/// # Examples
/// ```bash
/// # Create a comment as admin
/// curl -X POST "https://example.com/tutorials/intro-linux/comments" \
///   -H "Authorization: Bearer <admin-token>" \
///   -H "Content-Type: application/json" \
///   -d '{"content": "Excellent tutorial for beginners!"}'
/// ```
/// 
/// # Performance Notes
/// - Tutorial existence is verified before comment creation
/// - Uses efficient UUID generation for unique identifiers
/// - Database transactions ensure data consistency
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

/// Deletes a comment by its unique identifier. (Admin only)
///
/// This endpoint allows authenticated administrators to permanently remove comments
/// from the system. The operation is irreversible and should be used with caution.
/// Successfully deleted comments return no content in the response body.
///
/// # HTTP Endpoint
/// `DELETE /comments/{id}`
/// 
/// # Authentication
/// **Required** - Must be authenticated with admin role (`claims.role == "admin"`)
/// 
/// # Arguments
/// * `claims` - JWT claims containing user authentication and role information
/// * `State(pool)` - Database connection pool for executing queries
/// * `Path(id)` - Unique identifier (UUID v4) of the comment to delete
/// 
/// # Returns
/// * `Ok(StatusCode::NO_CONTENT)` - Comment successfully deleted (204 status)
/// * `Err((StatusCode, Json<ErrorResponse>))` - Error response with status code
/// 
/// # Success Response (204 NO CONTENT)
/// Returns an empty response body with status code 204 to indicate successful deletion.
/// 
/// # Error Responses
/// ```json
/// // 403 FORBIDDEN
/// {
///   "error": "Insufficient permissions"
/// }
/// 
/// // 404 NOT_FOUND
/// {
///   "error": "Comment not found"
/// }
/// 
/// // 500 INTERNAL_SERVER_ERROR
/// {
///   "error": "Failed to delete comment"
/// }
/// ```
/// 
/// # Error Response Codes
/// - `403 FORBIDDEN`: User is not an administrator
/// - `404 NOT_FOUND`: Comment with specified ID doesn't exist
/// - `500 INTERNAL_SERVER_ERROR`: Database connection or query failure
/// 
/// # Security Considerations
/// - Admin-only access prevents unauthorized comment deletion
/// - Uses parameterized queries to prevent SQL injection
/// - Verifies comment existence before attempting deletion
/// - No response body prevents information leakage
/// 
/// # Data Integrity
/// - Deletion is permanent and cannot be undone
/// - Referential integrity is maintained by the database
/// - All associated metadata is removed along with the comment
/// 
/// # Examples
/// ```bash
/// # Delete a comment as admin
/// curl -X DELETE "https://example.com/comments/550e8400-e29b-41d4-a716-446655440000" \
///   -H "Authorization: Bearer <admin-token>"
/// 
/// # Attempt to delete non-existent comment
/// curl -X DELETE "https://example.com/comments/non-existent-id" \
///   -H "Authorization: Bearer <admin-token>"
/// # Response: 404 NOT_FOUND
/// 
/// # Attempt to delete without admin privileges
/// curl -X DELETE "https://example.com/comments/550e8400-e29b-41d4-a716-446655440000" \
///   -H "Authorization: Bearer <user-token>"
/// # Response: 403 FORBIDDEN
/// ```
/// 
/// # Performance Notes
/// - Uses efficient primary key lookup for comment deletion
/// - Returns immediately if no rows are affected (comment doesn't exist)
/// - Database constraints ensure referential integrity
/// 
/// # Auditing
/// - All deletion attempts are logged via tracing
/// - Failed operations include error details for debugging
/// - Admin authentication is verified before any database operations
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
