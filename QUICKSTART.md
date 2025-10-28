# 🚀 Schnellstart Guide

## Voraussetzungen

- **Node.js** (v18+) - [Download](https://nodejs.org/)
- **Rust** - [Installation](https://rustup.rs/)

## Start in 3 Schritten

### 1️⃣ Backend starten

```bash
# Terminal 1
cd backend
cargo run
```

✅ Backend läuft auf: **http://localhost:3000**

### 2️⃣ Frontend starten

```bash
# Terminal 2 (neues Terminal öffnen)
npm install
npm run dev
```

✅ Frontend läuft auf: **http://localhost:5173**

### 3️⃣ Admin Login

1. Öffne im Browser: **http://localhost:5173**
2. Klicke auf **"Login"** im Header
3. Anmelden mit:
   - **Benutzername:** `admin`
   - **Passwort:** `admin123`
4. Jetzt kannst du Tutorials erstellen! 🎉

## 📝 Tutorials verwalten

Im Admin Panel kannst du:
- ➕ **Neue Tutorials erstellen** - Klicke auf "Neues Tutorial"
- ✏️ **Tutorials bearbeiten** - Klicke auf "Bearbeiten"
- 🗑️ **Tutorials löschen** - Klicke auf "Löschen"

## ❓ Probleme?

### Backend startet nicht?
- Stelle sicher, dass Rust installiert ist: `rustc --version`
- Port 3000 muss frei sein

### Frontend startet nicht?
- Installiere Dependencies: `npm install`
- Port 5173 muss frei sein

### Login funktioniert nicht?
- Stelle sicher, dass das Backend läuft
- Prüfe in der Browser-Console auf Fehler (F12)

## 🔧 Entwicklung

### API testen
```bash
# Health Check
curl http://localhost:3000/api/health

# Tutorials abrufen
curl http://localhost:3000/api/tutorials
```

### Backend mit Logging
```bash
cd backend
RUST_LOG=debug cargo run
```

---

**Viel Spaß beim Entwickeln! 🦀⚛️**
