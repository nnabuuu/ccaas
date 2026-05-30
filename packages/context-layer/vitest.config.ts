import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

export default defineConfig({
  // SWC preserves design:paramtypes metadata required by NestJS's
  // constructor-based DI. esbuild (the default vitest transformer)
  // does not emit that metadata even with emitDecoratorMetadata in
  // tsconfig, which silently breaks any NestJS DI-driven test.
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        target: 'es2020',
      },
    }),
  ],
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
  },
});
