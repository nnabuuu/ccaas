import { defineConfig, devices } from '@playwright/test'
import * as path from 'node:path'

const PORT = 43451

export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  globalTimeout: 180_000,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 5_000,
  },
  /**
   * Auto-boot the preview server with the bundled quiz-demo for the test
   * run. We use the compiled CLI from `dist/cli/index.js` so the test
   * doesn't depend on tsx/ts-node being installed.
   */
  webServer: {
    command: `node ${path.resolve(__dirname, '..', 'dist', 'cli', 'index.js')} --port ${PORT} ${path.resolve(__dirname, '..', 'bundles', 'quiz-demo')}`,
    url: `http://127.0.0.1:${PORT}/preview/health`,
    timeout: 30_000,
    reuseExistingServer: false,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
