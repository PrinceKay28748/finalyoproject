import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()], 
  
  server: {
    host: '0.0.0.0',  
    port: 5173,
    proxy: {
      '/api/nominatim': {
        target: 'https://nominatim.openstreetmap.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nominatim/, ''),
      },
    },
  },
  
  build: {
    // Use esbuild (default, faster) but with specific settings
    minify: 'esbuild',
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/leaflet')) {
            return 'leaflet';
          }
          if (id.includes('node_modules/react-leaflet')) {
            return 'leaflet';
          }
          if (id.includes('node_modules/react')) {
            return 'vendor';
          }

        }
      }
    },
    // Don't minify identifiers to prevent variable naming conflicts and initialization order issues
    minifyIdentifiers: false,
    // Ensure sourcemaps for debugging (optional)
    sourcemap: false
  },
  
  // Optimize deps to pre-bundle and avoid circular issues
  optimizeDeps: {
    include: [
      'react', 
  'react-dom', 
  'react-router-dom',
      'leaflet', 
      'react-leaflet'
    ],
    exclude: []
  }
})