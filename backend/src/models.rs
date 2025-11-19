use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::FromRow;
use std::convert::TryFrom;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: i64,

    pub username: String,

    #[serde(skip_serializing)]
    pub password_hash: String,

    pub role: String,

    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,

    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub token: String,

    pub user: UserResponse,
}

#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub username: String,

    pub role: String,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Tutorial {
    pub id: String,

    pub title: String,

    pub description: String,

    pub icon: String,

    pub color: String,

    pub topics: String,

    pub content: String,

    pub version: i64,

    pub created_at: String,

    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateTutorialRequest {
    pub title: String,

    pub description: String,

    pub icon: String,

    pub color: String,

    pub topics: Vec<String>,

    pub content: String,

    pub id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTutorialRequest {
    pub title: Option<String>,

    pub description: Option<String>,

    pub icon: Option<String>,

    pub color: Option<String>,

    pub topics: Option<Vec<String>>,

    pub content: Option<String>,
}

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

#[derive(Debug, Serialize)]
pub struct TutorialSummaryResponse {
    pub id: String,
    pub title: String,
    pub description: String,
    pub icon: String,
    pub color: String,
    pub topics: Vec<String>,
    pub version: i64,
    pub created_at: String,
    pub updated_at: String,
}

impl TryFrom<Tutorial> for TutorialResponse {
    type Error = String;

    fn try_from(tutorial: Tutorial) -> Result<Self, Self::Error> {
        // Parse the JSON topics string into a Vec<String>
        // Gracefully handle parsing errors by logging and returning empty list
        let topics: Vec<String> = serde_json::from_str(&tutorial.topics).unwrap_or_else(|e| {
            tracing::error!(
                "Failed to parse topics JSON for tutorial {}: {}. Topics JSON: '{}'",
                tutorial.id,
                e,
                tutorial.topics
            );
            Vec::new()
        });

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

impl TryFrom<Tutorial> for TutorialSummaryResponse {
    type Error = String;

    fn try_from(tutorial: Tutorial) -> Result<Self, Self::Error> {
        let topics: Vec<String> = serde_json::from_str(&tutorial.topics).unwrap_or_else(|e| {
            tracing::error!(
                "Failed to parse topics JSON for tutorial {}: {}. Topics JSON: '{}'",
                tutorial.id,
                e,
                tutorial.topics
            );
            Vec::new()
        });

        Ok(TutorialSummaryResponse {
            id: tutorial.id,
            title: tutorial.title,
            description: tutorial.description,
            icon: tutorial.icon,
            color: tutorial.color,
            topics,
            version: tutorial.version,
            created_at: tutorial.created_at,
            updated_at: tutorial.updated_at,
        })
    }
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UploadResponse {
    pub url: String,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct SiteContent {
    pub section: String,

    pub content_json: String,

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

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Comment {
    pub id: String,
    pub tutorial_id: Option<String>,
    pub post_id: Option<String>,
    pub author: String,
    pub content: String,
    pub created_at: String,
    pub votes: i64,
    pub is_admin: bool,
}
