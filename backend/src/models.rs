use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::FromRow;
use std::convert::TryFrom;

/// Represents a user record in the database.
#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: i64,
    pub username: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub role: String,
    pub created_at: String,
}

/// Represents the JSON payload for a login request.
#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

/// Represents the JSON response after a successful login.
#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub user: UserResponse,
}

/// Represents public-facing user information.
#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub username: String,
    pub role: String,
}

/// Represents a tutorial record in the database.
#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Tutorial {
    pub id: String,
    pub title: String,
    pub description: String,
    pub icon: String,
    pub color: String,
    pub topics: String, // JSON array as string
    pub content: String,
    pub version: i64,
    pub created_at: String,
    pub updated_at: String,
}

/// Represents the JSON payload for creating a new tutorial.
#[derive(Debug, Deserialize)]
pub struct CreateTutorialRequest {
    pub title: String,
    pub description: String,
    pub icon: String,
    pub color: String,
    pub topics: Vec<String>,
    pub content: String,
}

/// Represents the JSON payload for updating a tutorial.
#[derive(Debug, Deserialize)]
pub struct UpdateTutorialRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub topics: Option<Vec<String>>,
    pub content: Option<String>,
}

/// Represents the JSON response for a tutorial.
#[derive(Debug, Serialize)]
pub struct TutorialResponse {
    pub id: String,
    pub title: String,
    pub description: String,
    pub icon: String,
    pub color: String,
    pub topics: Vec<String>,
    pub content: String,
    pub version: i64,
    pub created_at: String,
    pub updated_at: String,
}

impl TryFrom<Tutorial> for TutorialResponse {
    type Error = String;

    fn try_from(tutorial: Tutorial) -> Result<Self, Self::Error> {
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

/// A generic error response structure.
#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
}

/// Represents a generic site content record from the database.
#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct SiteContent {
    pub section: String,
    pub content_json: String,
    pub updated_at: String,
}

/// Represents a site content section in an API response.
#[derive(Debug, Serialize)]
pub struct SiteContentResponse {
    pub section: String,
    pub content: Value,
    pub updated_at: String,
}

/// Represents a list of all site content sections.
#[derive(Debug, Serialize)]
pub struct SiteContentListResponse {
    pub items: Vec<SiteContentResponse>,
}

/// Represents the JSON payload for updating a site content section.
#[derive(Debug, Deserialize)]
pub struct UpdateSiteContentRequest {
    pub content: Value,
}

/// Represents a dynamic site page from the database.
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

/// Represents a site page in an API response.
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

/// Represents a list of site pages.
#[derive(Debug, Serialize)]
pub struct SitePageListResponse {
    pub items: Vec<SitePageResponse>,
}

/// Represents a site page along with its associated posts.
#[derive(Debug, Serialize)]
pub struct SitePageWithPostsResponse {
    pub page: SitePageResponse,
    pub posts: Vec<SitePostResponse>,
}

/// Represents a single post with its parent page context.
#[derive(Debug, Serialize)]
pub struct SitePostDetailResponse {
    pub page: SitePageResponse,
    pub post: SitePostResponse,
}

/// Represents the JSON payload for creating a new site page.
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

/// Represents the JSON payload for updating a site page.
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

/// Represents a blog post associated with a site page.
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

/// Represents a site post in an API response.
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

/// Represents a list of site posts.
#[derive(Debug, Serialize)]
pub struct SitePostListResponse {
    pub items: Vec<SitePostResponse>,
}

/// Represents the JSON payload for creating a new site post.
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

/// Represents the JSON payload for updating a site post.
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

/// Represents a single item in the navigation menu.
#[derive(Debug, Serialize)]
pub struct NavigationItemResponse {
    pub id: String,
    pub slug: String,
    pub label: String,
    pub order_index: i64,
}

/// Represents the entire navigation structure.
#[derive(Debug, Serialize)]
pub struct NavigationResponse {
    pub items: Vec<NavigationItemResponse>,
}
