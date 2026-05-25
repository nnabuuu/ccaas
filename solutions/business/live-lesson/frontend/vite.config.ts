import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import http from 'node:http'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const BACKEND_TARGET = env.BACKEND_URL || 'http://localhost:3007'
  const PREVIEW_TARGET = env.PREVIEW_URL || 'http://localhost:4321'
  const backendUrl = new URL(BACKEND_TARGET)

  return {
    build: {
      target: ['es2020', 'chrome80', 'firefox78'],
    },
    plugins: [
      {
        name: 'fix-linkparas-reexport',
        transform(code, id) {
          if (id.endsWith('components/student/HelpButton.tsx')) {
            return code + `\nexport { linkParas } from './utils/linkParas';\n`
          }
        },
      },
      react(),
    ],
    server: {
      port: 5283,
      host: true,
      proxy: {
        '/preview': {
          target: PREVIEW_TARGET,
          changeOrigin: true,
        },
        '/api': {
          target: BACKEND_TARGET,
          configure: (proxy) => {
            proxy.on('error', (_err, req, res) => {
              if (res.headersSent || res.writableEnded) return
              setTimeout(() => {
                if (res.headersSent || res.writableEnded) return
                const retry = http.request(
                  {
                    hostname: backendUrl.hostname,
                    port: backendUrl.port,
                    path: req.url,
                    method: req.method,
                    headers: req.headers,
                  },
                  (upstream) => {
                    if (res.headersSent || res.writableEnded) return upstream.destroy()
                    res.writeHead(upstream.statusCode!, upstream.headers)
                    upstream.pipe(res)
                  },
                )
                retry.on('error', () => {
                  if (res.headersSent || res.writableEnded) return
                  res.writeHead(503, { 'Content-Type': 'application/json' })
                  res.end(JSON.stringify({ error: 'Backend restarting, please refresh' }))
                })
                if (req.readable) {
                  req.pipe(retry)
                } else {
                  retry.end()
                }
              }, 1500)
            })
          },
        },
      },
    },
  }
})
