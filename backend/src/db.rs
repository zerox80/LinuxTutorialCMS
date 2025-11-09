

/**
 * Database Module - SQLite Database Operations
 *
 * This module provides all database-related functionality for the Linux Tutorial CMS.
 * It handles SQLite database connection management, migrations, and all database operations
 * for tutorials, users, site content, pages, and posts.
 *
 * Architecture:
 * - SQLite with WAL (Write-Ahead Logging) mode for better concurrency
 * - Connection pooling with SQLx for async operations
 * - Comprehensive database migrations and schema management
 * - Full-text search with FTS5 for tutorial content
 * - Foreign key constraints and proper indexing
 *
 * Security Considerations:
 * - SQL injection prevention through parameterized queries
 * - Proper transaction handling for data consistency
 * - Input validation for slugs and user data
 * - Directory permissions for SQLite file storage
 *
 * Performance Features:
 * - Connection pooling (max 5 connections)
 * - Proper indexing on frequently queried columns
 * - FTS5 virtual tables for fast text search
 * - WAL mode for better concurrent access
 */

use regex::Regex;
use serde_json::{json, Value};
use sqlx::{
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
    SqlitePool,
};
use std::env;
use std::path::{Path, PathBuf};
use std::str::FromStr;

/// Type alias for the SQLite connection pool
/// This provides a convenient shorthand for the SqlitePool type used throughout the application
pub type DbPool = SqlitePool;

/// Creates and configures a SQLite database connection pool.
/// Runs migrations and sets up WAL mode with foreign key constraints.
///
/// # Returns
/// Configured database pool or error
///
/// # Errors
/// Returns error if database connection or migration fails
pub async fn create_pool() -> Result<DbPool, sqlx::Error> {

    let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| {
        tracing::warn!("DATABASE_URL not set, defaulting to sqlite:./database.db");
        "sqlite:./database.db".to_string()
    });

    ensure_sqlite_directory(&database_url)?;

    let connect_options = SqliteConnectOptions::from_str(&database_url)?
        .create_if_missing(true)
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
        .synchronous(sqlx::sqlite::SqliteSynchronous::Normal)
        .foreign_keys(true)
        .busy_timeout(std::time::Duration::from_secs(60));

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .min_connections(1)
        .acquire_timeout(std::time::Duration::from_secs(30))
        .idle_timeout(None)
        .max_lifetime(None)
        .connect_with(connect_options)
        .await?;

    run_migrations(&pool).await?;

    tracing::info!("Database pool created successfully");
    Ok(pool)
}

/// Returns a compiled regex pattern for validating URL slugs.
/// Uses OnceLock for thread-safe lazy initialization.
///
/// # Pattern Details
/// - Allows: lowercase letters (a-z), numbers (0-9), and single hyphens
/// - Disallows: consecutive hyphens, leading/trailing hyphens, uppercase letters
/// - Examples of valid slugs: "tutorial-1", "linux-basics", "advanced-networking"
/// - Examples of invalid slugs: "Tutorial", "test--slug", "slug-", "-slug"
///
/// # Returns
/// A static reference to the compiled Regex pattern
fn slug_regex() -> &'static Regex {
    use std::sync::OnceLock;

    static SLUG_RE: OnceLock<Regex> = OnceLock::new();
    SLUG_RE.get_or_init(|| Regex::new(r"^[a-z0-9]+(?:-[a-z0-9]+)*$").expect("valid slug regex"))
}

/// Validates a slug format for URL safety.
/// Slugs must contain only lowercase letters, numbers, and hyphens.
///
/// # Arguments
/// * `slug` - Slug string to validate
///
/// # Returns
/// Ok if valid, Error if invalid
///
/// # Errors
/// Returns error if slug exceeds max length or contains invalid characters
pub fn validate_slug(slug: &str) -> Result<(), sqlx::Error> {
    const MAX_SLUG_LENGTH: usize = 100;

    if slug.len() > MAX_SLUG_LENGTH {
        return Err(sqlx::Error::Protocol(
            format!("Invalid slug. Maximum length is {MAX_SLUG_LENGTH} characters: '{slug}'")
                .into(),
        ));
    }

    if slug_regex().is_match(slug) {
        Ok(())
    } else {
        Err(sqlx::Error::Protocol(
            format!("Invalid slug. Only lowercase letters, numbers and single hyphens allowed: '{slug}'")
                .into(),
        ))
    }
}

/// Serializes a JSON value to a string for database storage.
///
/// # Arguments
/// * `value` - The JSON value to serialize
///
/// # Returns
/// JSON string or database error if serialization fails
///
/// # Error Handling
/// Converts serde_json errors to sqlx::Error for consistent error handling
fn serialize_json_value(value: &Value) -> Result<String, sqlx::Error> {
    serde_json::to_string(value)
        .map_err(|e| sqlx::Error::Protocol(format!("Failed to serialize JSON: {e}").into()))
}

/// Deserializes a JSON string from database storage.
///
/// # Arguments
/// * `value` - The JSON string to deserialize
///
/// # Returns
/// JSON value or database error if deserialization fails
///
/// # Error Handling
/// Converts serde_json errors to sqlx::Error for consistent error handling
fn deserialize_json_value(value: &str) -> Result<Value, sqlx::Error> {
    serde_json::from_str(value)
        .map_err(|e| sqlx::Error::Protocol(format!("Failed to deserialize JSON: {e}").into()))
}

