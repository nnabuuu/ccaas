/**
 * `@kedge-agentic/live-lesson-platform-handlers` — public surface.
 *
 * One named export — `LiveLessonPlatformHandlersModule`. The ccaas
 * backend dynamically imports this package and pulls the module by
 * this name (see `packages/backend/src/main.ts` — the dynamic loader
 * reads `PLATFORM_HANDLER_PACKAGES` env and expects each package's
 * `index.ts` to export a NestJS module class).
 */

export { LiveLessonPlatformHandlersModule } from './live-lesson-platform-handlers.module';
