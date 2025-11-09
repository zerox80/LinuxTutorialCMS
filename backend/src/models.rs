

/**
 * Data Models Module - Application Data Structures
 *
 * This module defines all data models used throughout the Linux Tutorial CMS application.
 * Models are organized by domain (authentication, tutorials, site content) and include:
 * - Database entities with proper serialization/deserialization
 * - API request/response models for HTTP endpoints
 * - Data validation and transformation logic
 * - Type safety for database operations
 *
 * Design Principles:
 * - Clear separation between database models and API models
 * - Comprehensive serialization for JSON responses
 * - Input validation through type definitions
 * - Security-conscious field exposure (e.g., password hashing)
 * - Proper error handling for data transformations
 *
 * Security Features:
 * - Password hashes are excluded from serialization
 * - Input validation through type constraints
 * - Safe JSON parsing with error handling
 * - Clear separation of internal and external data models
 */

use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::FromRow;
use std::convert::TryFrom;

/// User model representing an authenticated user in the system.
///
/// This struct represents user accounts stored in the database and returned via API calls.
/// It includes authentication credentials, role-based permissions, and metadata.
///
/// # Security Notes
/// - `password_hash` is excluded from JSON serialization to prevent credential leakage
/// - Role-based access control is enforced at the handler level
/// - All timestamps are stored as ISO 8601 strings for consistency
///
/// # Fields
/// - `id`: Primary key for the user record
/// - `username`: Unique identifier for login (case-sensitive)
/// - `password_hash`: Bcrypt hash of the user's password (never exposed in API responses)
/// - `role`: User role for authorization (e.g., "admin", "editor")
/// - `created_at`: Account creation timestamp in ISO 8601 format
#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct User {
    /// Primary key identifier for the user
    pub id: i64,

    /// Unique username for authentication and identification
    pub username: String,

    /// Bcrypt hash of the user's password (excluded from API responses)
    #[serde(skip_serializing)]
    pub password_hash: String,

    /// User role for authorization and permission checking
    pub role: String,

    /// Account creation timestamp in ISO 8601 format
    pub created_at: String,
}

/// Login request payload containing user credentials.
///
/// This struct represents the JSON payload sent to the login endpoint.
/// It contains the minimum information required for authentication.
///
/// # Security Considerations
/// - Passwords are transmitted in plain text over HTTPS connections only
/// - Input validation should be performed before processing
/// - Rate limiting is applied at the endpoint level
/// - Login attempts are tracked for security monitoring
///
/// # Usage Example
/// ```json
/// {
///   "username": "admin",
///   "password": "secure-password-123"
/// }
/// ```
#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    /// Username for authentication (case-sensitive)
    pub username: String,

    /// Plain text password (will be validated against bcrypt hash)
    pub password: String,
}

/// Login response containing JWT token and user information.
///
/// This struct represents the successful authentication response returned to clients.
/// It includes both the authentication token and basic user profile information.
///
/// # Security Notes
/// - JWT token should be stored securely by the client
/// - Token includes expiration time and role information
/// - User information is limited to non-sensitive data
///
/// # Usage Example
/// ```json
/// {
///   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
///   "user": {
///     "username": "admin",
///     "role": "admin"
///   }
/// }
/// ```
#[derive(Debug, Serialize)]
pub struct LoginResponse {
    /// JWT access token for authenticated requests
    pub token: String,

    /// Basic user profile information
    pub user: UserResponse,
}

/// Safe user information for API responses.
///
/// This struct contains only non-sensitive user information that can be safely
/// exposed in API responses. It excludes authentication credentials and metadata.
///
/// # Design Notes
/// - Intentionally minimal to reduce information exposure
/// - Role information is included for client-side permission checks
/// - Username is provided for UI display purposes
#[derive(Debug, Serialize)]
pub struct UserResponse {
    /// Username for display and identification purposes
    pub username: String,

    /// User role for client-side permission checking
    pub role: String,
}

/// Tutorial model representing a learning tutorial in the database.
///
/// This struct represents tutorials as stored in the SQLite database. It includes
/// all metadata, content, and categorization information for each tutorial.
///
/// # Design Notes
/// - `topics` is stored as JSON string for database efficiency
/// - `icon` and `color` use Tailwind CSS conventions for UI styling
/// - `version` enables content change tracking and caching strategies
/// - All timestamps use ISO 8601 format for consistency
///
/// # Fields
/// - `id`: Unique identifier (UUID v4 format)
/// - `title`: Human-readable tutorial title
/// - `description`: Brief tutorial summary for listings
/// - `icon`: Icon name for UI display (Lucide icon names)
/// - `color`: Gradient color classes for visual styling
/// - `topics`: JSON string of topic tags for categorization
/// - `content`: Full tutorial content in markdown or HTML
/// - `version`: Integer version for change tracking
/// - `created_at`: Creation timestamp in ISO 8601 format
/// - `updated_at`: Last modification timestamp in ISO 8601 format
#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Tutorial {
    /// Unique identifier for the tutorial (UUID v4)
    pub id: String,

    /// Human-readable title for the tutorial
    pub title: String,

    /// Brief description for tutorial listings and previews
    pub description: String,

    /// Icon name for UI display (Lucide React icons)
    pub icon: String,

    /// Tailwind CSS gradient classes for visual styling
    pub color: String,

    /// JSON string containing topic tags for categorization
    pub topics: String,

    /// Full tutorial content (markdown or HTML format)
    pub content: String,

    /// Version number for content change tracking
    pub version: i64,

    /// Creation timestamp in ISO 8601 format
    pub created_at: String,

    /// Last modification timestamp in ISO 8601 format
    pub updated_at: String,
}