/// Lists all site pages ordered by order_index and title.
///
/// # Arguments
/// * `pool` - Database connection pool
///
/// # Returns
/// Vector of site pages or database error
pub async fn list_site_pages(pool: &DbPool) -> Result<Vec<crate::models::SitePage>, sqlx::Error> {
    sqlx::query_as::<_, crate::models::SitePage>(
        "SELECT id, slug, title, description, nav_label, show_in_nav, order_index, is_published, hero_json, layout_json, created_at, updated_at FROM site_pages ORDER BY order_index, title",
    )
    .fetch_all(pool)
    .await
}

/// Lists published pages that should appear in navigation.
///
/// # Arguments
/// * `pool` - Database connection pool
///
/// # Returns
/// Vector of published navigation pages or database error
pub async fn list_nav_pages(pool: &DbPool) -> Result<Vec<crate::models::SitePage>, sqlx::Error> {
    sqlx::query_as::<_, crate::models::SitePage>(
        "SELECT id, slug, title, description, nav_label, show_in_nav, order_index, is_published, hero_json, layout_json, created_at, updated_at
         FROM site_pages
         WHERE show_in_nav = 1 AND is_published = 1
         ORDER BY order_index, title",
    )
    .fetch_all(pool)
    .await
}

pub async fn list_published_pages(
    pool: &DbPool,
) -> Result<Vec<crate::models::SitePage>, sqlx::Error> {
    sqlx::query_as::<_, crate::models::SitePage>(
        "SELECT id, slug, title, description, nav_label, show_in_nav, order_index, is_published, hero_json, layout_json, created_at, updated_at
         FROM site_pages
         WHERE is_published = 1
         ORDER BY order_index, title",
    )
    .fetch_all(pool)
    .await
}

