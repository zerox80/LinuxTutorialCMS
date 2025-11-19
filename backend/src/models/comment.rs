use serde::{Deserialize, Serialize};
use sqlx::FromRow;

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