/// Request payload for creating a new tutorial.
///
/// This struct represents the JSON payload sent to the tutorial creation endpoint.
/// It includes all required fields for creating a complete tutorial.
///
/// # Validation Requirements
/// - All string fields must be non-empty
/// - `topics` must contain at least one valid topic
/// - `icon` must be a valid Lucide icon name
/// - `color` must be a valid Tailwind CSS gradient
///
/// # Usage Example
/// ```json
/// {
///   "title": "Linux Basics",
///   "description": "Learn fundamental Linux commands",
///   "icon": "Terminal",
///   "color": "from-blue-500 to-cyan-500",
///   "topics": ["basics", "commands", "terminal"],
///   "content": "# Linux Basics\n\nIn this tutorial..."
/// }
/// ```
#[derive(Debug, Deserialize)]
pub struct CreateTutorialRequest {
    /// Human-readable title for the tutorial
    pub title: String,

    /// Brief description for tutorial listings
    pub description: String,

    /// Icon name for UI display (Lucide icons)
    pub icon: String,

    /// Tailwind CSS gradient classes
    pub color: String,

    /// Array of topic tags for categorization
    pub topics: Vec<String>,

    /// Full tutorial content (markdown or HTML)
    pub content: String,
}

/// Request payload for updating an existing tutorial.
///
/// This struct represents the JSON payload sent to the tutorial update endpoint.
/// All fields are optional to allow partial updates.
///
/// # Update Behavior
/// - Only provided fields will be updated
/// - `null` values are not supported (use Option::None)
/// - Empty strings are considered valid updates for text fields
/// - Empty arrays are considered valid updates for topics
#[derive(Debug, Deserialize)]
pub struct UpdateTutorialRequest {
    /// Updated tutorial title (optional)
    pub title: Option<String>,

    /// Updated description (optional)
    pub description: Option<String>,

    /// Updated icon name (optional)
    pub icon: Option<String>,

    /// Updated color classes (optional)
    pub color: Option<String>,

    /// Updated topic tags (optional)
    pub topics: Option<Vec<String>>,

    /// Updated content (optional)
    pub content: Option<String>,
}

/// Tutorial response model with parsed topics for API consumption.
///
/// This struct represents tutorial data returned to clients. It differs from the
/// database model by having topics as a parsed array instead of JSON string.
///
/// # Design Notes
/// - Topics are deserialized from JSON to a Vec<String> for easier client consumption
/// - All other fields match the database model for consistency
/// - Intended for read-only API responses
#[derive(Debug, Serialize)]
pub struct TutorialResponse {
    /// Unique identifier for the tutorial
    pub id: String,

    /// Human-readable title
    pub title: String,

    /// Brief description
    pub description: String,

    /// Icon name for UI display
    pub icon: String,

    /// Tailwind CSS gradient classes
    pub color: String,

    /// Parsed array of topic tags
    pub topics: Vec<String>,

    /// Full tutorial content
    pub content: String,

    /// Version number for change tracking
    pub version: i64,

    /// Creation timestamp
    pub created_at: String,

    /// Last modification timestamp
    pub updated_at: String,
}

/// Safe conversion from Tutorial database model to TutorialResponse API model.
///
/// This implementation converts the database representation of tutorials to the
/// API response format, parsing the JSON topics string into a proper array.
///
/// # Error Handling
/// Returns detailed error information if JSON parsing fails, including:
/// - Tutorial ID for debugging
/// - Original parsing error
/// - Raw JSON content that failed to parse
///
/// # Usage
/// This conversion is typically used in handlers when returning tutorial data
/// to clients, ensuring they receive properly structured topic arrays.
impl TryFrom<Tutorial> for TutorialResponse {
    /// Error type containing detailed failure information
    type Error = String;

