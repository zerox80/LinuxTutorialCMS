use sqlx::{
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
    SqlitePool,
};
use regex::Regex;
use serde_json::{json, Value};
use std::env;
use std::path::{Path, PathBuf};
use std::str::FromStr;

pub type DbPool = SqlitePool;

/// Creates and configures the database connection pool.
///
/// This function reads the `DATABASE_URL` environment variable, ensures the
/// necessary directory structure exists for SQLite, and runs database migrations.
///
/// # Returns
///
/// A `Result` containing the configured `DbPool` or a `sqlx::Error`.
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

/// Returns a cached regex for slug validation.
fn slug_regex() -> &'static Regex {
    use std::sync::OnceLock;

    static SLUG_RE: OnceLock<Regex> = OnceLock::new();
    SLUG_RE.get_or_init(|| Regex::new(r"^[a-z0-9]+(?:-[a-z0-9]+)*$").expect("valid slug regex"))
}

/// Validates a slug string.
///
/// A valid slug must:
/// - Be no longer than 100 characters.
/// - Contain only lowercase letters, numbers, and single hyphens.
///
/// # Returns
///
/// `Ok(())` if the slug is valid, otherwise an `Err(sqlx::Error)`.
pub fn validate_slug(slug: &str) -> Result<(), sqlx::Error> {
    const MAX_SLUG_LENGTH: usize = 100;

    if slug.len() > MAX_SLUG_LENGTH {
        return Err(sqlx::Error::Protocol(
            format!(
                "Invalid slug. Maximum length is {MAX_SLUG_LENGTH} characters: '{slug}'"
            )
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

/// Serializes a `serde_json::Value` to a `String`.
fn serialize_json_value(value: &Value) -> Result<String, sqlx::Error> {
    serde_json::to_string(value).map_err(|e| sqlx::Error::Protocol(format!("Failed to serialize JSON: {e}").into()))
}

/// Deserializes a `&str` into a `serde_json::Value`.
fn deserialize_json_value(value: &str) -> Result<Value, sqlx::Error> {
    serde_json::from_str(value).map_err(|e| sqlx::Error::Protocol(format!("Failed to deserialize JSON: {e}").into()))
}

/// Fetches all site pages from the database, ordered by `order_index` and `title`.
pub async fn list_site_pages(pool: &DbPool) -> Result<Vec<crate::models::SitePage>, sqlx::Error> {
    sqlx::query_as::<_, crate::models::SitePage>(
        "SELECT id, slug, title, description, nav_label, show_in_nav, order_index, is_published, hero_json, layout_json, created_at, updated_at FROM site_pages ORDER BY order_index, title",
    )
    .fetch_all(pool)
    .await
}

/// Fetches all published pages that should be shown in navigation menus.
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

/// Fetches all published pages.
pub async fn list_published_pages(pool: &DbPool) -> Result<Vec<crate::models::SitePage>, sqlx::Error> {
    sqlx::query_as::<_, crate::models::SitePage>(
        "SELECT id, slug, title, description, nav_label, show_in_nav, order_index, is_published, hero_json, layout_json, created_at, updated_at
         FROM site_pages
         WHERE is_published = 1
         ORDER BY order_index, title",
    )
    .fetch_all(pool)
    .await
}

/// Fetches a single site page by its ID.
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

/// Fetches a single site page by its slug.
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

/// Creates a new site page in the database.
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

/// Updates an existing site page.
pub async fn update_site_page(
    pool: &DbPool,
    id: &str,
    payload: crate::models::UpdateSitePageRequest,
) -> Result<crate::models::SitePage, sqlx::Error> {
    if let Some(slug) = payload.slug.as_deref() {
        validate_slug(slug)?;
    }

    let mut existing = get_site_page_by_id(pool, id).await?.ok_or(sqlx::Error::RowNotFound)?;

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

/// Deletes a site page by its ID.
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

/// Fetches all posts associated with a specific page, for admin views.
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

/// Fetches all published posts for a specific page.
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

/// Fetches a single published post by its slug and parent page ID.
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

/// Fetches a single post by its ID.
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

/// Creates a new site post.
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

/// Updates an existing site post.
pub async fn update_site_post(
    pool: &DbPool,
    id: &str,
    payload: crate::models::UpdateSitePostRequest,
) -> Result<crate::models::SitePost, sqlx::Error> {
    if let Some(slug) = payload.slug.as_deref() {
        validate_slug(slug)?;
    }

    let mut existing = get_site_post_by_id(pool, id).await?.ok_or(sqlx::Error::RowNotFound)?;

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

/// Deletes a site post by its ID.
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

/// Ensures the schema for site pages and posts exists.
async fn ensure_site_page_schema(pool: &DbPool) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;

    // Base site content table exists from previous migrations; ensure it's present.
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS site_content (
            section TEXT PRIMARY KEY,
            content_json TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(&mut *tx)
    .await?;

    // New dynamic pages table
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

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_site_pages_nav ON site_pages(show_in_nav, order_index)")
        .execute(&mut *tx)
        .await?;

    // Posts table referencing pages
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

    sqlx::query("CREATE UNIQUE INDEX IF NOT EXISTS idx_site_posts_unique_slug ON site_posts(page_id, slug)")
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

/// Applies the core database schema migrations.
async fn apply_core_migrations(tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>) -> Result<(), sqlx::Error> {
    // Create users table
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

    // Track login attempts for server-side cooldowns
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

    // Create tutorials table
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

    // Create indexes for better query performance
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_tutorials_created_at ON tutorials(created_at)")
        .execute(&mut **tx)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_tutorials_updated_at ON tutorials(updated_at)")
        .execute(&mut **tx)
        .await?;

    // Metadata store for one-off setup flags
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

    // Normalized topics table for efficient querying
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

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_tutorial_topics_tutorial ON tutorial_topics(tutorial_id)")
        .execute(&mut **tx)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_tutorial_topics_topic ON tutorial_topics(topic)")
        .execute(&mut **tx)
        .await?;

    // Create comments table
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

    // Recreate FTS5 virtual table for full-text search
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

    // Create triggers to keep FTS index in sync without relying on rowid
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

/// Fetches all site content sections from the database.
pub async fn fetch_all_site_content(pool: &DbPool) -> Result<Vec<crate::models::SiteContent>, sqlx::Error> {
    sqlx::query_as::<_, crate::models::SiteContent>(
        "SELECT section, content_json, updated_at FROM site_content ORDER BY section",
    )
    .fetch_all(pool)
    .await
}

/// Fetches a single site content section by its name.
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

/// Inserts or updates a site content section.
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

/// Seeds the database with default site content if it doesn't already exist.
async fn seed_site_content_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
) -> Result<(), sqlx::Error> {
    for (section, content) in default_site_content() {
        let exists: Option<(String,)> = sqlx::query_as(
            "SELECT section FROM site_content WHERE section = ?",
        )
        .bind(section)
        .fetch_optional(&mut **tx)
        .await?;

        if exists.is_some() {
            continue;
        }

        sqlx::query(
            "INSERT INTO site_content (section, content_json) VALUES (?, ?)",
        )
        .bind(section)
        .bind(content.to_string())
        .execute(&mut **tx)
        .await?;
    }

    Ok(())
}

/// Provides the default site content data.
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
                "description": "Umfassende Lernmodule für alle Erfahrungsstufen - vom Anfänger bis zum Profi",
                "ctaPrimary": {
                    "label": "Tutorial starten",
                    "target": { "type": "section", "value": "home" }
                },
                "ctaSecondary": {
                    "label": "Mehr erfahren",
                    "target": { "type": "section", "value": "home" }
                },
                "ctaDescription": "Wähle ein Thema aus und starte deine Linux-Lernreise noch heute!"
            }),
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

/// Ensures that the directory for a SQLite database file exists.
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

/// Parses the file path from a SQLite database URL.
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

/// Runs all database migrations and seeding operations.
pub async fn run_migrations(pool: &DbPool) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;

    if let Err(err) = apply_core_migrations(&mut tx).await {
        tx.rollback().await?;
        return Err(err);
    }

    tx.commit().await?;

    ensure_site_page_schema(pool).await?;

    // Seed default site content if not already present
    {
        let mut tx = pool.begin().await?;
        seed_site_content_tx(&mut tx).await?;
        tx.commit().await?;
    }

    // Create or update default admin user from environment variables
    let admin_username = env::var("ADMIN_USERNAME").ok();
    let admin_password = env::var("ADMIN_PASSWORD").ok();

    match (admin_username, admin_password) {
        (Some(username), Some(password)) if !username.is_empty() && !password.is_empty() => {
            if password.len() < 12 {
                tracing::error!("ADMIN_PASSWORD must be at least 12 characters long (NIST recommendation)!");
                return Err(sqlx::Error::Protocol("Admin password too weak".into()));
            }
            let existing_user: Option<(i64, String)> = sqlx::query_as(
                "SELECT id, password_hash FROM users WHERE username = ?",
            )
            .bind(&username)
            .fetch_optional(pool)
            .await?;

            match existing_user {
                Some((_, current_hash)) => {
                    match bcrypt::verify(&password, &current_hash) {
                        Ok(true) => {
                            tracing::info!("Admin user '{}' already exists with correct password", username);
                        }
                        Ok(false) => {
                            tracing::warn!("ADMIN_PASSWORD for '{}' differs from stored credentials; keeping existing hash to preserve runtime changes.", username);
                        }
                        Err(e) => {
                            tracing::error!("Password verification failed: {}", e);
                            return Err(sqlx::Error::Protocol("Password verification error".into()));
                        }
                    }
                }
                None => {
                    let password_hash = bcrypt::hash(&password, bcrypt::DEFAULT_COST)
                        .map_err(|e| {
                            tracing::error!("Failed to hash admin password: {}", e);
                            sqlx::Error::Protocol("Failed to hash admin password".into())
                        })?;
                    sqlx::query("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)")
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
            tracing::warn!("ADMIN_USERNAME and ADMIN_PASSWORD not set or empty. No admin user created.");
            tracing::warn!("Set these environment variables to create an admin user on startup.");
        }
    }

    // Insert default tutorials if none exist (using transaction to prevent race condition)
    let seed_enabled = env::var("ENABLE_DEFAULT_TUTORIALS")
        .map(|v| v.trim().eq_ignore_ascii_case("true"))
        .unwrap_or(false);

    let mut tx = pool.begin().await?;

    if seed_enabled {
        let already_seeded: Option<(String,)> = sqlx::query_as(
            "SELECT value FROM app_metadata WHERE key = 'default_tutorials_seeded'",
        )
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
        tracing::info!("ENABLE_DEFAULT_TUTORIALS disabled or not set – skipping default tutorial seeding");
    }

    tx.commit().await?;

    Ok(())
}

/// Inserts the default set of tutorials into the database within a transaction.
async fn insert_default_tutorials_tx(tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>) -> Result<(), sqlx::Error> {
    let tutorials = vec![
        ("1", "Grundlegende Befehle", "Lerne die wichtigsten Linux-Befehle für die tägliche Arbeit im Terminal.", "Terminal", "from-blue-500 to-cyan-500", vec!["ls", "cd", "pwd", "mkdir", "rm", "cp", "mv", "cat", "grep", "find", "chmod", "chown"]),
        ("2", "Dateisystem & Navigation", "Verstehe die Linux-Dateistruktur und navigiere effizient durch Verzeichnisse.", "FolderTree", "from-green-500 to-emerald-500", vec!["Verzeichnisstruktur", "Absolute vs. Relative Pfade", "Symlinks", "Mount Points"]),
        ("3", "Text-Editoren", "Beherrsche vim, nano und andere Editoren für die Arbeit in der Kommandozeile.", "FileText", "from-purple-500 to-pink-500", vec!["vim Basics", "nano Befehle", "sed & awk", "Regex Patterns"]),
        ("4", "Prozessverwaltung", "Verwalte und überwache Prozesse effektiv in deinem Linux-System.", "Settings", "from-orange-500 to-red-500", vec!["ps", "top", "htop", "kill", "pkill", "Background Jobs", "systemctl"]),
        ("5", "Berechtigungen & Sicherheit", "Verstehe Benutzerrechte, Gruppen und Sicherheitskonzepte.", "Shield", "from-indigo-500 to-blue-500", vec!["User & Groups", "chmod & chown", "sudo & su", "SSH & Keys"]),
        ("6", "Netzwerk-Grundlagen", "Konfiguriere Netzwerke und nutze wichtige Netzwerk-Tools.", "Network", "from-teal-500 to-green-500", vec!["ip & ifconfig", "ping", "traceroute", "netstat", "ss", "curl & wget"]),
        ("7", "Bash Scripting", "Automatisiere Aufgaben mit Shell-Scripts und Bash-Programmierung.", "Database", "from-yellow-500 to-orange-500", vec!["Variables & Loops", "If-Statements", "Functions", "Cron Jobs"]),
        ("8", "System Administration", "Erweiterte Admin-Aufgaben und Systemwartung.", "Server", "from-red-500 to-pink-500", vec!["Package Manager", "Logs & Monitoring", "Backup & Recovery", "Performance Tuning"]),
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
            tracing::warn!("Skipping default tutorial '{}' due to invalid icon: {}", id, err);
            continue;
        }

        if let Err(err) = crate::handlers::tutorials::validate_color(color) {
            tracing::warn!("Skipping default tutorial '{}' due to invalid color: {}", id, err);
            continue;
        }

        let topics_json = serde_json::to_string(&topics_vec).map_err(|e| {
            sqlx::Error::Protocol(
                format!("Failed to serialize topics for default tutorial '{}': {}", id, e).into(),
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

/// Replaces the topics for a given tutorial within a transaction.
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

/// Replaces the topics for a given tutorial.
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
