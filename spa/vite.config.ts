import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  // For GitHub Pages deployment - use repo name as base
  base: '/reelview-spa/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
