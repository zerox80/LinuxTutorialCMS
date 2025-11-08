<div align="center">

# 🐧 Linux Tutorial CMS

### A Modern, Fully Customizable Learning Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Open Source](https://img.shields.io/badge/Open%20Source-%E2%9D%A4-red.svg)](https://github.com)
[![Built with Rust](https://img.shields.io/badge/Built%20with-Rust-orange.svg)](https://www.rust-lang.org/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org/)

**A professional, open-source content management system designed for creating beautiful tutorial websites with zero hassle.**

[Project Purpose](#-project-purpose) • [Features](#-features) • [Quick Start](#-quick-start) • [Customization](#-customization) • [Documentation](#-documentation) • [License](#-license)

</div>

---

## 🎯 Project Purpose

The Linux Tutorial CMS is a modern, open-source platform designed for creating and managing high-quality, interactive tutorial websites. It combines a high-performance Rust backend with a flexible React frontend to provide a seamless experience for both content creators and learners. The primary goal of this project is to offer a fully customizable, easy-to-use solution for educational content that is both beautiful and fast.

## ✨ Features

### 🎨 Beautiful Default Design
- **Ready-to-use landing page** with stunning gradients and modern UI
- **Pre-configured content** - just edit and customize to your needs
- **Responsive design** that looks perfect on all devices
- **Professional animations** and smooth transitions

### 🛠️ Powerful Admin Panel
- **Complete content control** through an intuitive dashboard
- **Tutorial management** - create, edit, and delete tutorials with ease
- **Page & post editor** - build dynamic pages with custom layouts
- **Site content editor** - modify all text, navigation, and CTAs
- **Live preview** - see changes before publishing
- **No coding required** for content editing!

### ⚡ High-Performance Backend
- **Blazing-fast Rust API** with AXUM framework
- **JWT authentication** for secure admin access
- **SQLite database** - simple, reliable, and portable
- **Type-safe** operations with full error handling
- **Async/await** architecture for maximum performance

### 🔒 Security & Authentication
- **Protected admin routes** with JWT tokens
- **Bcrypt password hashing** for secure credentials
- **CORS configured** for production deployment
- **Environment-based configuration** for sensitive data

### 🌈 Fully Customizable
- **Edit everything** - colors, text, layouts, navigation
- **JSON-based content** editing through the admin panel
- **TailwindCSS** for easy styling modifications
- **Icon library** with 1000+ Lucide icons
- **Modular component** architecture

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **Rust** 1.82+ ([Install](https://rustup.rs/))
- **Git** ([Download](https://git-scm.com/))

### Installation

```bash
# Clone the repository
git clone https://github.com/zerox80/LinuxTutorialCMS.git
cd LinuxTutorialCMS

# Install frontend dependencies
npm install
```

### Configuration

To get started, you need to create a `.env` file in the `backend` directory. This file will store the necessary environment variables for the application to run correctly.

**Example `backend/.env` file:**

```env
# The connection string for the SQLite database.
DATABASE_URL=sqlite:./cms.db

# A secret key for signing JWT tokens. You can generate a strong secret using a password manager or a command-line tool.
JWT_SECRET=your-super-secret-key-that-is-at-least-32-characters-long

# The credentials for the default admin account.
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
```

### Running the Application

```bash
# Start the backend (in a separate terminal)
cd backend
cargo run

# Start the frontend
npm run dev
```

### Access the Application

- 🌐 **Frontend:** http://localhost:5173
- 🔧 **Backend API:** http://localhost:8489
- 🔐 **Admin Panel:** http://localhost:5173/login

---

## 🎯 How It Works

### 1️⃣ Default Content

The system comes with **pre-configured default content** that creates a beautiful Linux tutorial website out of the box:

- ✅ Professional hero section
- ✅ Tutorial showcase area
- ✅ Navigation and footer
- ✅ Call-to-action sections
- ✅ Sample tutorial content

**Everything is editable!** The default content serves as a starting point that you can fully customize.

### 2️⃣ Edit Through Admin Panel

Navigate to the **Admin Panel** (`/admin`) after logging in:

#### 📚 Tutorials Tab
Create and manage tutorial content:
- Title, description, and content
- Custom icons and color schemes
- Topic tags
- Markdown support for rich content

#### 🎨 Site Content Tab
Edit all static content sections:
- **Hero Section** - main landing page content
- **Tutorial Section** - showcase area configuration
- **Header** - navigation and branding
- **Footer** - links and copyright
- **Custom Pages** - any additional page content

#### 📄 Pages & Posts Tab
Build dynamic pages:
- Create pages with custom slugs
- Configure hero sections with JSON
- Add multiple posts per page
- Manage navigation visibility
- Publish/unpublish control

### 3️⃣ Content Structure

All editable content is stored as **JSON objects** that you can modify through a visual editor:

```json
{
  "title": "Your Tutorial Title",
  "description": "Your description here",
  "heading": "Ready to get started?",
  "ctaDescription": "Choose a topic and start learning today!",
  "ctaPrimary": {
    "label": "Start tutorial",
    "target": { "type": "section", "value": "tutorials" }
  }
}
```

**No database migrations needed** - just edit the JSON and save! ✨

The content you edit in the admin panel is saved to the SQLite database. When a user visits the website, the React frontend fetches this content from the backend API and dynamically renders the pages. This architecture allows for a fast, modern user experience while still providing a simple and powerful content management system.

---

## 🎨 Customization

### Change Colors

Edit `tailwind.config.js`:

```javascript
colors: {
  primary: {
    50: '#f0f9ff',
    500: '#0ea5e9',  // Main color
    600: '#0284c7',
    700: '#0369a1',
    // ... customize all shades
  },
}
```

### Modify Default Content

All defaults are defined in `src/context/ContentContext.jsx`:

```javascript
export const DEFAULT_CONTENT = {
  hero: {
    badgeText: 'Professional Linux Training',
    title: {
      line1: 'Learn Linux',
      line2: 'from the ground up',
    },
    // ... edit any field
  },
}
```

### Add Custom Icons

Use any icon from [Lucide Icons](https://lucide.dev/):

```javascript
import { Rocket, Star, Heart } from 'lucide-react'
```

---

## 📖 Documentation

### Project Structure

```
LinuxTutorialCMS/
├── 📁 src/
│   ├── 📁 components/      # React UI components
│   │   ├── Header.jsx      # Navigation bar
│   │   ├── Hero.jsx        # Landing section
│   │   ├── TutorialCard.jsx
│   │   ├── SiteContentEditor/
│   │   └── PageManager.jsx
│   ├── 📁 context/         # State management
│   │   ├── AuthContext.jsx
│   │   ├── TutorialContext.jsx
│   │   └── ContentContext.jsx
│   ├── 📁 pages/           # Route pages
│   │   ├── Home.jsx
│   │   ├── Login.jsx
│   │   ├── DynamicPage.jsx
│   │   └── AdminDashboard.jsx
│   ├── 📁 api/            # API client
│   └── 📁 utils/          # Helper functions
├── 📁 backend/
│   ├── 📁 src/
│   │   ├── main.rs        # API server
│   │   ├── db.rs          # Database layer
│   │   ├── auth.rs        # JWT authentication
│   │   └── 📁 handlers/   # API endpoints
│   └── Cargo.toml         # Rust dependencies
├── 📁 public/             # Static assets
└── package.json           # Node dependencies
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/login` | POST | User authentication |
| `/api/tutorials` | GET/POST | Manage tutorials |
| `/api/tutorials/:id` | GET/PUT/DELETE | Single tutorial |
| `/api/site-content` | GET/PUT | Site content sections |
| `/api/pages` | GET/POST | Dynamic pages |
| `/api/navigation` | GET | Navigation items |

### Environment Variables

Create `.env` files for configuration:

**Backend (`backend/.env`):**
```env
DATABASE_URL=sqlite:./cms.db
JWT_SECRET=your-secret-key-here
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
```

**Frontend (`.env`):**
```env
VITE_API_URL=http://localhost:8489
```

---

## 🧪 Testing & Verification

### Smoke Test Checklist

1. ✅ **Backend starts** without errors
2. ✅ **Frontend loads** the landing page
3. ✅ **Login works** with admin credentials
4. ✅ **Create tutorial** via admin panel
5. ✅ **Edit site content** and see changes live
6. ✅ **Create dynamic page** and access it
7. ✅ **Navigation updates** automatically
8. ✅ **Responsive design** works on mobile

### Run Tests

```bash
# Frontend tests (if configured)
npm test

# Backend tests
cd backend
cargo test
```

---

## 🌍 Deployment

### Production Build

```bash
# Build frontend
npm run build

# Build backend (optimized)
cd backend
cargo build --release
```

### Docker Support

```bash
# Start with Docker Compose
docker-compose up -d
```

The application includes:
- ✅ Dockerfile for containerization
- ✅ docker-compose.yml for orchestration
- ✅ Nginx configuration for reverse proxy
- ✅ SSL/TLS support ready

---

## 🤝 Contributing

This is an **open-source project** and contributions are welcome! 

- 🐛 Report bugs via [Issues](../../issues)
- 💡 Suggest features
- 🔧 Submit pull requests
- ⭐ Star the repository if you find it useful!

### Development Guidelines

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

### What does this mean?

✅ **Free to use** for personal and commercial projects  
✅ **Modify** the code as you wish  
✅ **Distribute** and share freely  
✅ **No warranty** - use at your own risk  
✅ **No advertising** or tracking included  

---

## 🌟 Features Roadmap

- [x] Dark mode theme
- [x] Search functionality
- [ ] Multi-language support
- [ ] Markdown editor with live preview
- [ ] Image upload and management
- [ ] SEO optimization tools
- [ ] Analytics dashboard
- [ ] Comment system

---

## 💖 Acknowledgments

Built with love using:

- 🦀 [Rust](https://www.rust-lang.org/) - Performance and reliability
- ⚛️ [React](https://reactjs.org/) - Modern UI framework
- 🎨 [TailwindCSS](https://tailwindcss.com/) - Beautiful styling
- ⚡ [Vite](https://vitejs.dev/) - Lightning-fast builds
- 🔷 [AXUM](https://github.com/tokio-rs/axum) - Robust web framework
- 🎭 [Lucide Icons](https://lucide.dev/) - Gorgeous icon library

---

## 📬 Support

Need help? Have questions?

- 📖 Read the [documentation](#-documentation)
- 🐛 [Open an issue](../../issues)
- 💬 [Discussions](../../discussions)

---

<div align="center">

**Made with ❤️ for the open-source community**

⭐ **Star this repo if you find it useful!** ⭐

</div>
