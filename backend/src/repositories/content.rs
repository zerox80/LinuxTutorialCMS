use crate::db::DbPool;
use crate::models::SiteContent;
use crate::repositories::common::serialize_json_value;
use serde_json::Value;
use sqlx;

pub async fn fetch_all_site_content(
    pool: &DbPool,
) -> Result<Vec<SiteContent>, sqlx::Error> {
    sqlx::query_as::<_, SiteContent>(
        "SELECT section, content_json, updated_at FROM site_content ORDER BY section",
    )
    .fetch_all(pool)
    .await
}

pub async fn fetch_site_content_by_section(
    pool: &DbPool,
    section: &str,
) -> Result<Option<SiteContent>, sqlx::Error> {
    sqlx::query_as::<_, SiteContent>(
        "SELECT section, content_json, updated_at FROM site_content WHERE section = ?",
    )
    .bind(section)
    .fetch_optional(pool)
    .await
}

pub async fn upsert_site_content(
    pool: &DbPool,
    section: &str,
    content: &Value,
) -> Result<SiteContent, sqlx::Error> {
    let serialized = serialize_json_value(content)?;

    sqlx::query(
        "INSERT INTO site_content (section, content_json, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) \
         ON CONFLICT(section) DO UPDATE SET content_json = excluded.content_json, updated_at = CURRENT_TIMESTAMP",
    )
    .bind(section)
    .bind(serialized)
    .execute(pool)
    .await?;

    fetch_site_content_by_section(pool, section)
        .await?
        .ok_or_else(|| sqlx::Error::RowNotFound)
}
