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
    pub topics: String, // JSON array as string
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

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
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
