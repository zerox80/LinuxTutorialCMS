use crate::db::DbPool;
use crate::models::{CreateTutorialRequest, Tutorial, UpdateTutorialRequest};
use sqlx;
use std::convert::TryInto;

pub async fn list_tutorials(
    pool: &DbPool,
    limit: i64,
    offset: i64,
) -> Result<Vec<Tutorial>, sqlx::Error> {
    sqlx::query_as::<_, Tutorial>(
        "SELECT id, title, description, icon, color, topics, '' as content, version, created_at, updated_at \
         FROM tutorials ORDER BY created_at ASC LIMIT ? OFFSET ?"
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await
}

pub async fn get_tutorial(pool: &DbPool, id: &str) -> Result<Option<Tutorial>, sqlx::Error> {
    sqlx::query_as::<_, Tutorial>("SELECT * FROM tutorials WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn check_tutorial_exists(pool: &DbPool, id: &str) -> Result<bool, sqlx::Error> {
    let exists: Option<(i64,)> = sqlx::query_as("SELECT 1 FROM tutorials WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?;
    Ok(exists.is_some())
}

pub async fn create_tutorial(
    pool: &DbPool,
    id: &str,
    title: &str,
    description: &str,
    content: &str,
    icon: &str,
    color: &str,
    topics_json: &str,
    topics_vec: &[String],
) -> Result<Tutorial, sqlx::Error> {
    let mut tx = pool.begin().await?;

    sqlx::query(
        r#"
        INSERT INTO tutorials (id, title, description, icon, color, topics, content, version)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        "#,
    )
    .bind(id)
    .bind(title)
    .bind(description)
    .bind(icon)
    .bind(color)
    .bind(topics_json)
    .bind(content)
    .execute(&mut *tx)
    .await?;

    replace_tutorial_topics_tx(&mut tx, id, topics_vec).await?;

    let tutorial = sqlx::query_as::<_, Tutorial>(
        "SELECT id, title, description, icon, color, topics, content, version, created_at, updated_at FROM tutorials WHERE id = ?"
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(tutorial)
}

pub async fn update_tutorial(
    pool: &DbPool,
    id: &str,
    title: &str,
    description: &str,
    content: &str,
    icon: &str,
    color: &str,
    topics_json: &str,
    topics_vec: &[String],
    current_version: i32,
) -> Result<Option<Tutorial>, sqlx::Error> {
    let mut tx = pool.begin().await?;

    let new_version = current_version + 1;

    let result = sqlx::query(
        r#"
        UPDATE tutorials
        SET title = ?, description = ?, icon = ?, color = ?, topics = ?, content = ?, version = ?, updated_at = datetime('now')
        WHERE id = ? AND version = ?
        "#,
    )
    .bind(title)
    .bind(description)
    .bind(icon)
    .bind(color)
    .bind(topics_json)
    .bind(content)
    .bind(new_version)
    .bind(id)
    .bind(current_version)
    .execute(&mut *tx)
    .await?;

    if result.rows_affected() == 0 {
        return Ok(None);
    }

    replace_tutorial_topics_tx(&mut tx, id, topics_vec).await?;

    let tutorial = sqlx::query_as::<_, Tutorial>(
        "SELECT id, title, description, icon, color, topics, content, version, created_at, updated_at FROM tutorials WHERE id = ?"
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Some(tutorial))
}

pub async fn delete_tutorial(pool: &DbPool, id: &str) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM tutorials WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;

    Ok(result.rows_affected() > 0)
}

pub(crate) async fn replace_tutorial_topics_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    tutorial_id: &str,
    topics: &[String],
) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM tutorial_topics WHERE tutorial_id = ?")
        .bind(tutorial_id)
        .execute(&mut **tx)
        .await?;

    for topic in topics {
        sqlx::query("INSERT INTO tutorial_topics (tutorial_id, topic) VALUES (?, ?)")
            .bind(tutorial_id)
            .bind(topic)
            .execute(&mut **tx)
            .await?;
    }

    Ok(())
}

pub async fn replace_tutorial_topics(
    pool: &DbPool,
    tutorial_id: &str,
    topics: &[String],
) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;
    replace_tutorial_topics_tx(&mut tx, tutorial_id, topics).await?;
    tx.commit().await?;
    Ok(())
}
