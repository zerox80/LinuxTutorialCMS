

/**
 * Application entry point and root render function.
 *
 * This file serves as the main entry point for the Linux Tutorial CMS React application.
 * It handles:
 * - Importing and configuring the root React component
 * - Setting up the global CSS styles and syntax highlighting theme
 * - Creating and mounting the React application to the DOM
 * - Enabling React's StrictMode for development warnings and best practices
 *
 * @fileoverview Main application entry point with React 18+ createRoot API
 * @author Linux Tutorial CMS Team
 * @version 1.0.0
 * @since 2024
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import 'highlight.js/styles/github-dark.css'

/**
 * Creates and mounts the React application to the DOM.
 *
 * Uses React 18's createRoot API for better performance and concurrent features.
 * The application is rendered with StrictMode enabled to:
 * - Detect potential problems in an application during development
 * - Provide additional warnings for unsafe lifecycles, legacy API usage, and more
 * - Help developers write better, more maintainable code
 *
 * @example
 * // The root element is expected to be present in index.html:
 * // <div id="root"></div>
 *
 * @see {@link https://reactjs.org/docs/strict-mode.html} for more information on StrictMode
 * @see {@link https://reactjs.org/docs/react-dom-client.html#createroot} for createRoot API details
 *
 * @returns {void} Renders the application but returns no value
 */
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