pub async fn get_site_page_by_id(
    pool: &DbPool,
    id: &str,
) -> Result<Option<crate::models::SitePage>, sqlx::Error> {
    sqlx::query_as::<_, crate::models::SitePage>(
        "SELECT id, slug, title, description, nav_label, show_in_nav, order_index, is_published, hero_json, layout_json, created_at, updated_at FROM site_pages WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn get_site_page_by_slug(
    pool: &DbPool,
    slug: &str,
) -> Result<Option<crate::models::SitePage>, sqlx::Error> {
    sqlx::query_as::<_, crate::models::SitePage>(
        "SELECT id, slug, title, description, nav_label, show_in_nav, order_index, is_published, hero_json, layout_json, created_at, updated_at FROM site_pages WHERE slug = ?",
    )
    .bind(slug)
    .fetch_optional(pool)
    .await
}

pub async fn create_site_page(
    pool: &DbPool,
    page: crate::models::CreateSitePageRequest,
) -> Result<crate::models::SitePage, sqlx::Error> {

    validate_slug(&page.slug)?;

    let id = uuid::Uuid::new_v4().to_string();
    let hero_json = serialize_json_value(&page.hero)?;
    let layout_json = serialize_json_value(&page.layout)?;
    let description = page.description.unwrap_or_default();
    let order_index = page.order_index.unwrap_or(0);

    sqlx::query(
        "INSERT INTO site_pages (id, slug, title, description, nav_label, show_in_nav, order_index, is_published, hero_json, layout_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&page.slug)
    .bind(&page.title)
    .bind(description)
    .bind(page.nav_label)
    .bind(if page.show_in_nav { 1 } else { 0 })
    .bind(order_index)
    .bind(if page.is_published { 1 } else { 0 })
    .bind(hero_json)
    .bind(layout_json)
    .execute(pool)
    .await?;

    get_site_page_by_id(pool, &id)
        .await?
        .ok_or_else(|| sqlx::Error::RowNotFound)
}

pub async fn update_site_page(
    pool: &DbPool,
    id: &str,
    payload: crate::models::UpdateSitePageRequest,
) -> Result<crate::models::SitePage, sqlx::Error> {
    if let Some(slug) = payload.slug.as_deref() {
        validate_slug(slug)?;
    }

    let mut existing = get_site_page_by_id(pool, id)
        .await?
        .ok_or(sqlx::Error::RowNotFound)?;

    if let Some(slug) = payload.slug {
        existing.slug = slug;
    }
    if let Some(title) = payload.title {
        existing.title = title;
    }
    if let Some(description) = payload.description {
        existing.description = description;
    }
    if let Some(nav_label_opt) = payload.nav_label {
        existing.nav_label = nav_label_opt;
    }
    if let Some(show_in_nav) = payload.show_in_nav {
        existing.show_in_nav = show_in_nav;
    }
    if let Some(order_index) = payload.order_index {
        existing.order_index = order_index;
    }
    if let Some(is_published) = payload.is_published {
        existing.is_published = is_published;
    }
    if let Some(hero) = payload.hero {
        existing.hero_json = serialize_json_value(&hero)?;
    }
    if let Some(layout) = payload.layout {
        existing.layout_json = serialize_json_value(&layout)?;
    }

    sqlx::query(
        "UPDATE site_pages
         SET slug = ?, title = ?, description = ?, nav_label = ?, show_in_nav = ?, order_index = ?, is_published = ?, hero_json = ?, layout_json = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?",
    )
    .bind(&existing.slug)
    .bind(&existing.title)
    .bind(&existing.description)
    .bind(&existing.nav_label)
    .bind(if existing.show_in_nav { 1 } else { 0 })
    .bind(existing.order_index)
    .bind(if existing.is_published { 1 } else { 0 })
    .bind(&existing.hero_json)
    .bind(&existing.layout_json)
    .bind(id)
    .execute(pool)
    .await?;

    get_site_page_by_id(pool, id)
        .await?
        .ok_or_else(|| sqlx::Error::RowNotFound)
}

pub async fn delete_site_page(pool: &DbPool, id: &str) -> Result<(), sqlx::Error> {
    let result = sqlx::query("DELETE FROM site_pages WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;

    if result.rows_affected() == 0 {
        Err(sqlx::Error::RowNotFound)
    } else {
        Ok(())
    }
}

pub async fn list_site_posts_for_page(
    pool: &DbPool,
    page_id: &str,
) -> Result<Vec<crate::models::SitePost>, sqlx::Error> {
    sqlx::query_as::<_, crate::models::SitePost>(
        "SELECT id, page_id, title, slug, excerpt, content_markdown, is_published, published_at, order_index, created_at, updated_at
         FROM site_posts
         WHERE page_id = ?
         ORDER BY order_index, created_at",
    )
    .bind(page_id)
    .fetch_all(pool)
    .await
}

pub async fn list_published_posts_for_page(
    pool: &DbPool,
    page_id: &str,
) -> Result<Vec<crate::models::SitePost>, sqlx::Error> {
    sqlx::query_as::<_, crate::models::SitePost>(
        "SELECT id, page_id, title, slug, excerpt, content_markdown, is_published, published_at, order_index, created_at, updated_at
         FROM site_posts
         WHERE page_id = ? AND is_published = 1
         ORDER BY order_index, COALESCE(published_at, created_at)",
    )
    .bind(page_id)
    .fetch_all(pool)
    .await
}

pub async fn get_published_post_by_slug(
    pool: &DbPool,
    page_id: &str,
    post_slug: &str,
) -> Result<Option<crate::models::SitePost>, sqlx::Error> {
    sqlx::query_as::<_, crate::models::SitePost>(
        "SELECT id, page_id, title, slug, excerpt, content_markdown, is_published, published_at, order_index, created_at, updated_at
         FROM site_posts
         WHERE page_id = ? AND slug = ? AND is_published = 1",
    )
    .bind(page_id)
    .bind(post_slug)
    .fetch_optional(pool)
    .await
}

pub async fn get_site_post_by_id(
    pool: &DbPool,
    id: &str,
) -> Result<Option<crate::models::SitePost>, sqlx::Error> {
    sqlx::query_as::<_, crate::models::SitePost>(
        "SELECT id, page_id, title, slug, excerpt, content_markdown, is_published, published_at, order_index, created_at, updated_at
         FROM site_posts WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn create_site_post(
    pool: &DbPool,
    page_id: &str,
    payload: crate::models::CreateSitePostRequest,
) -> Result<crate::models::SitePost, sqlx::Error> {
    validate_slug(&payload.slug)?;

    let id = uuid::Uuid::new_v4().to_string();
    let excerpt = payload.excerpt.unwrap_or_default();
    let order_index = payload.order_index.unwrap_or(0);

    sqlx::query(
        "INSERT INTO site_posts (id, page_id, title, slug, excerpt, content_markdown, is_published, published_at, order_index)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(page_id)
    .bind(&payload.title)
    .bind(&payload.slug)
    .bind(excerpt)
    .bind(&payload.content_markdown)
    .bind(if payload.is_published { 1 } else { 0 })
    .bind(payload.published_at)
    .bind(order_index)
    .execute(pool)
    .await?;

    get_site_post_by_id(pool, &id)
        .await?
        .ok_or_else(|| sqlx::Error::RowNotFound)
}

pub async fn update_site_post(
    pool: &DbPool,
    id: &str,
    payload: crate::models::UpdateSitePostRequest,
) -> Result<crate::models::SitePost, sqlx::Error> {
    if let Some(slug) = payload.slug.as_deref() {
        validate_slug(slug)?;
    }

    let mut existing = get_site_post_by_id(pool, id)
        .await?
        .ok_or(sqlx::Error::RowNotFound)?;

    if let Some(title) = payload.title {
        existing.title = title;
    }
    if let Some(slug) = payload.slug {
        existing.slug = slug;
    }
    if let Some(excerpt) = payload.excerpt {
        existing.excerpt = excerpt;
    }
    if let Some(content) = payload.content_markdown {
        existing.content_markdown = content;
    }
    if let Some(is_published) = payload.is_published {
        existing.is_published = is_published;
    }
    if let Some(published_at) = payload.published_at {
        existing.published_at = published_at;
    }
    if let Some(order_index) = payload.order_index {
        existing.order_index = order_index;
    }

    sqlx::query(
        "UPDATE site_posts
         SET title = ?, slug = ?, excerpt = ?, content_markdown = ?, is_published = ?, published_at = ?, order_index = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?",
    )
    .bind(&existing.title)
    .bind(&existing.slug)
    .bind(&existing.excerpt)
    .bind(&existing.content_markdown)
    .bind(if existing.is_published { 1 } else { 0 })
    .bind(&existing.published_at)
    .bind(existing.order_index)
    .bind(id)
    .execute(pool)
    .await?;

    get_site_post_by_id(pool, id)
        .await?
        .ok_or_else(|| sqlx::Error::RowNotFound)
}

pub async fn delete_site_post(pool: &DbPool, id: &str) -> Result<(), sqlx::Error> {
    let result = sqlx::query("DELETE FROM site_posts WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;

    if result.rows_affected() == 0 {
        Err(sqlx::Error::RowNotFound)
    } else {
        Ok(())
    }
}

/// Creates and ensures the site page database schema exists.
/// This function creates tables for site content, pages, and posts with proper indexes.
///
/// # Arguments
/// * `pool` - Database connection pool
///
/// # Returns
/// Ok if schema creation succeeds, error otherwise
///
/// # Tables Created
/// - site_content: JSON content for different site sections
/// - site_pages: Main pages with navigation and publication settings
/// - site_posts: Blog posts within pages
///
/// # Security
/// Uses proper foreign key constraints and unique indexes to prevent data corruption
async fn ensure_site_page_schema(pool: &DbPool) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS site_content (
            section TEXT PRIMARY KEY,
            content_json TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS site_pages (
            id TEXT PRIMARY KEY,
            slug TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            nav_label TEXT,
            show_in_nav INTEGER NOT NULL DEFAULT 0,
            order_index INTEGER NOT NULL DEFAULT 0,
            is_published INTEGER NOT NULL DEFAULT 0,
            hero_json TEXT NOT NULL DEFAULT '{}',
            layout_json TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_site_pages_nav ON site_pages(show_in_nav, order_index)",
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS site_posts (
            id TEXT PRIMARY KEY,
            page_id TEXT NOT NULL,
            title TEXT NOT NULL,
            slug TEXT NOT NULL,
            excerpt TEXT DEFAULT '',
            content_markdown TEXT NOT NULL,
            is_published INTEGER NOT NULL DEFAULT 0,
            published_at TEXT,
            order_index INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(page_id) REFERENCES site_pages(id) ON DELETE CASCADE
        )",
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_site_posts_unique_slug ON site_posts(page_id, slug)",
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_site_posts_page_published ON site_posts(page_id, is_published, published_at)",
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(())
}

/// Applies core database migrations for the main application schema.
/// Creates all essential tables, indexes, and triggers for the CMS functionality.
///
/// # Arguments
/// * `tx` - Database transaction for atomic migration execution
///
/// # Returns
/// Ok if migrations succeed, error otherwise
///
/// # Schema Components Created
/// - users: Admin user accounts with bcrypt password hashing
/// - login_attempts: Failed login attempt tracking for security
/// - tutorials: Main tutorial content with versioning
/// - tutorial_topics: Many-to-many relationship for tutorial categorization
/// - comments: User comments on tutorials
/// - tutorials_fts: Full-text search table using FTS5
/// - Triggers: Automatic FTS index maintenance
///
/// # Security Features
/// - Foreign key constraints for data integrity
/// - Proper indexing for performance and security
/// - FTS5 triggers for automatic search index updates
/// - UNIQUE constraints on usernames and tutorial IDs
async fn apply_core_migrations(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
) -> Result<(), sqlx::Error> {

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'admin',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            CONSTRAINT users_username_unique UNIQUE (username)
        )
        "#,
    )
    .execute(&mut **tx)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS login_attempts (
            username TEXT PRIMARY KEY,
            fail_count INTEGER NOT NULL DEFAULT 0,
            blocked_until TEXT
        )
        "#,
    )
    .execute(&mut **tx)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS tutorials (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            icon TEXT NOT NULL,
            color TEXT NOT NULL,
            topics TEXT NOT NULL,
            content TEXT NOT NULL DEFAULT '',
            version INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
        "#,
    )
    .execute(&mut **tx)
    .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_tutorials_created_at ON tutorials(created_at)")
        .execute(&mut **tx)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_tutorials_updated_at ON tutorials(updated_at)")
        .execute(&mut **tx)
        .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS app_metadata (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
        "#,
    )
    .execute(&mut **tx)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS tutorial_topics (
            tutorial_id TEXT NOT NULL,
            topic TEXT NOT NULL,
            CONSTRAINT fk_tutorial_topics_tutorial FOREIGN KEY (tutorial_id) REFERENCES tutorials(id) ON DELETE CASCADE ON UPDATE CASCADE
        )
        "#,
    )
    .execute(&mut **tx)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_tutorial_topics_tutorial ON tutorial_topics(tutorial_id)",
    )
    .execute(&mut **tx)
    .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_tutorial_topics_topic ON tutorial_topics(topic)")
        .execute(&mut **tx)
        .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS comments (
            id TEXT PRIMARY KEY,
            tutorial_id TEXT NOT NULL,
            author TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            CONSTRAINT fk_comments_tutorial FOREIGN KEY (tutorial_id) REFERENCES tutorials(id) ON DELETE CASCADE
        )
        "#,
    )
    .execute(&mut **tx)
    .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_comments_tutorial ON comments(tutorial_id)")
        .execute(&mut **tx)
        .await?;

    sqlx::query("DROP TRIGGER IF EXISTS tutorials_ai")
        .execute(&mut **tx)
        .await?;
    sqlx::query("DROP TRIGGER IF EXISTS tutorials_ad")
        .execute(&mut **tx)
        .await?;
    sqlx::query("DROP TRIGGER IF EXISTS tutorials_au")
        .execute(&mut **tx)
        .await?;
    sqlx::query("DROP TABLE IF EXISTS tutorials_fts")
        .execute(&mut **tx)
        .await?;

    sqlx::query(
        r#"
        CREATE VIRTUAL TABLE tutorials_fts USING fts5(
            tutorial_id UNINDEXED,
            title,
            description,
            content,
            topics
        )
        "#,
    )
    .execute(&mut **tx)
    .await?;

    sqlx::query(
        r#"
        CREATE TRIGGER tutorials_ai AFTER INSERT ON tutorials BEGIN
            INSERT INTO tutorials_fts(tutorial_id, title, description, content, topics)
            VALUES (new.id, new.title, new.description, new.content, new.topics);
        END
        "#,
    )
    .execute(&mut **tx)
    .await?;

    sqlx::query(
        r#"
        CREATE TRIGGER tutorials_ad AFTER DELETE ON tutorials BEGIN
            DELETE FROM tutorials_fts WHERE tutorial_id = old.id;
        END
        "#,
    )
    .execute(&mut **tx)
    .await?;

    sqlx::query(
        r#"
        CREATE TRIGGER tutorials_au AFTER UPDATE ON tutorials BEGIN
            DELETE FROM tutorials_fts WHERE tutorial_id = old.id;
            INSERT INTO tutorials_fts(tutorial_id, title, description, content, topics)
            VALUES (new.id, new.title, new.description, new.content, new.topics);
        END
        "#,
    )
    .execute(&mut **tx)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO tutorials_fts(tutorial_id, title, description, content, topics)
        SELECT id, title, description, content, topics FROM tutorials
        "#,
    )
    .execute(&mut **tx)
    .await?;

    Ok(())
}

pub async fn fetch_all_site_content(
    pool: &DbPool,
) -> Result<Vec<crate::models::SiteContent>, sqlx::Error> {
    sqlx::query_as::<_, crate::models::SiteContent>(
        "SELECT section, content_json, updated_at FROM site_content ORDER BY section",
    )
    .fetch_all(pool)
    .await
}

pub async fn fetch_site_content_by_section(
    pool: &DbPool,
    section: &str,
) -> Result<Option<crate::models::SiteContent>, sqlx::Error> {
    sqlx::query_as::<_, crate::models::SiteContent>(
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
) -> Result<crate::models::SiteContent, sqlx::Error> {
    let serialized = serde_json::to_string(content).map_err(|e| {
        sqlx::Error::Protocol(format!("Failed to serialize content JSON: {}", e).into())
    })?;

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

/// Seeds default site content for a fresh installation.
/// Inserts predefined content for hero section, navigation, footer, and default pages.
///
/// # Arguments
/// * `tx` - Database transaction for atomic seeding
///
/// # Returns
/// Ok if seeding succeeds, error otherwise
///
/// # Content Sections Created
/// - hero: Homepage hero section with call-to-action
/// - tutorial_section: Tutorial listing section configuration
/// - site_meta: SEO metadata and site information
/// - header: Navigation header configuration
/// - footer: Footer links and branding
/// - grundlagen_page: Basic Linux tutorial page content
///
/// # Behavior
/// Only inserts content if sections don't already exist
/// Preserves existing content to avoid overwriting user customizations
async fn seed_site_content_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
) -> Result<(), sqlx::Error> {
    for (section, content) in default_site_content() {
        let exists: Option<(String,)> =
            sqlx::query_as("SELECT section FROM site_content WHERE section = ?")
                .bind(section)
                .fetch_optional(&mut **tx)
                .await?;

        if exists.is_some() {
            continue;
        }

        sqlx::query("INSERT INTO site_content (section, content_json) VALUES (?, ?)")
            .bind(section)
            .bind(content.to_string())
            .execute(&mut **tx)
            .await?;
    }

    Ok(())
}

/// Returns the default site content for a fresh installation.
/// Provides comprehensive starting content with German language defaults.
///
/// # Returns
/// Vector of (section_name, JSON_content) tuples
///
/// # Content Sections
/// Each section is carefully designed to provide a complete website experience:
/// - SEO-optimized meta tags and descriptions
/// - Responsive navigation with proper routing
/// - Compelling hero section with feature highlights
/// - Tutorial section with clear call-to-actions
/// - Professional footer with contact links
/// - Basic Linux tutorial page with structured learning path
///
/// # Design Principles
/// - Mobile-first responsive design
/// - Clear information hierarchy
/// - Engaging call-to-action elements
/// - Professional German-language content
/// - Accessibility-friendly structure
fn default_site_content() -> Vec<(&'static str, serde_json::Value)> {
    vec![
        (
            "hero",
            json!({
                "badgeText": "Professionelles Linux Training",
                "title": {
                    "line1": "Lerne Linux",
                    "line2": "von Grund auf"
                },
                "subtitle": "Dein umfassendes Tutorial für Linux – von den Basics bis zu Advanced-Techniken.",
                "subline": "Interaktiv, modern und praxisnah.",
                "primaryCta": {
                    "label": "Los geht's",
                    "target": { "type": "section", "value": "tutorials" }
                },
                "secondaryCta": {
                    "label": "Mehr erfahren",
                    "target": { "type": "section", "value": "tutorials" }
                },
                "features": [
                    {
                        "icon": "Book",
                        "title": "Schritt für Schritt",
                        "description": "Strukturiert lernen mit klaren Beispielen",
                        "color": "from-blue-500 to-cyan-500"
                    },
                    {
                        "icon": "Code",
                        "title": "Praktische Befehle",
                        "description": "Direkt anwendbare Kommandos",
                        "color": "from-purple-500 to-pink-500"
                    },
                    {
                        "icon": "Zap",
                        "title": "Modern & Aktuell",
                        "description": "Neueste Best Practices",
                        "color": "from-orange-500 to-red-500"
                    }
                ]
            }),
        ),
        (
            "tutorial_section",
            json!({
                "title": "Tutorial Inhalte",
                "description": "Umfassende Lernmodule für alle Erfahrungsstufen – vom Anfänger bis zum Profi",
                "heading": "Bereit anzufangen?",
                "ctaDescription": "Wähle ein Thema aus und starte deine Linux-Lernreise noch heute!",
                "ctaPrimary": {
                    "label": "Tutorial starten",
                    "target": { "type": "section", "value": "home" }
                },
                "ctaSecondary": {
                    "label": "Mehr erfahren",
                    "target": { "type": "section", "value": "home" }
                },
                "tutorialCardButton": "Zum Tutorial"
            })
        ),
        (
            "site_meta",
            json!({
                "title": "Linux Tutorial - Lerne Linux Schritt für Schritt",
                "description": "Lerne Linux von Grund auf - Interaktiv, modern und praxisnah."
            })
        ),
        (
            "header",
            json!({
                "brand": {
                    "name": "Linux Tutorial",
                    "tagline": "",
                    "icon": "Terminal"
                },
                "navItems": [
                    { "id": "home", "label": "Home", "type": "section" },
                    { "id": "grundlagen", "label": "Grundlagen", "type": "route", "path": "/grundlagen" },
                    { "id": "befehle", "label": "Befehle", "type": "section" },
                    { "id": "praxis", "label": "Praxis", "type": "section" },
                    { "id": "advanced", "label": "Advanced", "type": "section" }
                ],
                "cta": {
                    "guestLabel": "Login",
                    "authLabel": "Admin",
                    "icon": "Lock"
                }
            }),
        ),
        (
            "footer",
            json!({
                "brand": {
                    "title": "Linux Tutorial",
                    "description": "Dein umfassendes Tutorial für Linux - von den Basics bis zu Advanced Techniken.",
                    "icon": "Terminal"
                },
                "quickLinks": [
                    { "label": "Grundlagen", "target": { "type": "section", "value": "grundlagen" } },
                    { "label": "Befehle", "target": { "type": "section", "value": "befehle" } },
                    { "label": "Praxis", "target": { "type": "section", "value": "praxis" } },
                    { "label": "Advanced", "target": { "type": "section", "value": "advanced" } }
                ],
                "contactLinks": [
                    { "label": "GitHub", "href": "https://github.com", "icon": "Github" },
                    { "label": "E-Mail", "href": "mailto:info@example.com", "icon": "Mail" }
                ],
                "bottom": {
                    "copyright": "© {year} Linux Tutorial. Alle Rechte vorbehalten.",
                    "signature": "Gemacht mit Herz für die Linux Community"
                }
            }),
        ),
        (
            "grundlagen_page",
            json!({
                "hero": {
                    "badge": "Grundlagenkurs",
                    "title": "Starte deine Linux-Reise mit einem starken Fundament",
                    "description": "In diesem Grundlagenbereich begleiten wir dich von den allerersten Schritten im Terminal bis hin zu sicheren Arbeitsabläufen. Nach diesem Kurs bewegst du dich selbstbewusst in der Linux-Welt.",
                    "icon": "BookOpen"
                },
                "highlights": [
                    {
                        "icon": "BookOpen",
                        "title": "Terminal Basics verstehen",
                        "description": "Lerne die wichtigsten Shell-Befehle, arbeite sicher mit Dateien und nutze Pipes, um Aufgaben zu automatisieren."
                    },
                    {
                        "icon": "Compass",
                        "title": "Linux-Philosophie kennenlernen",
                        "description": "Verstehe das Zusammenspiel von Kernel, Distribution, Paketverwaltung und warum Linux so flexibel einsetzbar ist."
                    },
                    {
                        "icon": "Layers",
                        "title": "Praxisnahe Übungen",
                        "description": "Setze das Erlernte direkt in kleinen Projekten um – von der Benutzerverwaltung bis zum Einrichten eines Webservers."
                    },
                    {
                        "icon": "ShieldCheck",
                        "title": "Sicher arbeiten",
                        "description": "Erhalte Best Practices für Benutzerrechte, sudo, SSH und weitere Sicherheitsmechanismen."
                    }
                ],
                "modules": {
                    "title": "Module im Grundlagenkurs",
                    "description": "Unsere Tutorials bauen logisch aufeinander auf. Jedes Modul enthält praxisnahe Beispiele, Schritt-für-Schritt Anleitungen und kleine Wissenschecks, damit du deinen Fortschritt direkt sehen kannst.",
                    "items": [
                        "Einstieg in die Shell: Navigation, grundlegende Befehle, Dateiverwaltung",
                        "Linux-Systemaufbau: Kernel, Distributionen, Paketmanager verstehen und nutzen",
                        "Benutzer & Rechte: Arbeiten mit sudo, Gruppen und Dateiberechtigungen",
                        "Wichtige Tools: SSH, einfache Netzwerkanalyse und nützliche Utilities für den Alltag"
                    ],
                    "summary": [
                        "Über 40 praxisnahe Lessons",
                        "Schritt-für-Schritt Guides mit Screenshots & Code-Beispielen",
                        "Übungen und Checklisten zum Selbstüberprüfen"
                    ]
                },
                "cta": {
                    "title": "Bereit für den nächsten Schritt?",
                    "description": "Wechsel zur Startseite und wähle das Modul, das am besten zu dir passt, oder tauche direkt in die Praxis- und Advanced-Themen ein, sobald du die Grundlagen sicher beherrschst.",
                    "primary": { "label": "Zur Startseite", "href": "/" },
                    "secondary": { "label": "Tutorials verwalten", "href": "/admin" }
                }
            }),
        ),
    ]
}

fn ensure_sqlite_directory(database_url: &str) -> Result<(), sqlx::Error> {
    if let Some(db_path) = sqlite_file_path(database_url) {
        if let Some(parent) = db_path.parent() {
            if parent != Path::new("") && parent != Path::new(".") {
                if let Err(err) = std::fs::create_dir_all(parent) {
                    tracing::error!(error = %err, path = ?parent, "Failed to create SQLite directory");
                    return Err(sqlx::Error::Io(err));
                }
                tracing::info!(path = ?parent, "Ensured SQLite directory exists");
            }
        }
    }

    Ok(())
}

fn sqlite_file_path(database_url: &str) -> Option<PathBuf> {
    const PREFIX: &str = "sqlite:";

    if !database_url.starts_with(PREFIX) {
        return None;
    }

    let mut remainder = &database_url[PREFIX.len()..];

    if remainder.starts_with(':') || remainder.is_empty() {
        return None;
    }

    if let Some((path_part, _)) = remainder.split_once('?') {
        remainder = path_part;
    }

    let normalized = if remainder.starts_with("///") {
        &remainder[2..]
    } else if remainder.starts_with("//") {
        &remainder[1..]
    } else {
        remainder
    };

    if normalized.trim().is_empty() {
        return None;
    }

    Some(PathBuf::from(normalized))
}

/// Runs all database migrations and initializes the application state.
/// This is the main entry point for database setup and includes:
/// - Core schema migrations
/// - Site page schema setup
/// - Default content seeding
/// - Admin user creation from environment variables
///
/// # Arguments
/// * `pool` - Database connection pool
///
/// # Returns
/// Ok if all migrations succeed, error otherwise
///
/// # Environment Variables
/// - ADMIN_USERNAME: Creates admin user if set (non-empty)
/// - ADMIN_PASSWORD: Password for admin user (must be ≥12 characters)
/// - ENABLE_DEFAULT_TUTORIALS: Set to "true" to seed default tutorials
///
/// # Security
/// - Admin password must meet NIST minimum length requirement (12 chars)
/// - Default tutorials are only seeded if database is empty
/// - All operations run in transactions for data consistency
///
/// # Error Handling
/// Rolls back transactions on any migration failure
/// Validates admin password strength before creating users
pub async fn run_migrations(pool: &DbPool) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;

    if let Err(err) = apply_core_migrations(&mut tx).await {
        tx.rollback().await?;
        return Err(err);
    }

    tx.commit().await?;

    ensure_site_page_schema(pool).await?;

    {
        let mut tx = pool.begin().await?;
        seed_site_content_tx(&mut tx).await?;
        tx.commit().await?;
    }

    let admin_username = env::var("ADMIN_USERNAME").ok();
    let admin_password = env::var("ADMIN_PASSWORD").ok();

    match (admin_username, admin_password) {
        (Some(username), Some(password)) if !username.is_empty() && !password.is_empty() => {

            if password.len() < 12 {
                tracing::error!(
                    "ADMIN_PASSWORD must be at least 12 characters long (NIST recommendation)!"
                );
                return Err(sqlx::Error::Protocol("Admin password too weak".into()));
            }

            let existing_user: Option<(i64, String)> =
                sqlx::query_as("SELECT id, password_hash FROM users WHERE username = ?")
                    .bind(&username)
                    .fetch_optional(pool)
                    .await?;

            match existing_user {
                Some((_, current_hash)) => match bcrypt::verify(&password, &current_hash) {
                    Ok(true) => {
                        tracing::info!(
                            "Admin user '{}' already exists with correct password",
                            username
                        );
                    }
                    Ok(false) => {
                        tracing::warn!("ADMIN_PASSWORD for '{}' differs from stored credentials; keeping existing hash to preserve runtime changes.", username);
                    }
                    Err(e) => {
                        tracing::error!("Password verification failed: {}", e);
                        return Err(sqlx::Error::Protocol("Password verification error".into()));
                    }
                },
                None => {

                    let password_hash =
                        bcrypt::hash(&password, bcrypt::DEFAULT_COST).map_err(|e| {
                            tracing::error!("Failed to hash admin password: {}", e);
                            sqlx::Error::Protocol("Failed to hash admin password".into())
                        })?;
                    sqlx::query(
                        "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
                    )
                    .bind(&username)
                    .bind(password_hash)
                    .bind("admin")
                    .execute(pool)
                    .await?;

                    tracing::info!("Created admin user '{}'", username);
                }
            }
        }
        _ => {
            tracing::warn!(
                "ADMIN_USERNAME and ADMIN_PASSWORD not set or empty. No admin user created."
            );
            tracing::warn!("Set these environment variables to create an admin user on startup.");
        }
    }

    let seed_enabled = env::var("ENABLE_DEFAULT_TUTORIALS")
        .map(|v| v.trim().eq_ignore_ascii_case("true"))
        .unwrap_or(false);

    let mut tx = pool.begin().await?;

    if seed_enabled {

        let already_seeded: Option<(String,)> =
            sqlx::query_as("SELECT value FROM app_metadata WHERE key = 'default_tutorials_seeded'")
                .fetch_optional(&mut *tx)
                .await?;

        let tutorial_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM tutorials")
            .fetch_one(&mut *tx)
            .await?;

        if already_seeded.is_none() && tutorial_count.0 == 0 {
            insert_default_tutorials_tx(&mut tx).await?;
            let timestamp = chrono::Utc::now().to_rfc3339();
            sqlx::query(
                "INSERT INTO app_metadata (key, value) VALUES ('default_tutorials_seeded', ?) \
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            )
            .bind(timestamp)
            .execute(&mut *tx)
            .await?;
            tracing::info!("Inserted default tutorials");
        }
    } else {
        tracing::info!(
            "ENABLE_DEFAULT_TUTORIALS disabled or not set – skipping default tutorial seeding"
        );
    }

    tx.commit().await?;

    Ok(())
}

async fn insert_default_tutorials_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
) -> Result<(), sqlx::Error> {
    let tutorials = vec![
        (
            "1",
            "Grundlegende Befehle",
            "Lerne die wichtigsten Linux-Befehle für die tägliche Arbeit im Terminal.",
            "Terminal",
            "from-blue-500 to-cyan-500",
            vec![
                "ls", "cd", "pwd", "mkdir", "rm", "cp", "mv", "cat", "grep", "find", "chmod",
                "chown",
            ],
        ),
        (
            "2",
            "Dateisystem & Navigation",
            "Verstehe die Linux-Dateistruktur und navigiere effizient durch Verzeichnisse.",
            "FolderTree",
            "from-green-500 to-emerald-500",
            vec![
                "Verzeichnisstruktur",
                "Absolute vs. Relative Pfade",
                "Symlinks",
                "Mount Points",
            ],
        ),
        (
            "3",
            "Text-Editoren",
            "Beherrsche vim, nano und andere Editoren für die Arbeit in der Kommandozeile.",
            "FileText",
            "from-purple-500 to-pink-500",
            vec!["vim Basics", "nano Befehle", "sed & awk", "Regex Patterns"],
        ),
        (
            "4",
            "Prozessverwaltung",
            "Verwalte und überwache Prozesse effektiv in deinem Linux-System.",
            "Settings",
            "from-orange-500 to-red-500",
            vec![
                "ps",
                "top",
                "htop",
                "kill",
                "pkill",
                "Background Jobs",
                "systemctl",
            ],
        ),
        (
            "5",
            "Berechtigungen & Sicherheit",
            "Verstehe Benutzerrechte, Gruppen und Sicherheitskonzepte.",
            "Shield",
            "from-indigo-500 to-blue-500",
            vec!["User & Groups", "chmod & chown", "sudo & su", "SSH & Keys"],
        ),
        (
            "6",
            "Netzwerk-Grundlagen",
            "Konfiguriere Netzwerke und nutze wichtige Netzwerk-Tools.",
            "Network",
            "from-teal-500 to-green-500",
            vec![
                "ip & ifconfig",
                "ping",
                "traceroute",
                "netstat",
                "ss",
                "curl & wget",
            ],
        ),
        (
            "7",
            "Bash Scripting",
            "Automatisiere Aufgaben mit Shell-Scripts und Bash-Programmierung.",
            "Database",
            "from-yellow-500 to-orange-500",
            vec![
                "Variables & Loops",
                "If-Statements",
                "Functions",
                "Cron Jobs",
            ],
        ),
        (
            "8",
            "System Administration",
            "Erweiterte Admin-Aufgaben und Systemwartung.",
            "Server",
            "from-red-500 to-pink-500",
            vec![
                "Package Manager",
                "Logs & Monitoring",
                "Backup & Recovery",
                "Performance Tuning",
            ],
        ),
    ];

    for (id, title, description, icon, color, topics) in tutorials {
        let topics_vec: Vec<String> = topics.into_iter().map(|topic| topic.to_string()).collect();

        if sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM tutorials WHERE id = ?")
            .bind(id)
            .fetch_one(&mut **tx)
            .await?
            > 0
        {
            continue;
        }

        if let Err(err) = crate::handlers::tutorials::validate_icon(icon) {
            tracing::warn!(
                "Skipping default tutorial '{}' due to invalid icon: {}",
                id,
                err
            );
            continue;
        }

        if let Err(err) = crate::handlers::tutorials::validate_color(color) {
            tracing::warn!(
                "Skipping default tutorial '{}' due to invalid color: {}",
                id,
                err
            );
            continue;
        }

        let topics_json = serde_json::to_string(&topics_vec).map_err(|e| {
            sqlx::Error::Protocol(
                format!(
                    "Failed to serialize topics for default tutorial '{}': {}",
                    id, e
                )
                .into(),
            )
        })?;

        sqlx::query(
            "INSERT INTO tutorials (id, title, description, icon, color, topics, content, version) VALUES (?, ?, ?, ?, ?, ?, ?, 1)"
        )
        .bind(id)
        .bind(title)
        .bind(description)
        .bind(icon)
        .bind(color)
        .bind(topics_json)
        .bind("")
        .execute(&mut **tx)
        .await?;

        replace_tutorial_topics_tx(tx, id, &topics_vec).await?;
    }

    Ok(())
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
