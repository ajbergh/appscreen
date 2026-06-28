/**
 * Vite configuration for the React refactor.
 *
 * The relative base keeps production assets portable for static hosting, Docker
 * nginx, and desktop/webview shells that do not serve the app from domain root.
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    port: 5173,
    strictPort: false,
  },
})
