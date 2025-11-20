# RustBlogCMS

I built this because I was sick of WordPress. I wanted something that is actually fast and secure.

This is a custom CMS designed for performance. It uses a Rust backend with Axum and SQLx for type-safe reliability, and a React frontend with Tailwind for a clean, responsive UI.

No bloated plugins. No security nightmares. Just raw speed and control.

You get a full admin dashboard to manage tutorials, pages, and posts. It runs on SQLite so deployment is simple and backups are just file copies.

If you care about performance and want a CMS that doesn't get hacked every other week, this is for you.

## Tech Stack
*   **Backend:** Rust, Axum, SQLx
*   **Frontend:** React 18, Vite, TailwindCSS
*   **Database:** SQLite

## Quick Start
1.  Clone the repo.
2.  `cd backend` and `cargo run`.
3.  `npm install` and `npm run dev`.
4.  Go to `localhost:5173`.

Login with the credentials in your `.env` file.
