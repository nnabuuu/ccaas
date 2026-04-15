import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const pkgs = path.resolve(__dirname, '../../../../packages')

export default defineConfig({
  plugins: [react()],
  server: {
    port: parseInt(process.env.VITE_PORT || '5291'),
    host: true,
  },
  resolve: {
    alias: {
      '@kedge-agentic/context-layer/client': path.join(pkgs, 'context-layer/src/client/index.ts'),
      '@kedge-agentic/context-layer/core': path.join(pkgs, 'context-layer/src/core/index.ts'),
      '@kedge-agentic/context-layer-react': path.join(pkgs, 'context-layer-react/src/index.ts'),
    },
  },
})
