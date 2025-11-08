//! This module contains all the Axum handlers for the application.
//!
//! Handlers are responsible for processing incoming HTTP requests and returning responses.
//! They are organized into sub-modules based on their functionality.

/// Handlers for authentication-related routes.
pub mod auth;

/// Handlers for managing tutorials.
pub mod tutorials;

/// Handlers for managing site-wide content.
pub mod site_content;

/// Handlers for managing dynamic site pages.
pub mod site_pages;

/// Handlers for managing blog posts associated with site pages.
pub mod site_posts;

/// Handlers for search functionality.
pub mod search;

/// Handlers for managing comments.
pub mod comments;
