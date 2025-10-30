# Changelog: Fix für 502 Bad Gateway beim Tutorial-Speichern

## Geänderte Dateien

### Backend

#### `backend/src/handlers/tutorials.rs`
**Änderungen:**
- Hinzugefügt: Logging am Anfang der `update_tutorial` Funktion (Zeile 297)
- Hinzugefügt: Logging für Content-Größen zur Fehleranalyse (Zeile 348-353)
- Hinzugefügt: Detailliertes Logging bei Validierungsfehlern (Zeile 357)
- Hinzugefügt: Success-Logging nach erfolgreichem Update (Zeile 487)
- Hinzugefügt: Kommentare bei den SQL-Binds für bessere Wartbarkeit (Zeile 429-438)

**Zweck:**
Besseres Debugging und Fehleranalyse, um zu sehen, wo genau das Backend abstürzt.

---

### Nginx

#### `nginx/nginx.conf`
**Änderungen:**
- Erhöht: `proxy_connect_timeout` von 60s auf 120s (Zeile 42)
- Erhöht: `proxy_send_timeout` von 60s auf 120s (Zeile 43)
- Erhöht: `proxy_read_timeout` von 60s auf 120s (Zeile 44)

**Zweck:**
Ermöglicht größere Tutorial-Inhalte und längere Verarbeitungszeiten ohne Timeout.

---

### Frontend

#### `src/api/client.js`
**Änderungen:**
- Hinzugefügt: Spezielle Behandlung von HTML-Fehlerseiten (Zeile 179-180)
- Bei HTML-Content und Fehler-Status wird nur "Server-Fehler" statt der ganzen HTML-Seite angezeigt

**Zweck:**
Verhindert, dass die ganze nginx 502-HTML-Seite als Fehlermeldung angezeigt wird.

#### `src/components/TutorialForm.jsx`
**Änderungen:**
- Hinzugefügt: Detailliertes Error-Handling mit spezifischen Fehlermeldungen (Zeile 110-129)
- Fehlermeldungen für verschiedene HTTP-Status-Codes:
  - 502: Server antwortet nicht
  - 504/408: Timeout
  - 413: Inhalt zu groß
  - 409: Konflikt (Concurrent Update)
  - 500+: Serverfehler

**Zweck:**
Benutzerfreundliche Fehlermeldungen statt technischer Details.

---

## Neue Dateien

### `FIX_502_ERROR.md`
Vollständige Dokumentation des Problems, der Ursachen, der Fixes und Deployment-Anweisungen.

### `CHANGELOG_502_FIX.md` (diese Datei)
Übersicht aller Änderungen für die Versionskontrolle.

---

## Testing-Checkliste

Nach dem Deployment auf dem Server:

- [ ] Tutorial mit < 1000 Zeichen Content speichern → sollte funktionieren
- [ ] Tutorial mit ~10.000 Zeichen Content speichern → sollte funktionieren
- [ ] Tutorial mit ~50.000 Zeichen Content speichern → sollte funktionieren
- [ ] Tutorial mit > 100.000 Zeichen Content speichern → sollte Validierungsfehler zeigen
- [ ] Bei 502-Fehler sollte lesbare Fehlermeldung erscheinen (nicht HTML)
- [ ] Backend-Logs sollten detaillierte Info über Tutorial-Updates zeigen
- [ ] Gleichzeitiges Bearbeiten sollte Konflikt-Meldung (409) zeigen

---

## Rollback-Plan

Falls die Änderungen Probleme verursachen:

```bash
# Auf dem Server
cd /pfad/zu/LinuxTutorialCMS
git log --oneline  # Zeige letzte Commits
git revert HEAD    # Mache letzten Commit rückgängig

# Services neu starten
npm run build
cd backend && cargo build --release
sudo systemctl restart linuxtutorialcms-backend
sudo systemctl reload nginx
```

---

## Bekannte Einschränkungen

- Max. Content-Größe: 100.000 Zeichen (kann in `backend/src/handlers/tutorials.rs` Zeile 38 erhöht werden)
- Request Body Limit: 10 MB (kann in `nginx/nginx.conf` und `backend/src/main.rs` erhöht werden)
- Timeout nach 120 Sekunden (kann in `nginx/nginx.conf` weiter erhöht werden)

---

## Version
Fix v1.0 - 30. Oktober 2025
