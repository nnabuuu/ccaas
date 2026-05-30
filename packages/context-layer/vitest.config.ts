import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

// SWC preserves `design:paramtypes` metadata required by NestJS's
// constructor-based DI. esbuild (vitest's default transformer) does
// NOT emit that metadata even with `emitDecoratorMetadata: true` in
// tsconfig, which silently breaks any NestJS DI-driven test.
//
// Applies to ALL test files under `src/**/__tests__/**/*.test.ts`,
// not just the NestJS integration suite. Cross-checked at commit
// `8902ba80`: the 4 pre-existing suites (entity-registry parity +
// schema-accessor + converter + adapter) all pass under SWC just as
// they did under esbuild. `target: 'es2020'` mirrors tsconfig.json.
export default defineConfig({
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
