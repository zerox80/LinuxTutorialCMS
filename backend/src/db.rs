use sqlx::{
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
    SqlitePool,
};
use std::env;
use std::path::{Path, PathBuf};
use std::str::FromStr;

pub type DbPool = SqlitePool;

pub async fn create_pool() -> Result<DbPool, sqlx::Error> {
    let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| {
        tracing::warn!("DATABASE_URL not set, defaulting to sqlite:./database.db");
        "sqlite:./database.db".to_string()
    });
    
    ensure_sqlite_directory(&database_url)?;

    let connect_options = SqliteConnectOptions::from_str(&database_url)?
        .create_if_missing(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .acquire_timeout(std::time::Duration::from_secs(10))
        .max_lifetime(std::time::Duration::from_secs(3600))
        .idle_timeout(std::time::Duration::from_secs(600))
        .connect_with(connect_options)
        .await?;
    
    tracing::info!("Database pool created successfully");
    Ok(pool)
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

pub async fn run_migrations(pool: &DbPool) -> Result<(), sqlx::Error> {
    // Create users table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'admin',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
        "#,
    )
    .execute(pool)
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
    .execute(pool)
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
    .execute(pool)
    .await?;
    
    // Create indexes for better query performance
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_tutorials_created_at ON tutorials(created_at)")
        .execute(pool)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_tutorials_updated_at ON tutorials(updated_at)")
        .execute(pool)
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
    .execute(pool)
    .await?;

    // Normalized topics table for efficient querying
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS tutorial_topics (
            tutorial_id TEXT NOT NULL,
            topic TEXT NOT NULL,
            FOREIGN KEY (tutorial_id) REFERENCES tutorials(id) ON DELETE CASCADE ON UPDATE CASCADE
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_tutorial_topics_tutorial ON tutorial_topics(tutorial_id)")
        .execute(pool)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_tutorial_topics_topic ON tutorial_topics(topic)")
        .execute(pool)
        .await?;

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
        .unwrap_or(true);

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
            sqlx::query(
                "INSERT INTO app_metadata (key, value) VALUES ('default_tutorials_seeded', ?) \
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            )
            .bind(chrono::Utc::now().to_rfc3339())
            .execute(&mut *tx)
            .await?;
            tracing::info!("Inserted default tutorials");
        }
    } else {
        tracing::info!("ENABLE_DEFAULT_TUTORIALS disabled – skipping default tutorial seeding");
    }

    tx.commit().await?;

    Ok(())
}

async fn insert_default_tutorials_tx(tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>) -> Result<(), sqlx::Error> {
    let tutorials = vec![
        ("1", "Grundlegende Befehle", "Lerne die wichtigsten Linux-Befehle für die tägliche Arbeit im Terminal.", "Terminal", "from-blue-500 to-cyan-500", vec!["ls, cd, pwd", "mkdir, rm, cp, mv", "cat, grep, find", "chmod, chown"]),
        ("2", "Dateisystem & Navigation", "Verstehe die Linux-Dateistruktur und navigiere effizient durch Verzeichnisse.", "FolderTree", "from-green-500 to-emerald-500", vec!["Verzeichnisstruktur", "Absolute vs. Relative Pfade", "Symlinks", "Mount Points"]),
        ("3", "Text-Editoren", "Beherrsche vim, nano und andere Editoren für die Arbeit in der Kommandozeile.", "FileText", "from-purple-500 to-pink-500", vec!["vim Basics", "nano Befehle", "sed & awk", "Regex Patterns"]),
        ("4", "Prozessverwaltung", "Verwalte und überwache Prozesse effektiv in deinem Linux-System.", "Settings", "from-orange-500 to-red-500", vec!["ps, top, htop", "kill, pkill", "Background Jobs", "systemctl"]),
        ("5", "Berechtigungen & Sicherheit", "Verstehe Benutzerrechte, Gruppen und Sicherheitskonzepte.", "Shield", "from-indigo-500 to-blue-500", vec!["User & Groups", "chmod & chown", "sudo & su", "SSH & Keys"]),
        ("6", "Netzwerk-Grundlagen", "Konfiguriere Netzwerke und nutze wichtige Netzwerk-Tools.", "Network", "from-teal-500 to-green-500", vec!["ip & ifconfig", "ping, traceroute", "netstat, ss", "curl & wget"]),
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

async fn replace_tutorial_topics_tx(
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
