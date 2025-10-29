# Linux Tutorial Website

Eine moderne, responsive Website für Linux-Tutorials mit perfektem Design und Admin CMS.

## 🚀 Features

### Frontend
- **Modernes Design** mit TailwindCSS
- **Responsive Layout** für alle Geräte
- **Komponenten-basiert** mit React
- **Schnelle Performance** durch Vite
- **Professionelle UI** mit Lucide Icons
- **Admin Panel** mit Login-System
- **CMS-Funktionalität** - Tutorials, Seiten & Beiträge erstellen, bearbeiten, löschen
- **Geschützte Routen** mit React Router

### Backend (Rust + AXUM)
- **High-Performance** REST API
- **Type-Safe** mit Rust
- **JWT Authentication**
- **SQLite Datenbank**
- **CRUD Operations** für Tutorials, Seiten & Beiträge
- **Async/Await** mit Tokio

## 📦 Installation

### Backend (Rust)

1. **Rust installieren** (falls nicht vorhanden):
   ```bash
   # Windows: Download von https://rustup.rs/
   # Linux/Mac:
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **Backend starten:**
   ```bash
   cd backend
   cargo run
   ```
   
   Der Server läuft auf: `http://localhost:8489`

### Frontend (React)

1. **Dependencies installieren:**
   ```bash
   npm install
   ```

2. **Development Server starten:**
   ```bash
   npm run dev
   ```
   
   Die Website läuft auf: `http://localhost:5173`

3. **Build für Production:**
   ```bash
   npm run build
   ```

## 🔐 Admin Zugang

Das Admin Panel erreichst du unter `/login` oder über den "Login" Button im Header.

**Standard Login-Daten:**
- **Benutzername:** `admin`
- **Passwort:** `admin123`

> Passe die Zugangsdaten jederzeit über die Environment-Variablen `ADMIN_USERNAME` und `ADMIN_PASSWORD` an. Beim nächsten Start aktualisiert das Backend den Admin-User automatisch.

Im Admin Panel kannst du:
- ✏️ Neue Tutorials erstellen
- 📝 Bestehende Tutorials bearbeiten
- 🗑️ Tutorials löschen
- 👁️ Vorschau aller Tutorials
- 🗂️ Dynamische Seiten mit Hero/Layout JSON konfigurieren
- 📰 Beiträge pro Seite verwalten und veröffentlichen
- 🧭 Navigationseinträge automatisch durch veröffentlichte Seiten aktualisieren

## 🎨 Struktur

```
Linux Tutorial/
├── src/
│   ├── components/
│   │   ├── Header.jsx          # Navigation & Logo
│   │   ├── Hero.jsx            # Hero Sektion
│   │   ├── TutorialSection.jsx # Tutorial Übersicht
│   │   ├── TutorialCard.jsx    # Einzelne Tutorial Karten
│   │   ├── TutorialForm.jsx    # Formular für Tutorials
│   │   ├── ProtectedRoute.jsx  # Route Guard für Admin
│   │   └── Footer.jsx          # Footer mit Links
│   ├── context/
│   │   ├── AuthContext.jsx     # Authentication State
│   │   ├── TutorialContext.jsx # Tutorial Management
│   │   └── ContentContext.jsx  # Statische Inhalte, Navigation & dynamische Seiten
│   ├── pages/
│   │   ├── Home.jsx            # Startseite
│   │   ├── Login.jsx           # Login-Seite
│   │   ├── DynamicPage.jsx     # Dynamische Detailseiten
│   │   └── AdminDashboard.jsx  # Admin Panel
│   ├── components/
│   │   ├── PageManager.jsx     # Admin UI für Seiten & Beiträge
│   │   └── SiteContentEditor/  # Editor für statische Content-Sektionen
│   ├── App.jsx                 # Haupt-App mit Routing (inkl. dynamischer Seiten)
│   ├── main.jsx                # React Entry Point
│   └── index.css               # TailwindCSS Styles
├── index.html
├── package.json
└── README.md
```

## ✏️ Inhalte bearbeiten

### Tutorial-Themen über Admin Panel verwalten

