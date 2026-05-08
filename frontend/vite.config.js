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
    // Use terser for more stable minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,
        passes: 2,
        // Prevent variable name collisions
        unsafe: false
      },
      mangle: {
        // Avoid mangling problematic variable names
        reserved: ['v', 'Se', 'Fe', 'Do', 'vc', 'Fc', 'Mu', 'ku', 'Ou', 'gu', 'cd', 'ie']
      },
      format: {
        comments: false
      }
    },
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
          // Separate voice guidance to avoid circular deps
          if (id.includes('useVoiceGuidance')) {
            return 'voice';
          }
        }
      }
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000
  },
  
  // Optimize dependencies to pre-bundle
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'leaflet', 'react-leaflet']
  },
  
  // Resolve configuration to handle circular dependencies
  resolve: {
    dedupe: ['react', 'react-dom']
  }
})