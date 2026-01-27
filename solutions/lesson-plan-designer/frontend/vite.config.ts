import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5280,
    proxy: {
      // CCAAS sessions API (must be before /api to take precedence)
      '/api/v1/sessions': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // CCAAS health API
      '/api/v1/health': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // CCAAS skills API (skills are managed by CCAAS, not solution backend)
      '/api/v1/skills': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Solution backend API (lesson plans CRUD, session messages proxy)
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
      // CCAAS WebSocket (direct connection)
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
})
