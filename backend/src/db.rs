use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use std::env;

pub type DbPool = SqlitePool;

pub async fn create_pool() -> Result<DbPool, sqlx::Error> {
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;
    
    Ok(pool)
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
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Create or update default admin user from environment variables
    let admin_username = env::var("ADMIN_USERNAME").unwrap_or_else(|_| "admin".to_string());
    let admin_password = env::var("ADMIN_PASSWORD").unwrap_or_else(|_| "admin123".to_string());

    if admin_username.is_empty() {
        tracing::warn!("ADMIN_USERNAME is empty; skipping default admin provisioning");
    } else if admin_password.is_empty() {
        tracing::warn!("ADMIN_PASSWORD is empty; skipping default admin provisioning");
    } else {
        let existing_user: Option<(i64, String)> = sqlx::query_as(
            "SELECT id, password_hash FROM users WHERE username = ?",
        )
        .bind(&admin_username)
        .fetch_optional(pool)
        .await?;

        match existing_user {
            Some((user_id, current_hash)) => {
                let password_matches =
                    bcrypt::verify(&admin_password, &current_hash).unwrap_or(false);
                if !password_matches {
                    let new_hash = bcrypt::hash(&admin_password, bcrypt::DEFAULT_COST)?;
                    sqlx::query("UPDATE users SET password_hash = ? WHERE id = ?")
                        .bind(new_hash)
                        .bind(user_id)
                        .execute(pool)
                        .await?;
                    tracing::info!(
                        "Updated password for existing admin user (username: {})",
                        admin_username
                    );
                }
            }
            None => {
                let password_hash = bcrypt::hash(&admin_password, bcrypt::DEFAULT_COST)?;
                sqlx::query("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)")
                    .bind(&admin_username)
                    .bind(password_hash)
                    .bind("admin")
                    .execute(pool)
                    .await?;

                tracing::info!(
                    "Created default admin user from environment (username: {})",
                    admin_username
                );
            }
        }
    }

    // Insert default tutorials if none exist
    let tutorial_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM tutorials")
        .fetch_one(pool)
        .await?;

    if tutorial_count.0 == 0 {
        insert_default_tutorials(pool).await?;
        tracing::info!("Inserted default tutorials");
    }

    Ok(())
}

async fn insert_default_tutorials(pool: &DbPool) -> Result<(), sqlx::Error> {
    let tutorials = vec![
        ("1", "Grundlegende Befehle", "Lerne die wichtigsten Linux-Befehle für die tägliche Arbeit im Terminal.", "Terminal", "from-blue-500 to-cyan-500", r#"["ls, cd, pwd","mkdir, rm, cp, mv","cat, grep, find","chmod, chown"]"#),
        ("2", "Dateisystem & Navigation", "Verstehe die Linux-Dateistruktur und navigiere effizient durch Verzeichnisse.", "FolderTree", "from-green-500 to-emerald-500", r#"["Verzeichnisstruktur","Absolute vs. Relative Pfade","Symlinks","Mount Points"]"#),
        ("3", "Text-Editoren", "Beherrsche vim, nano und andere Editoren für die Arbeit in der Kommandozeile.", "FileText", "from-purple-500 to-pink-500", r#"["vim Basics","nano Befehle","sed & awk","Regex Patterns"]"#),
        ("4", "Prozessverwaltung", "Verwalte und überwache Prozesse effektiv in deinem Linux-System.", "Settings", "from-orange-500 to-red-500", r#"["ps, top, htop","kill, pkill","Background Jobs","systemctl"]"#),
        ("5", "Berechtigungen & Sicherheit", "Verstehe Benutzerrechte, Gruppen und Sicherheitskonzepte.", "Shield", "from-indigo-500 to-blue-500", r#"["User & Groups","chmod & chown","sudo & su","SSH & Keys"]"#),
        ("6", "Netzwerk-Grundlagen", "Konfiguriere Netzwerke und nutze wichtige Netzwerk-Tools.", "Network", "from-teal-500 to-green-500", r#"["ip & ifconfig","ping, traceroute","netstat, ss","curl & wget"]"#),
        ("7", "Bash Scripting", "Automatisiere Aufgaben mit Shell-Scripts und Bash-Programmierung.", "Database", "from-yellow-500 to-orange-500", r#"["Variables & Loops","If-Statements","Functions","Cron Jobs"]"#),
        ("8", "System Administration", "Erweiterte Admin-Aufgaben und Systemwartung.", "Server", "from-red-500 to-pink-500", r#"["Package Manager","Logs & Monitoring","Backup & Recovery","Performance Tuning"]"#),
    ];

    for (id, title, description, icon, color, topics) in tutorials {
        sqlx::query(
            "INSERT INTO tutorials (id, title, description, icon, color, topics, content) VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(id)
        .bind(title)
        .bind(description)
        .bind(icon)
        .bind(color)
        .bind(topics)
        .bind("")
        .execute(pool)
        .await?;
    }

    Ok(())
}
