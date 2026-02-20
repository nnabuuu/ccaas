import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5281,
    proxy: {
      // CCAAS sessions API (must be before /api to take precedence)
      '/api/v1/sessions': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // CCAAS files API (upload)
      '/api/v1/files': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // CCAAS health API
      '/api/v1/health': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Solution backend API (problems, explanations, knowledge-points)
      '/api': {
        target: 'http://localhost:3003',
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
