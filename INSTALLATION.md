# 📦 Installation & Setup Guide

Umfassende Installationsanleitung für das Linux Tutorial CMS.

## 📋 Voraussetzungen

### Erforderlich:
- **Node.js** 18+ ([Download](https://nodejs.org/))
- **Rust** 1.82+ ([Install](https://rustup.rs/))
- **Git** ([Download](https://git-scm.com/))

### Optional (für Docker):
- **Docker** 20+ ([Download](https://www.docker.com/))
- **Docker Compose** 2+

---

## 🚀 Schnellstart (Entwicklung)

### 1. Repository klonen
```bash
git clone https://github.com/zerox80/LinuxTutorialCMS.git
cd LinuxTutorialCMS
```

### 2. Frontend Setup
```bash
# Dependencies installieren
npm install

# Environment Variables (optional)
cp .env.example .env

# Development Server starten
npm run dev
```

Frontend läuft auf: **http://localhost:5173**

### 3. Backend Setup (separates Terminal)
```bash
cd backend

# Environment Variables setzen
cp .env.example .env

# WICHTIG: Admin-Account konfigurieren
# Editiere .env und setze:
# ADMIN_USERNAME=deinadmin
# ADMIN_PASSWORD=einSicheresPasswort123!

# Backend starten
cargo run
```

Backend läuft auf: **http://localhost:8489**

### 4. Zugriff
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8489
- **Admin Panel:** http://localhost:5173/login

---

## 🐳 Docker Setup (Empfohlen für Production)

### 1. Environment Variables
```bash
# Erstelle .env Datei im Root
cp .env.docker.example .env.docker

# Editiere .env.docker:
ADMIN_USERNAME=admin
ADMIN_PASSWORD=SehrSicheresPasswort123!
JWT_SECRET=dein-geheimer-jwt-schlüssel-mindestens-32-zeichen
FRONTEND_ORIGINS=https://deine-domain.com
```

### 2. Docker Compose starten
```bash
# Linux/Mac
./start-docker.sh

# Windows
start-docker.bat

# Oder manuell:
docker-compose up -d
```

### 3. Logs prüfen
```bash
docker-compose logs -f
```

### 4. Stoppen
```bash
docker-compose down
```

---

## ⚙️ Environment Variables

### Backend (.env)
```env
# Database
DATABASE_URL=sqlite:./cms.db

# Auth
JWT_SECRET=your-secret-key-min-32-chars
ADMIN_USERNAME=admin
ADMIN_PASSWORD=SecurePassword123!

# Server
PORT=8489

# CORS (Komma-getrennt)
FRONTEND_ORIGINS=http://localhost:5173,http://localhost:3000
```

### Frontend (.env)
```env
# API URL
VITE_API_URL=http://localhost:8489
```

---

## 📦 Dependencies installieren

### Frontend
```bash
npm install
```

Installiert:
- React 19
- React Router 7
- TailwindCSS 4
- Vite 7
- i18next (Mehrsprachigkeit)
- DOMPurify (Sicherheit)
- React Helmet (SEO)
- Lucide Icons
- Testing Libraries (Vitest, Playwright)

### Backend
```bash
cd backend
cargo build
```

Installiert automatisch:
- Axum (Web Framework)
- SQLx (Database)
- JWT (Auth)
- Bcrypt (Passwords)
- Tower (Middleware)
- Tracing (Logging)

---

## 🧪 Testing Setup

### Unit Tests
```bash
# Tests ausführen
npm test

# Mit Coverage
npm run test:coverage

# Mit UI
npm run test:ui
```

### E2E Tests
```bash
# Playwright installieren
npx playwright install

# Tests ausführen
npm run test:e2e

# Mit UI
npm run test:e2e:ui
```

### Backend Tests
```bash
cd backend
cargo test
```

---

## 🔧 Entwicklungstools

### ESLint (Frontend)
```bash
npm run lint
```

### Rustfmt & Clippy (Backend)
```bash
cd backend
cargo fmt
cargo clippy
```

---

## 🗄️ Datenbank Setup

Die Datenbank wird automatisch beim ersten Start erstellt.

### Manuelles Setup
```bash
cd backend

# Migrations ausführen
cargo run

# Datenbank wird erstellt: cms.db
```

### Datenbank zurücksetzen
```bash
cd backend
rm cms.db
cargo run  # Erstellt neue DB mit Migrations
```

### Content Export/Import
```bash
# Content exportieren
npm run export-content

# Content importieren
npm run import-content
```

---

## 🌐 Production Deployment

### Build erstellen

#### Frontend
```bash
npm run build
# Output: ./dist/
```

#### Backend
```bash
cd backend
cargo build --release
# Output: ./target/release/linux-tutorial-backend
```

### Nginx Konfiguration

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        root /var/www/linux-tutorial/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8489;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### SSL mit Let's Encrypt
```bash
sudo certbot --nginx -d your-domain.com
```

### Systemd Service (Backend)
```ini
[Unit]
Description=Linux Tutorial Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/linux-tutorial/backend
Environment="DATABASE_URL=sqlite:./cms.db"
Environment="JWT_SECRET=your-secret"
Environment="ADMIN_USERNAME=admin"
Environment="ADMIN_PASSWORD=your-password"
ExecStart=/var/www/linux-tutorial/backend/linux-tutorial-backend
Restart=always

[Install]
WantedBy=multi-user.target
```

Aktivieren:
```bash
sudo systemctl enable linux-tutorial-backend
sudo systemctl start linux-tutorial-backend
sudo systemctl status linux-tutorial-backend
```

---

## 🔒 Sicherheit

### Wichtige Schritte:
1. ✅ Starke Passwörter verwenden (min. 12 Zeichen)
2. ✅ JWT_SECRET mit mindestens 32 Zeichen
3. ✅ HTTPS in Production (Let's Encrypt)
4. ✅ Firewall konfigurieren
5. ✅ Regelmäßige Updates
6. ✅ Database Backups
7. ✅ CORS nur für eigene Domain

### Rate Limiting
Default Einstellungen:
- Login: 5 requests/5 seconds
- Admin Writes: 3 requests/1 second
- Anpassbar in `main.rs`

---

## 🐛 Troubleshooting

### Port bereits in Verwendung
```bash
# Port 5173 (Frontend)
lsof -i :5173
kill -9 <PID>

# Port 8489 (Backend)
lsof -i :8489
kill -9 <PID>
```

### Cargo Build Fehler
```bash
# Rust updaten
rustup update

# Cache löschen
cargo clean
cargo build
```

### Node Modules Probleme
```bash
# Cache löschen
rm -rf node_modules package-lock.json
npm install
```

### Database Locked
```bash
# Alle Prozesse stoppen
pkill -f linux-tutorial-backend

# Neustart
cargo run
```

---

## 📊 Performance Optimierung

### Frontend
```bash
# Build analysieren
npm run build
npx vite-bundle-visualizer
```

### Backend
```bash
# Release Build (optimiert)
cargo build --release

# Profiling
cargo flamegraph
```

---

## 🔄 Updates

### Dependencies aktualisieren

#### Frontend
```bash
npm update
npm audit fix
```

#### Backend
```bash
cargo update
cargo audit
```

### Git Pull
```bash
git pull origin main
npm install
cd backend && cargo build
```

---

## 📱 PWA Installation

Nach Deployment kann die App installiert werden:
1. Besuche die Website im Browser
2. "Zu Startbildschirm hinzufügen" klicken
3. App öffnet sich wie native App

---

## 💾 Backup & Restore

### Database Backup
```bash
# Backup erstellen
cp backend/cms.db backend/cms_backup_$(date +%Y%m%d).db

# Automatisches Backup (Cron)
0 2 * * * cp /path/to/cms.db /backup/cms_$(date +\%Y\%m\%d).db
```

### Content Export
```bash
npm run export-content
# Datei: content/site_content.json
```

---

## 📞 Support

Bei Problemen:
1. Logs prüfen
2. GitHub Issues durchsuchen
3. Neue Issue erstellen
4. [Discussions](../../discussions)

---

## ✅ Post-Installation Checklist

- [ ] Admin-Account funktioniert
- [ ] Frontend erreichbar
- [ ] Backend API antwortet (/api/health)
- [ ] Dark Mode funktioniert
- [ ] Suche funktioniert
- [ ] Tutorial erstellen/bearbeiten
- [ ] PWA installierbar
- [ ] i18n DE/EN wechseln
- [ ] Tests laufen durch
- [ ] Production Build erfolgreich

---

**Viel Erfolg! 🚀**
