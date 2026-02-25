import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5282,
        proxy: {
            // CCAAS sessions API
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
            // CCAAS skills API
            '/api/v1/skills': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
            // Solution backend API
            '/api': {
                target: 'http://localhost:3010',
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
