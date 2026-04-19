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
        manualChunks: (id) => {
          // Split Leaflet into its own chunk
          if (id.includes('node_modules/leaflet')) {
            return 'leaflet';
          }
          // Split react-leaflet
          if (id.includes('node_modules/react-leaflet')) {
            return 'leaflet';
          }
          // Split React core
          if (id.includes('node_modules/react')) {
            return 'vendor';
          }
        }
      }
    }
  }
})