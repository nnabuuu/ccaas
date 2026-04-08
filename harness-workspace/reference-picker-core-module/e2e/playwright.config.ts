import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 30000,
  expect: { timeout: 5000 },
  retries: 1,
  use: {
    baseURL: 'http://localhost:3021',
    headless: true,
  },
  webServer: {
    command: 'cd ../../../solutions/mock/context-layer-demo && npx nest build && node --preserve-symlinks dist/main.js',
    port: 3021,
    timeout: 60000,
    reuseExistingServer: true,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
