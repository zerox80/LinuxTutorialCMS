import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Configures Vite for the React SPA, including proxy rules for the Rust backend and chunking hints.
 * Keeping this centralized ensures dev server and production build share identical behavior.
 *
 * @returns {import('vite').UserConfigExport} Configuration consumed by Vite CLI.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8489',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          icons: ['lucide-react'],
        },
      },
    },
    sourcemap: false,
    minify: 'esbuild', // esbuild is faster than terser
    chunkSizeWarningLimit: 1000,
  },
})
