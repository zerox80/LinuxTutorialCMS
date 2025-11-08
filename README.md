<div align="center">

# Linux Tutorial CMS

### A Modern, Customizable Learning Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Built with Rust](https://img.shields.io/badge/Built%20with-Rust-orange.svg)](https://www.rust-lang.org/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev/)

**An opinionated CMS for building beautiful tutorial sites with a Rust backend and a React frontend.**

</div>

---

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Repository Layout](#repository-layout)
4. [Prerequisites](#prerequisites)
5. [Quick Start](#quick-start)
6. [Environment Variables](#environment-variables)
7. [Daily Development Tasks](#daily-development-tasks)
8. [Testing & Quality](#testing--quality)
9. [Deployment](#deployment)
10. [Troubleshooting](#troubleshooting)
11. [Contributing](#contributing)
12. [License](#license)

---

## Overview
Linux Tutorial CMS pairs a type-safe Rust/AXUM API with a flexible React/Tailwind frontend. It ships with curated default content so that a new site looks polished on day one, while the admin dashboard lets you manage tutorials, pages, posts, and marketing copy without touching code.

Key goals:
- Provide a fast, secure editing experience for instructors.
- Offer a production-ready landing page and tutorial catalog out of the box.
- Keep customization simple through JSON-based site content and modular React components.

## Architecture
| Layer | Technology | Notes |
| --- | --- | --- |
| Frontend | React 18 + Vite + TailwindCSS | SPA with theme, language, and content context providers. |
| Backend | Rust + AXUM + SQLx | Auth, tutorials, dynamic pages, search, comments, CSRF/JWT protection. |
| Database | SQLite | File-based storage, migrations executed automatically on startup. |
| Auth | JWT (HttpOnly cookies) + CSRF tokens | Admin-only routes and brute-force protection. |

## Repository Layout
```
LinuxTutorialCMS/
+- src/                 # React app (components, pages, contexts, utils)
+- backend/             # Rust workspace (API, handlers, migrations, bins)
+- public/              # Static assets served by Vite
+- content/             # Sample markdown/posts
+- nginx / nginx-configs# Optional reverse-proxy config
+- docker-compose.yml   # Local orchestration
+- README.md            # You are here
```

## Prerequisites
- Node.js 18+
- Rust toolchain 1.82+ (`rustup default stable`)
- npm 9+ (bundled with Node)
- SQLite (bundled; no manual install required)
- Git

Optional: Docker Desktop if you want to run the stack with Compose.

## Quick Start
1. **Clone and install dependencies**
   ```bash
   git clone https://github.com/zerox80/LinuxTutorialCMS.git
   cd LinuxTutorialCMS
   npm install
   ```
2. **Configure the backend**
   ```bash
   cd backend
   cp .env.example .env
   # edit .env with secure secrets (see next section)
   cd ..
   ```
3. **Run the backend API**
   ```bash
   cd backend
   cargo run
   ```
4. **Run the frontend** (new terminal)
   ```bash
   npm run dev
   ```
5. **Open the app**
   - Frontend: http://localhost:5173
   - API: http://localhost:8489
   - Admin dashboard: http://localhost:5173/login

> The first admin account is created from `ADMIN_USERNAME` / `ADMIN_PASSWORD` in `backend/.env`. Use those credentials to sign in.

## Environment Variables
All sensitive configuration lives in `backend/.env`. The most important keys are:

| Variable | Description | Example |
| --- | --- | --- |
| `DATABASE_URL` | SQLite connection string. | `sqlite:./cms.db` |
| `JWT_SECRET` | 43+ char random secret for JWT signing. | `openssl rand -base64 48` |
| `CSRF_SECRET` | HMAC secret for CSRF tokens. | `openssl rand -base64 48` |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Bootstrapped admin credentials. | `admin` / `change-me` |
| `LOGIN_ATTEMPT_SALT` | Salt for hashing login identifiers. | `openssl rand -base64 48` |
| `AUTH_COOKIE_SECURE` | Set to `false` only for local HTTP dev. | `false` |

Frontend configuration lives in `./.env` files consumed by Vite (see `.env.example`).

## Daily Development Tasks
- **Manage tutorials:** Use the Admin dashboard -> "Tutorials" tab to create/edit/delete tutorials. Topics, markdown content, and hero icons are all validated server-side.
- **Edit site copy:** The "Site Content" editor exposes hero, header, footer, and Grundlagen page sections as JSON. Every update is validated (structure + size) before persisting.
- **Dynamic pages & posts:** The "Pages & Posts" tab lets you manage landing pages and related blog posts. Slugs are sanitized automatically and navigation updates when you publish pages.
- **Comments:** Moderated through `/api/tutorials/{id}/comments`. Only admins can create/delete via the API; the frontend renders them read-only for visitors.
- **Search:** `/api/search/tutorials` provides FTS queries with optional topic filters. The React search modal consumes this endpoint.
- **Documentation:** Every exported JS function/component and every `pub` Rust item now ships with inline docstrings describing parameters and return values. See source for authoritative API docs.

## Testing & Quality
Run tests from the project root:
```bash
# React unit tests (Vitest + RTL)
npm test

# Lint React code
npm run lint

# Backend unit/integration tests
cd backend
cargo test
```
Smoke-test checklist before opening a PR:
1. Backend starts without panic (`cargo run`).
2. Frontend renders the landing page and tutorials list.
3. Admin login succeeds with the configured credentials.
4. Create + edit + delete a tutorial via the dashboard.
5. Update site content and confirm the hero/header/footer change.
6. Create a dynamic page and verify it at `/pages/:slug`.
7. Search modal returns expected tutorials.
8. Comments load and (as admin) you can add/remove entries.

## Deployment
### Production build (manual)
```bash
npm run build            # bundles the frontend
cd backend
cargo build --release    # optimized API binary
```
Serve `dist/` behind a CDN or static host, and run the Rust binary behind a reverse proxy (see `nginx/`).

### Docker Compose
```bash
docker-compose up --build
```
Services included:
- `frontend`: Vite build served via Nginx.
- `backend`: Rust API running in release mode.
- `nginx`: Optional reverse proxy/SSL termination.

Remember to mount a persistent volume for the SQLite database in production.

## Troubleshooting
| Symptom | Fix |
| --- | --- |
| Backend panics with `JWT_SECRET not initialized` | Ensure `backend/.env` is loaded (use `cargo run --release -- --config dotenv`). |
| 401 responses from admin routes | Cookies must be sent over HTTPS unless `AUTH_COOKIE_SECURE=false` locally. |
| Tutorials missing topics after edit | Topics array cannot be empty; validation enforces at least one entry. |
| Search returns nothing | The FTS virtual table seeds during migrations; delete `cms.db` to re-run migrations if needed. |
| Frontend cannot reach API | Set `VITE_API_BASE_URL` or rely on relative `/api` proxy; see `src/api/client.js`. |

## Contributing
1. Fork the repo and create a feature branch.
2. Run formatter/lints/tests locally.
3. Open a PR describing the change and any manual test steps.
4. For UI changes, attach screenshots or recordings when possible.

Bug reports and feature requests are welcome through [GitHub Issues](../../issues).

## License
This project is released under the [MIT License](LICENSE). You are free to use it for personal or commercial work, but the software is provided "as is" without warranty.
