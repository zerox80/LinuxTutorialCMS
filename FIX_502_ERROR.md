# Fix für 502 Bad Gateway beim Tutorial-Speichern

## Problem
Beim Bearbeiten und Speichern von Tutorials kommt ein 502 Bad Gateway Fehler von nginx.
Die Fehlermeldung zeigt die ganze HTML-Fehlerseite von nginx an.

## Ursachen
1. **Zu kurze nginx Timeouts** - 60 Sekunden waren zu wenig für größere Tutorial-Inhalte
2. **Fehlendes Logging** - Es war schwer zu debuggen, wo genau der Fehler auftritt
3. **Schlechte Fehlermeldungen** - HTML-Fehlerseiten wurden als Text angezeigt

## Durchgeführte Fixes

### 1. Nginx Timeouts erhöht
**Datei:** `nginx/nginx.conf`
- `proxy_connect_timeout`: 60s → 120s
- `proxy_send_timeout`: 60s → 120s  
- `proxy_read_timeout`: 60s → 120s

### 2. Besseres Logging im Backend
**Datei:** `backend/src/handlers/tutorials.rs`
- Logging am Anfang der `update_tutorial` Funktion
- Logging der Datengrößen (title, description, content length)
- Logging bei Validierungsfehlern
- Logging bei erfolgreicher Update-Operation

### 3. Bessere Fehlermeldungen im Frontend
**Dateien:** `src/api/client.js`, `src/components/TutorialForm.jsx`
- HTML-Fehlerseiten (502) werden nicht mehr als langer Text angezeigt
- Spezifische Fehlermeldungen für verschiedene HTTP-Status-Codes:
  - 502: "Der Server antwortet nicht. Bitte versuche es in ein paar Sekunden erneut."
  - 504/408: "Die Anfrage dauert zu lange. Versuche, weniger Inhalt auf einmal zu speichern."
  - 413: "Der Inhalt ist zu groß. Bitte reduziere die Größe des Tutorials."
  - 409: "Das Tutorial wurde von jemand anderem geändert. Bitte lade die Seite neu."

## Deployment

### Für Docker/Linux-Server:

1. **Code auf den Server hochladen:**
   ```bash
   # Lokal: Code commiten und pushen
   git add .
   git commit -m "Fix: 502 Bad Gateway beim Tutorial-Speichern"
   git push
   
   # Auf Server: Code pullen
   cd /pfad/zu/LinuxTutorialCMS
   git pull
   ```

2. **Frontend neu bauen:**
   ```bash
   npm install
   npm run build
   ```

3. **Backend neu bauen:**
   ```bash
   cd backend
   cargo build --release
   ```

4. **Services neu starten:**
   ```bash
   # Nginx neu laden
   sudo nginx -t  # Config testen
   sudo systemctl reload nginx  # Neu laden
   
   # Backend neu starten
   sudo systemctl restart linuxtutorialcms-backend
   ```

5. **Logs prüfen:**
   ```bash
   # Backend Logs
   journalctl -u linuxtutorialcms-backend -f
   
   # Nginx Logs
   tail -f /var/log/nginx/error.log
   ```

## Zusätzliche Debugging-Tipps

### Backend Logs checken
Die neuen Logs zeigen jetzt:
- Wann ein Tutorial-Update gestartet wird
- Die Größe der Daten (title, description, content)
- Validierungsfehler im Detail
- Erfolgreiche Updates

### Wenn der Fehler weiterhin auftritt:

1. **Backend Logs prüfen:**
   ```bash
   docker-compose logs backend | grep "Updating tutorial"
   ```

2. **Content-Größe prüfen:**
   Wenn ein Tutorial > 100,000 Zeichen Content hat, schlägt die Validierung fehl.
   
3. **Datenbank prüfen:**
   ```bash
   docker-compose exec backend sqlite3 /data/database.db
   SELECT id, title, length(content) FROM tutorials;
   ```

4. **Memory/CPU auf dem Server checken:**
   ```bash
   free -h
   top
   ```

## Weitere Optimierungen

Falls weiterhin Probleme auftreten:

1. **Request Body Limit erhöhen** (aktuell 10 MB):
   - In `nginx/nginx.conf`: `client_max_body_size 20M;`
   - In `backend/src/main.rs`: `RequestBodyLimitLayer::new(20 * 1024 * 1024)`

2. **Content Validierung anpassen**:
   - In `backend/src/handlers/tutorials.rs`, Zeile 38: `content.len() > 100_000`
   - Kann erhöht werden, z.B. auf `200_000` für größere Tutorials

3. **SQLite Performance**:
   - WAL-Modus aktivieren für bessere Concurrent-Performance
   - In `backend/src/db.rs` bei `create_pool()`: `.pragma("journal_mode", "WAL")`