    /// Attempts to convert a Tutorial database model to TutorialResponse.
    ///
    /// # Arguments
    /// * `tutorial` - The tutorial database model to convert
    ///
    /// # Returns
    /// Ok(TutorialResponse) if conversion succeeds, Err(String) if JSON parsing fails
    ///
    /// # Errors
    /// Returns error if the topics field contains invalid JSON
    fn try_from(tutorial: Tutorial) -> Result<Self, Self::Error> {
        // Parse the JSON topics string into a Vec<String>
        let topics: Vec<String> = serde_json::from_str(&tutorial.topics).map_err(|e| {
            format!(
                "Failed to parse topics JSON for tutorial {}: {}. Topics JSON: '{}'",
                tutorial.id, e, tutorial.topics
            )
        })?;

        Ok(TutorialResponse {
            id: tutorial.id,
            title: tutorial.title,
            description: tutorial.description,
            icon: tutorial.icon,
            color: tutorial.color,
            topics,
            content: tutorial.content,
            version: tutorial.version,
            created_at: tutorial.created_at,
            updated_at: tutorial.updated_at,
        })
    }
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {

    /// Error message.
    pub error: String,
}

/// Site content model representing a piece of content on the site.
#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct SiteContent {

    /// Section of the site where the content belongs.
    pub section: String,

    /// JSON content.
    pub content_json: String,

    /// Timestamp when the content was last updated.
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
pub struct SiteContentResponse {

    pub section: String,

    pub content: Value,

    pub updated_at: String,
}

#[derive(Debug, Serialize)]
pub struct SiteContentListResponse {

    pub items: Vec<SiteContentResponse>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSiteContentRequest {

    pub content: Value,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct SitePage {

    pub id: String,

    pub slug: String,

    pub title: String,

    pub description: String,

    pub nav_label: Option<String>,

    pub show_in_nav: bool,

    pub order_index: i64,

    pub is_published: bool,

    pub hero_json: String,

    pub layout_json: String,

    pub created_at: String,

    pub updated_at: String,
}

#[derive(Debug, Serialize)]
pub struct SitePageResponse {

    pub id: String,

    pub slug: String,

    pub title: String,

    pub description: String,

    pub nav_label: Option<String>,

    pub show_in_nav: bool,

    pub order_index: i64,

    pub is_published: bool,

    pub hero: Value,

    pub layout: Value,

    pub created_at: String,

    pub updated_at: String,
}

#[derive(Debug, Serialize)]
pub struct SitePageListResponse {

    pub items: Vec<SitePageResponse>,
}

#[derive(Debug, Serialize)]
pub struct SitePageWithPostsResponse {

    pub page: SitePageResponse,

    pub posts: Vec<SitePostResponse>,
}

#[derive(Debug, Serialize)]
pub struct SitePostDetailResponse {

    pub page: SitePageResponse,

    pub post: SitePostResponse,
}

#[derive(Debug, Deserialize)]
pub struct CreateSitePageRequest {

    pub slug: String,

    pub title: String,

    pub description: Option<String>,

    pub nav_label: Option<String>,

    #[serde(default)]
    pub show_in_nav: bool,

    pub order_index: Option<i64>,

    #[serde(default)]
    pub is_published: bool,

    #[serde(default)]
    pub hero: Value,

    #[serde(default)]
    pub layout: Value,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSitePageRequest {

    pub slug: Option<String>,

    pub title: Option<String>,

    pub description: Option<String>,

    pub nav_label: Option<Option<String>>,

    pub show_in_nav: Option<bool>,

    pub order_index: Option<i64>,

    pub is_published: Option<bool>,

    pub hero: Option<Value>,

    pub layout: Option<Value>,
}

/// Site post model representing a blog post within a page.
#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct SitePost {

    pub id: String,

    pub page_id: String,

    pub title: String,

    pub slug: String,

    pub excerpt: String,

    pub content_markdown: String,

    pub is_published: bool,

    pub published_at: Option<String>,

    pub order_index: i64,

    pub created_at: String,

    pub updated_at: String,
}

#[derive(Debug, Serialize)]
pub struct SitePostResponse {

    pub id: String,

    pub page_id: String,

    pub title: String,

    pub slug: String,

    pub excerpt: String,

    pub content_markdown: String,

    pub is_published: bool,

    pub published_at: Option<String>,

    pub order_index: i64,

    pub created_at: String,

    pub updated_at: String,
}

#[derive(Debug, Serialize)]
pub struct SitePostListResponse {

    pub items: Vec<SitePostResponse>,
}

#[derive(Debug, Deserialize)]
pub struct CreateSitePostRequest {

    pub title: String,

    pub slug: String,

    pub excerpt: Option<String>,

    pub content_markdown: String,

    #[serde(default)]
    pub is_published: bool,

    pub published_at: Option<String>,

    pub order_index: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSitePostRequest {

    pub title: Option<String>,

    pub slug: Option<String>,

    pub excerpt: Option<String>,

    pub content_markdown: Option<String>,

    pub is_published: Option<bool>,

    pub published_at: Option<Option<String>>,

    pub order_index: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct NavigationItemResponse {

    pub id: String,

    pub slug: String,

    pub label: String,

    pub order_index: i64,
}

#[derive(Debug, Serialize)]
pub struct NavigationResponse {

    pub items: Vec<NavigationItemResponse>,
}
