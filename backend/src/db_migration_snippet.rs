
async fn apply_comment_migrations(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
) -> Result<(), sqlx::Error> {
    // Check if post_id column exists
    let has_post_id: bool = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pragma_table_info('comments') WHERE name='post_id'",
    )
    .fetch_one(&mut **tx)
    .await
    .map(|count: i64| count > 0)?;

    if !has_post_id {
        tracing::info!("Adding post_id column to comments table");
        sqlx::query("ALTER TABLE comments ADD COLUMN post_id TEXT")
            .execute(&mut **tx)
            .await?;
        
        // Add index for post_id
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id)")
            .execute(&mut **tx)
            .await?;
    }

    // Make tutorial_id nullable? 
    // SQLite doesn't support ALTER COLUMN to remove NOT NULL.
    // We will just allow it to be empty string or handle it in application logic for now
    // to avoid complex table recreation migration.
    // Ideally we would recreate the table, but for this task, adding post_id is sufficient.
    // We will treat empty tutorial_id as "not a tutorial comment".

    Ok(())
}
