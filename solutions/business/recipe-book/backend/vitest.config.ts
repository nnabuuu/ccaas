import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/__tests__/**/*.test.ts'],
    globals: true,
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
});