**Einfachste Methode:** Nutze das Admin Panel!

1. Gehe zu `/login` und melde dich an
2. Klicke auf "Neues Tutorial"
3. Fülle das Formular aus:
   - **Titel:** Name des Tutorials
   - **Beschreibung:** Kurze Zusammenfassung
   - **Icon:** Wähle ein passendes Icon
   - **Farbe:** Wähle einen Gradient
   - **Themen:** Liste der behandelten Themen
   - **Inhalt:** Vollständiger Tutorial-Text (Markdown)
4. Klicke auf "Tutorial erstellen"

Alle Änderungen werden automatisch in LocalStorage gespeichert!

### Anmeldedaten ändern

Die Standard-Login-Daten findest du in `src/context/AuthContext.jsx`:

```javascript
const login = (username, password) => {
  if (username === 'admin' && password === 'admin123') {
    // Login erfolgreich
  }
}
```

**Hinweis:** Für Production solltest du ein echtes Backend mit sicherer Authentication verwenden!

### Daten zurücksetzen

Um alle Tutorials auf die Standard-Werte zurückzusetzen:

1. Öffne die Browser DevTools (F12)
2. Gehe zu "Application" → "Local Storage"
3. Lösche den Eintrag `tutorials`
4. Lade die Seite neu

## ✅ Verifikation & Smoke Tests

1. **Backend starten** (`cd backend && cargo run`). Warten bis `Server is ready to accept connections` erscheint.
2. **Frontend starten** (`npm run dev`) und `http://localhost:5173` öffnen.
3. **Login testen**:
   - `/login` aufrufen, mit `admin / admin123` anmelden.
   - Sicherstellen, dass das Admin-Dashboard geladen wird.
4. **Seitenverwaltung**:
   - Tab „Seiten & Beiträge“ öffnen.
   - Neue Seite anlegen (Slug `test-seite`, veröffentlicht & „In Navigation anzeigen“ aktivieren).
   - Beitrag für diese Seite erstellen und veröffentlichen.
   - Navigations-Tab aktualisieren & prüfen, dass `test-seite` dort erscheint.
5. **Frontend-Routing**:
   - In neuem Tab `http://localhost:5173/pages/test-seite` öffnen.
   - Hero-Abschnitt, Beschreibung & veröffentlichter Beitrag sollten angezeigt werden.
6. **Navigation**:
   - Auf der Startseite sicherstellen, dass ein Menüeintrag auf `/pages/test-seite` verweist.
7. **Aufräumen**:
   - Seite & Beitrag im Admin-Dashboard wieder löschen.
   - Navigation aktualisieren und prüfen, dass der Menüeintrag verschwindet.

## 🎨 Design Anpassungen

### Farben ändern

Bearbeite `tailwind.config.js`:

```javascript
colors: {
  primary: {
    500: '#0ea5e9',  // Haupt-Farbe
    600: '#0284c7',
    // ...
  },
}
```

### Komponenten-Styles

Nutze die vordefinierten Klassen in `src/index.css`:
- `.code-block` - Code-Blöcke
- `.tutorial-card` - Tutorial Karten
- `.section-title` - Überschriften
- `.nav-link` - Navigation Links

## 📱 Responsive Design

Die Website ist vollständig responsive:
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

## 🛠️ Technologien

### Frontend
- **React 18** - UI Framework
- **React Router 6** - Routing & Navigation
- **Vite** - Build Tool & Dev Server
- **TailwindCSS** - Styling Framework
- **Lucide React** - Icon Library
- **Context API** - State Management

### Backend
- **Rust** - Programmiersprache
- **AXUM 0.7** - Web Framework
- **Tokio** - Async Runtime
- **SQLx** - SQL Toolkit
- **SQLite** - Datenbank
- **JWT** - Authentication
- **bcrypt** - Password Hashing
- **Tower-HTTP** - CORS & Middleware

## 📄 Lizenz

Frei verwendbar für persönliche und kommerzielle Projekte.

---

**Viel Erfolg mit deinem Linux Tutorial! 🐧**
