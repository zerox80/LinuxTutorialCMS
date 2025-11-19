use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use std::convert::TryFrom;

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
