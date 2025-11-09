import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Vite Configuration for Linux Tutorial CMS Frontend
 *
 * This configuration file sets up the Vite build tool for the React single-page application.
 * It includes development server proxying, production build optimizations, and code splitting
 * strategies to ensure optimal performance and development experience.
 *
 * Key Configuration Areas:
 * - Development server with API proxying to Rust backend
 * - React plugin for JSX transformation and Fast Refresh
 * - Production build optimizations with code splitting
 * - Asset management and chunking strategies
 *
 * Development Features:
 * - Hot Module Replacement (HMR) for rapid development
 * - API proxy to handle CORS during development
 * - Source maps for debugging (disabled in production)
 * - Fast rebuild times with Vite's optimized bundler
 *
 * Production Optimizations:
 * - Manual chunk splitting for better caching strategies
 * - Tree shaking to eliminate unused code
 * - Minification with esbuild for faster builds
 * - Optimized asset bundling and compression
 *
 * @returns {import('vite').UserConfigExport} Vite configuration object
 *
 * @see {@link https://vitejs.dev/config/} for Vite configuration documentation
 * @see {@link https://vitejs.dev/guide/build.html#chunking-strategy} for code splitting strategies
 */
export default defineConfig({
  /**
   * Vite plugins configuration
   *
   * Plugins extend Vite's functionality with additional features and transformations.
   * The React plugin provides support for JSX, Fast Refresh, and React DevTools.
   */
  plugins: [
    /**
     * Official Vite plugin for React applications
     *
     * Features provided:
     * - JSX transformation for .jsx and .tsx files
     * - Fast Refresh for development
     * - React-specific optimizations
     * - Automatic React runtime injection
     *
     * @see {@link https://github.com/vitejs/vite-plugin-react} for plugin documentation
     */
    react()
  ],

  /**
   * Development server configuration
   *
   * Configures the Vite development server for local development with hot module replacement
   * and API proxying to handle cross-origin requests to the Rust backend.
   */
  server: {
    /**
     * Proxy configuration for API requests during development
     *
     * Routes API requests to the Rust backend to avoid CORS issues during development.
     * This allows the frontend and backend to run on different ports while maintaining
     * seamless API communication.
     *
     * Proxy Configuration:
     * - '/api' path: All requests starting with /api are proxied
     * - Target: Rust backend running on localhost:8489
     * - changeOrigin: Rewrites the Host header to match target
     * - secure: Allows self-signed certificates (development only)
     *
     * @example
     * // Request: GET /api/tutorials
     * // Proxied to: GET http://localhost:8489/api/tutorials
     */
    proxy: {
      '/api': {
        target: 'http://localhost:8489',
        changeOrigin: true,
        secure: false,
      },
    },
  },

  /**
   * Production build configuration
   *
   * Optimizes the application for production deployment with code splitting,
   * minification, and asset optimization strategies.
   */
  build: {
    /**
     * Rollup-specific build options
     *
     * Configures advanced bundling options for optimal production builds.
     * Manual chunk splitting improves caching strategies and reduces bundle sizes.
     */
    rollupOptions: {
      output: {
        /**
         * Manual chunk splitting strategy
         *
         * Splits the application into logical chunks for better caching and performance:
         *
         * Chunk Strategy:
         * - vendor: Core React libraries (infrequently changed)
         * - icons: Icon library (separate for better caching)
         * - Remaining: Application-specific code (frequently changed)
         *
         * Benefits:
         * - Better browser caching (vendor chunks rarely change)
         * - Faster initial load (smaller main bundle)
         * - Improved parallel downloads (multiple chunks)
         * - Reduced bundle size per chunk
         *
         * @see {@link https://rollupjs.org/guide/en/#code-splitting} for Rollup code splitting
         */
        manualChunks: {
          /**
           * Vendor chunk containing core React libraries
           *
           * Contains stable dependencies that rarely change:
           * - react: Core React library
           * - react-dom: React DOM renderer
           * - react-router-dom: Client-side routing
           *
           * These libraries are updated infrequently, making them ideal for long-term caching.
           */
          vendor: ['react', 'react-dom', 'react-router-dom'],

          /**
           * Icon library chunk
           *
           * Contains the Lucide React icon library:
           * - lucide-react: Icon components and SVG definitions
           *
           * Separated to allow independent caching and reduce main bundle size.
           * Icons are typically static assets that benefit from long-term caching.
           */
          icons: ['lucide-react'],
        },
      },
    },

    /**
     * Source map generation setting
     *
     * Disabled for production builds to:
     * - Reduce bundle size
     * - Improve build performance
     * - Enhance security (hides implementation details)
     * - Improve download times for users
     *
     * Source maps are enabled during development for debugging purposes.
     *
     * @type {boolean}
     */
    sourcemap: false,

    /**
     * Minification configuration
     *
     * Uses esbuild for minification due to its superior performance compared to terser.
     * esbuild provides fast, reliable minification with good compression ratios.
     *
     * esbuild Benefits:
     * - 10-100x faster than terser
     * - Excellent compression ratios
     * - Built-in tree shaking
     * - Consistent output across platforms
     *
     * @type {'esbuild' | 'terser' | boolean}
     */
    minify: 'esbuild',

    /**
     * Chunk size warning limit
     *
     * Sets the warning threshold for individual bundle chunks. Chunks larger than
     * this size will trigger warnings during the build process.
     *
     * Default: 500KB
     * Current: 1000KB (1MB) - increased for this application's needs
     *
     * Purpose:
     * - Alert developers to potential performance issues
     * - Encourage code splitting for large dependencies
     * - Maintain reasonable download times
     *
     * @type {number} Size in bytes
     */
    chunkSizeWarningLimit: 1000,
  },
})
