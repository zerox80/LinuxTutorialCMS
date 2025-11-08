/**
 * @fileoverview Main entry point for the React application.
 * Initializes the React root and renders the App component with StrictMode enabled.
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import 'highlight.js/styles/github-dark.css'

/**
 * Initialize and render the React application.
 * Creates the root React element and renders the App component within React.StrictMode.
 * StrictMode helps identify potential problems in the application during development.
 */
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
