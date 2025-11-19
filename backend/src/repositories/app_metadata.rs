use sqlx::{self, Sqlite};

pub async fn get_metadata<'e, E>(executor: E, key: &str) -> Result<Option<String>, sqlx::Error>
where
    E: sqlx::Executor<'e, Database = Sqlite>,
{
    let result: Option<(String,)> = sqlx::query_as("SELECT value FROM app_metadata WHERE key = ?")
        .bind(key)
        .fetch_optional(executor)
        .await?;

    Ok(result.map(|(v,)| v))
}

pub async fn set_metadata<'e, E>(executor: E, key: &str, value: &str) -> Result<(), sqlx::Error>
where
    E: sqlx::Executor<'e, Database = Sqlite>,
{
    sqlx::query(
        "INSERT INTO app_metadata (key, value) VALUES (?, ?) \
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(key)
    .bind(value)
    .execute(executor)
    .await?;

    Ok(())
}
