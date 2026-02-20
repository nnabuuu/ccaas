import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5282,
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
      // Solution backend API
      '/api': {
        target: 'http://localhost:3005',
        changeOrigin: true,
      },
      // CCAAS WebSocket
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
});
