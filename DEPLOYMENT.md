# 🚀 Deployment Guide - Docker & nginx

Vollständige Anleitung für Production Deployment mit Docker Compose und nginx Reverse Proxy.

## 📋 Voraussetzungen

- **Docker** & **Docker Compose** installiert
- **nginx** auf Host-System installiert
- **Domain** mit DNS auf Server zeigend
- **Certbot** für Let's Encrypt (optional, für HTTPS)

## 🐋 Docker Setup

### 1. Projekt klonen / hochladen

```bash
cd /opt
git clone <your-repo> linux-tutorial
cd linux-tutorial
```

### 2. Environment Variablen setzen

Bearbeite `.env.docker`:
```bash
nano .env.docker
```

Setze ein sicheres JWT Secret:
```env
JWT_SECRET=your-super-secret-random-string-min-32-characters
```

### 3. Docker Compose starten

```bash
# Build und Start
docker-compose up -d --build

# Logs anschauen
docker-compose logs -f

# Status prüfen
docker-compose ps
```

Die App läuft jetzt auf Port **8489** (Docker-intern).

### 4. Verify Container

```bash
# Health check
curl http://localhost:8489/health
curl http://localhost:8489/api/health

# Backend testen
curl http://localhost:8489/api/tutorials
```

## 🌐 nginx Reverse Proxy Setup (Host)

### 1. Config kopieren

```bash
# Config kopieren
sudo cp nginx-configs/host-reverse-proxy.conf /etc/nginx/sites-available/linux-tutorial

# Domain anpassen
sudo nano /etc/nginx/sites-available/linux-tutorial
# Ändere: server_name your-domain.com www.your-domain.com;
```

### 2. Symlink erstellen

```bash
# Symlink für sites-enabled
sudo ln -s /etc/nginx/sites-available/linux-tutorial /etc/nginx/sites-enabled/

# Test nginx config
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

### 3. Testen

```bash
# Local test
curl http://localhost

# Von außen
curl http://your-domain.com
```

## 🔐 Let's Encrypt SSL Setup

### 1. Certbot installieren

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install certbot python3-certbot-nginx
```

### 2. SSL Zertifikat erhalten

```bash
# Automatisch mit nginx Plugin
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Oder manuell
sudo certbot certonly --webroot -w /var/www/letsencrypt \
    -d your-domain.com -d www.your-domain.com
```

### 3. Auto-Renewal testen

```bash
# Dry-run test
sudo certbot renew --dry-run

# Certbot erstellt automatisch einen cron job für renewal
```

Certbot wird automatisch deine nginx Config anpassen und HTTPS aktivieren!

## 📊 Monitoring & Logs

### Docker Logs

```bash
# Alle Services
docker-compose logs -f

# Nur Backend
docker-compose logs -f backend

# Nur nginx
docker-compose logs -f nginx

# Letzten 100 Zeilen
docker-compose logs --tail=100
```

### nginx Logs (Host)

```bash
# Access Log
sudo tail -f /var/log/nginx/linux-tutorial-access.log

# Error Log
sudo tail -f /var/log/nginx/linux-tutorial-error.log
```

### Datenbank

```bash
# In Backend Container
docker-compose exec backend sh

# Datenbank liegt in Volume
ls /data/database.db
```

## 🔄 Updates & Maintenance

### Code Update

```bash
# Neueste Version pullen
git pull

# Rebuild und restart
docker-compose down
docker-compose up -d --build

# Oder rolling update
docker-compose up -d --no-deps --build backend
docker-compose up -d --no-deps --build frontend
```

### Backup Datenbank

```bash
# Volume Backup
docker run --rm \
  -v linux-tutorial_backend-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/database-backup-$(date +%Y%m%d).tar.gz -C /data .

# Restore
docker run --rm \
  -v linux-tutorial_backend-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/database-backup-YYYYMMDD.tar.gz -C /data
```

### Cleanup

```bash
# Container stoppen und entfernen
docker-compose down

# Mit Volumes löschen (ACHTUNG: Daten weg!)
docker-compose down -v

# Alte Images löschen
docker image prune -a
```

## 🔧 Troubleshooting

### Container startet nicht

```bash
# Logs checken
docker-compose logs backend
docker-compose logs frontend

# Container inspect
docker inspect linux-tutorial-backend
```

### Port 8080 bereits belegt

Ändere in `docker-compose.yml`:
```yaml
ports:
  - "8081:80"  # Anderen Port nutzen
```

### nginx 502 Bad Gateway

```bash
# Docker Container laufen?
docker-compose ps

# nginx kann auf Port 8080 zugreifen?
curl http://localhost:8080

# Firewall?
sudo ufw status
sudo ufw allow 8080
```

### SSL Renewal fehlgeschlagen

```bash
# Manuell erneuern
sudo certbot renew --force-renewal

# nginx reload
sudo systemctl reload nginx
```

## 📁 Projektstruktur

```
.
├── backend/
│   ├── Dockerfile              # Backend Docker Image
│   ├── .env.docker            # Backend Env Vars
│   └── src/                   # Rust Source
├── nginx/
│   ├── nginx.conf             # nginx in Docker
│   └── frontend.conf          # Frontend nginx
├── nginx-configs/
│   ├── host-reverse-proxy.conf    # Host nginx (HTTP)
│   └── ssl-reverse-proxy.conf     # Host nginx (HTTPS)
├── Dockerfile                 # Frontend Docker Image
├── docker-compose.yml         # Docker Compose Config
└── .env.docker               # Docker Compose Env Vars
```

## 🔒 Security Checklist

- [ ] JWT_SECRET geändert
- [ ] HTTPS aktiviert (Let's Encrypt)
- [ ] Admin Passwort geändert
- [ ] Firewall konfiguriert (nur 80, 443, 22)
- [ ] nginx Security Headers aktiv
- [ ] Database Backups eingerichtet
- [ ] Log Rotation konfiguriert
- [ ] fail2ban installiert (optional)

## 🚀 Quick Commands

```bash
# Start
docker-compose up -d

# Stop
docker-compose down

# Restart
docker-compose restart

# Rebuild
docker-compose up -d --build

# Logs
docker-compose logs -f

# Status
docker-compose ps

# nginx reload (Host)
sudo systemctl reload nginx
```

---

**Happy Deploying! 🐋**
