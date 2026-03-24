import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
            '/api/nominatim': {
                target: 'https://nominatim.openstreetmap.org',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/nominatim/, ''),
            },
        },
  
  },
})
