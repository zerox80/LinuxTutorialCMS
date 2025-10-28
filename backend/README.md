# Linux Tutorial Backend (Rust + AXUM)

High-performance REST API backend für die Linux Tutorial Website.

## 🦀 Tech Stack

- **Rust** - Programmiersprache
- **AXUM** - Web Framework
- **SQLite** - Datenbank
- **SQLx** - Database Driver
- **JWT** - Authentication
- **bcrypt** - Password Hashing

## 📦 Installation

### Voraussetzungen

- Rust (latest stable) - [Installation](https://rustup.rs/)
- SQLite3

### Setup

1. **In das Backend-Verzeichnis wechseln:**
   ```bash
   cd backend
   ```

2. **Environment-Variablen konfigurieren:**
   
   Die `.env` Datei ist bereits erstellt. Du kannst die Werte anpassen:
   ```env
   DATABASE_URL=sqlite:./database.db
   JWT_SECRET=your-secret-key-change-this-in-production
   RUST_LOG=debug
   PORT=8489
   ```

3. **Dependencies installieren und Server starten:**
   ```bash
   cargo run
   ```

   Beim ersten Start:
   - Wird die SQLite-Datenbank erstellt
   - Werden die Tabellen angelegt
   - Wird ein Admin-User angelegt
   - Werden Standard-Tutorials eingefügt

## 🚀 API Endpoints

### Authentication

#### Login
```
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}

Response:
{
  "token": "jwt-token...",
  "user": {
    "username": "admin",
    "role": "admin"
  }
}
```

#### Get Current User
```
GET /api/auth/me
Authorization: Bearer {token}

Response:
{
  "username": "admin",
  "role": "admin"
}
```

### Tutorials

#### List All Tutorials
```
GET /api/tutorials

Response:
[
  {
    "id": "uuid",
    "title": "Tutorial Title",
    "description": "Description",
    "icon": "Terminal",
    "color": "from-blue-500 to-cyan-500",
    "topics": ["topic1", "topic2"],
    "content": "Full content...",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
]
```

#### Get Single Tutorial
```
GET /api/tutorials/:id

Response: Tutorial object
```

#### Create Tutorial (Admin only)
```
POST /api/tutorials
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "New Tutorial",
  "description": "Description",
  "icon": "Terminal",
  "color": "from-blue-500 to-cyan-500",
  "topics": ["topic1", "topic2"],
  "content": "Content here..."
}

Response: Created tutorial object
```

#### Update Tutorial (Admin only)
```
PUT /api/tutorials/:id
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "Updated Title",
  "description": "Updated Description"
  // ... andere Felder sind optional
}

Response: Updated tutorial object
```

#### Delete Tutorial (Admin only)
```
DELETE /api/tutorials/:id
Authorization: Bearer {token}

Response: 204 No Content
```

### Health Check
```
GET /api/health

Response: "OK"
```

## 🔐 Standard-Login

Nach dem ersten Start wird automatisch ein Admin-User angelegt:

- **Benutzername:** `admin`
- **Passwort:** `admin123`

**⚠️ WICHTIG:** Ändere das Passwort für Production!

## 🗄️ Datenbank

Die SQLite-Datenbank wird automatisch erstellt unter `backend/database.db`.

### Tabellen

**users**
- id (INTEGER PRIMARY KEY)
- username (TEXT UNIQUE)
- password_hash (TEXT)
- role (TEXT)
- created_at (TEXT)

**tutorials**
- id (TEXT PRIMARY KEY)
- title (TEXT)
- description (TEXT)
- icon (TEXT)
- color (TEXT)
- topics (TEXT) - JSON Array
- content (TEXT)
- created_at (TEXT)
- updated_at (TEXT)

## 🔧 Development

### Build
```bash
cargo build
```

### Run mit Logging
```bash
RUST_LOG=debug cargo run
```

### Production Build
```bash
cargo build --release
./target/release/linux-tutorial-backend
```

## 🌐 CORS

CORS ist für alle Origins aktiviert (Development). Für Production solltest du dies einschränken in `src/main.rs`:

```rust
let cors = CorsLayer::new()
    .allow_origin("http://localhost:5173".parse::<HeaderValue>().unwrap())
    .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
    .allow_headers(Any);
```

## 📝 Logging

Das Backend nutzt `tracing` für Logging. Level kann über `RUST_LOG` gesetzt werden:

```bash
RUST_LOG=info cargo run     # Info level
RUST_LOG=debug cargo run    # Debug level
RUST_LOG=trace cargo run    # Trace level
```

## 🔒 Sicherheit

- Passwörter werden mit bcrypt gehasht
- JWT-Tokens für Authentication
- Protected Routes prüfen Token-Gültigkeit
- Admin-only Endpoints prüfen Rolle

**Für Production:**
1. Ändere `JWT_SECRET` in `.env`
2. Nutze eine sichere Datenbank (PostgreSQL)
3. Aktiviere HTTPS
4. Beschränke CORS auf deine Domain
5. Implementiere Rate Limiting
6. Nutze stärkere Passwörter

## 📊 Performance

- Async/Await mit Tokio
- Connection Pooling mit SQLx
- Kompiliert zu nativem Code
- Minimal Memory Footprint
- Sehr schnelle Response Times

---

**Happy Coding! 🦀**
