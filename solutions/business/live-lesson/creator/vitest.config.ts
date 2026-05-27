import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * Vitest config — runs in jsdom by default so component tests
 * (`*.spec.tsx`) can mount + interact with React. Pure-helper specs
 * (`*.spec.ts`) work fine in jsdom too; they don't touch `window`
 * but the environment is a no-op cost for them.
 *
 * Setup file registers `@testing-library/jest-dom` matchers
 * (`toBeInTheDocument`, `toHaveClass`, ...).
 *
 * `react()` plugin is required so JSX in component test files
 * compiles correctly.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
