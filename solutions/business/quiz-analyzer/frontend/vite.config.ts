import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5282,
    // No proxy needed - frontends use environment variables directly:
    // - axios (quiz CRUD) -> VITE_API_BASE (default: http://localhost:3005)
    // - react-sdk (AI chat) -> VITE_CCAAS_BACKEND_URL (default: http://localhost:3001)
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
