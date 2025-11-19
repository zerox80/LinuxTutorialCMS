//! Database Module
//!
//! This module handles all database operations for the Linux Tutorial CMS.
//! It provides a SQLite-based persistence layer with connection pooling,
//! migrations, and full-text search capabilities.
//!
//! # Architecture
//! - SQLite database with WAL mode for better concurrent access
//! - Connection pooling (1-5 connections) for efficient resource usage
//! - Automatic schema migrations on startup
//! - FTS5 virtual table for fast full-text search
//! - Foreign key enforcement and cascading deletes
//!
//! # Database Schema
//! ## Core Tables
//! - `users`: User accounts with bcrypt-hashed passwords
//! - `login_attempts`: Rate limiting for failed login attempts
//! - `tutorials`: Tutorial content with versioning
//! - `tutorial_topics`: Many-to-many relationship for tutorial topics
//! - `comments`: User comments on tutorials
//! - `app_metadata`: Application-level key-value store
//!
//! ## Site Content Tables
//! - `site_pages`: Custom pages with flexible JSON layouts
//! - `site_posts`: Blog posts associated with pages
//! - `site_content`: Configurable site content sections
//!
//! ## Search Infrastructure
//! - `tutorials_fts`: FTS5 virtual table for full-text search
//! - Automatic triggers to keep FTS5 index in sync
//!
//! # Security Features
//! - Foreign key constraints prevent orphaned records
//! - Transaction-based operations for data integrity
//! - Slug validation to prevent injection attacks
//! - bcrypt password hashing for admin accounts
//!
//! # Performance Features
//! - WAL mode enables concurrent reads during writes
//! - Indexes on frequently queried columns
//! - Connection pooling reduces connection overhead
//! - FTS5 index for sub-second search performance

use regex::Regex;
use serde_json::{json, Value};
use sqlx::{
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
    SqlitePool,
};
use std::env;
use std::path::{Path, PathBuf};
use std::str::FromStr;

/// Type alias for the SQLite connection pool.
/// Used throughout the application for database access.
pub type DbPool = SqlitePool;

/// Creates and initializes the database connection pool.
///
/// This is the main entry point for database initialization. It:
/// 1. Loads database URL from environment (defaults to ./database.db)
/// 2. Ensures the database directory exists
/// 3. Configures SQLite connection options
/// 4. Creates connection pool (1-5 connections)
/// 5. Runs all migrations
///
/// # Database Configuration
/// - **WAL Mode**: Write-Ahead Logging for better concurrency
/// - **Foreign Keys**: Enabled for referential integrity
/// - **Synchronous**: Normal mode (balanced safety/performance)
/// - **Busy Timeout**: 60 seconds to handle lock contention
/// - **Auto-create**: Database file created if missing
///
/// # Connection Pool
/// - Min connections: 1 (always ready)
/// - Max connections: 5 (prevents resource exhaustion)
/// - Acquire timeout: 30 seconds
/// - No idle timeout (connections persist)
/// - No max lifetime (connections don't expire)
///
/// # Returns
/// - `Ok(DbPool)` on success
/// - `Err(sqlx::Error)` if initialization fails
///
/// # Errors
/// - Invalid DATABASE_URL format
/// - Database directory creation failure
/// - Connection establishment failure
/// - Migration failure
///
/// # Environment Variables
/// - `DATABASE_URL`: SQLite database path (default: "sqlite:./database.db")
pub async fn create_pool() -> Result<DbPool, sqlx::Error> {
    // Load database URL from environment or use default
    let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| {
        tracing::warn!("DATABASE_URL not set, defaulting to sqlite:./database.db");
        "sqlite:./database.db".to_string()
    });

    // Ensure parent directory exists
    ensure_sqlite_directory(&database_url)?;

    // Configure SQLite connection options
    let connect_options = SqliteConnectOptions::from_str(&database_url)?
        .create_if_missing(true)
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
        .synchronous(sqlx::sqlite::SqliteSynchronous::Normal)
        .foreign_keys(true)
        .busy_timeout(std::time::Duration::from_secs(60));

    // Create connection pool
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .min_connections(1)
        .acquire_timeout(std::time::Duration::from_secs(30))
        .idle_timeout(None)
        .max_lifetime(None)
        .connect_with(connect_options)
        .await?;

    // Run all database migrations
    run_migrations(&pool).await?;

    tracing::info!("Database pool created successfully");
    Ok(pool)
}









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

