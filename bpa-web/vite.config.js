import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Change BACKEND_URL to match your environment:
// XAMPP local:  http://localhost/lccsystem/bpa-backend
// PHP built-in: http://localhost:8000
// Production:   https://api.lcc-bpa.gov.ph
const BACKEND_URL = process.env.VITE_BACKEND_URL || 'http://localhost/lccsystem/bpa-backend'

export default defineConfig({
  base: '/bpa-web/',
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: BACKEND_URL,
        changeOrigin: true,
        rewrite: (path) => path, // keep /api prefix — backend strips it
      },
    },
  },
})
