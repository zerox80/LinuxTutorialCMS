use crate::db::DbPool;
use crate::models::User;
use sqlx::{self, FromRow};

#[derive(Debug, FromRow, Clone)]
pub struct LoginAttempt {
    pub fail_count: i64,
    pub blocked_until: Option<String>,
}

pub async fn get_user_by_username(pool: &DbPool, username: &str) -> Result<Option<User>, sqlx::Error> {
    sqlx::query_as::<_, User>("SELECT * FROM users WHERE username = ?")
        .bind(username)
        .fetch_optional(pool)
        .await
}

pub async fn get_login_attempt(pool: &DbPool, username_hash: &str) -> Result<Option<LoginAttempt>, sqlx::Error> {
    sqlx::query_as::<_, LoginAttempt>(
        "SELECT fail_count, blocked_until FROM login_attempts WHERE username = ?",
    )
    .bind(username_hash)
    .fetch_optional(pool)
    .await
}

pub async fn record_failed_login(
    pool: &DbPool,
    username_hash: &str,
    long_block: &str,
    short_block: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO login_attempts (username, fail_count, blocked_until) VALUES (?, 1, NULL) \
         ON CONFLICT(username) DO UPDATE SET fail_count = login_attempts.fail_count + 1, \
         blocked_until = CASE \
             WHEN login_attempts.fail_count + 1 >= 5 THEN ? \
             WHEN login_attempts.fail_count + 1 >= 3 THEN ? \
             ELSE NULL \
         END",
    )
    .bind(username_hash)
    .bind(long_block)
    .bind(short_block)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn clear_login_attempts(pool: &DbPool, username_hash: &str) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM login_attempts WHERE username = ?")
        .bind(username_hash)
        .execute(pool)
        .await?;
    Ok(())
}