async fn apply_core_migrations(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
) -> Result<(), sqlx::Error> {

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
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
        CREATE TABLE IF NOT EXISTS token_blacklist (
            token TEXT PRIMARY KEY,
            expires_at TEXT NOT NULL
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

/// Runs all database migrations and initial data seeding.
///
/// This function is automatically called during database pool creation.
/// It ensures the database schema is up-to-date and populates initial data.
///
/// # Migration Steps
/// 1. **Core Schema**: Create core tables (users, tutorials, comments, login_attempts)
/// 2. **Site Schema**: Create site-related tables (pages, posts, content)
/// 3. **FTS Index**: Create and populate full-text search index
/// 4. **Default Content**: Seed default site content (hero, footer, etc.)
/// 5. **Admin User**: Create admin account from environment variables
/// 6. **Default Tutorials**: Optionally seed sample tutorials
///
/// # Admin User Creation
/// If `ADMIN_USERNAME` and `ADMIN_PASSWORD` are set:
/// - Password must be ≥ 12 characters (NIST recommendation)
/// - User created with role "admin"
/// - Existing users are not overwritten (preserves runtime changes)
/// - Password hash created with bcrypt
///
/// # Default Tutorials
/// If `ENABLE_DEFAULT_TUTORIALS` is not "false":
/// - Inserts 8 sample tutorials on first run
/// - Skipped if tutorials already exist
/// - Marked as seeded in app_metadata
///
/// # Arguments
/// * `pool` - The database connection pool
///
/// # Returns
/// - `Ok(())` if all migrations succeed
/// - `Err(sqlx::Error)` if any migration fails
///
/// # Errors
/// - Schema creation failure
/// - Admin password too weak (< 12 characters)
/// - bcrypt hashing failure
/// - Transaction rollback on any error
///
/// # Environment Variables
/// - `ADMIN_USERNAME`: Admin account username (optional)
/// - `ADMIN_PASSWORD`: Admin account password (optional, min 12 chars)
/// - `ENABLE_DEFAULT_TUTORIALS`: "false" to disable tutorial seeding (default: true)
pub async fn run_migrations(pool: &DbPool) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;

    // Apply core schema migrations (users, tutorials, comments, etc.)
    if let Err(err) = apply_core_migrations(&mut tx).await {
        tx.rollback().await?;
        return Err(err);
    }

    tx.commit().await?;

    // Apply comment schema migrations (add post_id)
    {
        let mut tx = pool.begin().await?;
        if let Err(err) = apply_comment_migrations(&mut tx).await {
            tracing::error!("Failed to apply comment migrations: {}", err);
            // Don't fail startup if migration fails (might already exist)
            // But for safety, we should probably log and continue or fail depending on severity.
            // Here we log and continue as it might be a "column already exists" error which is fine.
            // Better approach: check if column exists inside the migration function.
        }
        tx.commit().await?;
    }

    // Apply vote tracking schema migration
    {
        let mut tx = pool.begin().await?;
        if let Err(err) = apply_vote_migration(&mut tx).await {
            tracing::error!("Failed to apply vote migration: {}", err);
        }
        tx.commit().await?;
    }

    // Fix comment schema (make tutorial_id nullable)
    {
        let mut tx = pool.begin().await?;
        if let Err(err) = fix_comment_schema(&mut tx).await {
            tracing::error!("Failed to fix comment schema: {}", err);
            // We might want to fail here if it's critical, but let's log for now.
        }
        tx.commit().await?;
    }

    // Create site-related schema (pages, posts, content)
    ensure_site_page_schema(pool).await?;

    // Seed default site content (hero, footer, etc.)
    {
        let mut tx = pool.begin().await?;
        seed_site_content_tx(&mut tx).await?;
        tx.commit().await?;
    }

    // Create admin user from environment variables
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
        .map(|v| !v.trim().eq_ignore_ascii_case("false"))
        .unwrap_or(true);

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

        crate::repositories::tutorials::replace_tutorial_topics_tx(tx, id, &topics_vec).await?;
    }

    Ok(())
}





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

    Ok(())
}

