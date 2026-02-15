import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['__tests__/**/*.test.ts'],
    // Increase pool timeout and add memory settings for CI
    poolOptions: {
      threads: {
        maxThreads: 2,
        minThreads: 1,
      },
    },
    testTimeout: 10000,
  },
})
