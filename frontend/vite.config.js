import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  
  server: {
    host: true,
    port: 5173,
    base: '/finalyoproject/',
    proxy: {
      '/api/nominatim': {
        target: 'https://nominatim.openstreetmap.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nominatim/, ''),
      },
    },
  },
  
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split Leaflet into its own chunk
          leaflet: ['leaflet', 'react-leaflet'],
          // Split React core
          vendor: ['react', 'react-dom'],
        }
      }
    }
  }
})