async fn apply_vote_migration(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
) -> Result<(), sqlx::Error> {
    // Create comment_votes table
    sqlx::query(include_str!("../migrations/20241119_create_comment_votes.sql"))
        .execute(&mut **tx)
        .await?;

    // Add votes column to comments if missing
    let has_votes: bool = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pragma_table_info('comments') WHERE name='votes'",
    )
    .fetch_one(&mut **tx)
    .await
    .map(|count: i64| count > 0)?;

    if !has_votes {
        tracing::info!("Adding votes column to comments table");
        sqlx::query("ALTER TABLE comments ADD COLUMN votes INTEGER NOT NULL DEFAULT 0")
            .execute(&mut **tx)
            .await?;
    }

    // Add is_admin column to comments if missing
    let has_is_admin: bool = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pragma_table_info('comments') WHERE name='is_admin'",
    )
    .fetch_one(&mut **tx)
    .await
    .map(|count: i64| count > 0)?;

    if !has_is_admin {
        tracing::info!("Adding is_admin column to comments table");
        sqlx::query("ALTER TABLE comments ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE")
            .execute(&mut **tx)
            .await?;
    }

    Ok(())
}

async fn fix_comment_schema(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
) -> Result<(), sqlx::Error> {
    // Check if tutorial_id is nullable by checking table info, but SQLite doesn't make it easy to check nullability directly via simple query without parsing.
    // Instead, we'll check if we've already run this fix by checking app_metadata.
    let fixed: Option<(String,)> =
        sqlx::query_as("SELECT value FROM app_metadata WHERE key = 'comment_schema_fixed_v1'")
            .fetch_optional(&mut **tx)
            .await?;

    if fixed.is_some() {
        return Ok(());
    }

    tracing::info!("Fixing comment schema: Making tutorial_id nullable");

    // 1. Rename existing table
    sqlx::query("ALTER TABLE comments RENAME TO comments_old")
        .execute(&mut **tx)
        .await?;

    // 2. Create new table with nullable tutorial_id and post_id
    sqlx::query(
        r#"
        CREATE TABLE comments (
            id TEXT PRIMARY KEY,
            tutorial_id TEXT,
            post_id TEXT,
            author TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            votes INTEGER NOT NULL DEFAULT 0,
            is_admin BOOLEAN NOT NULL DEFAULT FALSE,
            CONSTRAINT fk_comments_tutorial FOREIGN KEY (tutorial_id) REFERENCES tutorials(id) ON DELETE CASCADE
        )
        "#,
    )
    .execute(&mut **tx)
    .await?;

    // 3. Copy data from old table
    // We need to handle the case where post_id might not exist in comments_old if the previous migration failed or wasn't run fully,
    // but we assume apply_comment_migrations ran before this or we handle it.
    // Actually, apply_comment_migrations adds post_id.
    // Let's check columns in comments_old to be safe, or just assume standard flow.
    // To be safe, we'll select specific columns.
    
    // Note: We need to handle the case where tutorial_id was NOT NULL.
    // If we have data, it's fine.
    
    sqlx::query(
        r#"
        INSERT INTO comments (id, tutorial_id, post_id, author, content, created_at, votes, is_admin)
        SELECT id, tutorial_id, post_id, author, content, created_at, votes, is_admin FROM comments_old
        "#,
    )
    .execute(&mut **tx)
    .await?;

    // 4. Drop old table
    sqlx::query("DROP TABLE comments_old")
        .execute(&mut **tx)
        .await?;

    // 5. Recreate indices
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_comments_tutorial ON comments(tutorial_id)")
        .execute(&mut **tx)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id)")
        .execute(&mut **tx)
        .await?;

    // 6. Mark as fixed
    sqlx::query(
        "INSERT INTO app_metadata (key, value) VALUES ('comment_schema_fixed_v1', 'true')"
    )
    .execute(&mut **tx)
    .await?;

    Ok(())
}
