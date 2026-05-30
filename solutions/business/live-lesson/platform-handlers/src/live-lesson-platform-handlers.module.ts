/**
 * `LiveLessonPlatformHandlersModule` — phase 5.5.
 *
 * In-process bundle of live-lesson-specific platform extensions
 * (ontology registrar + workflow handlers + dashboard endpoint).
 * Loaded into the ccaas backend via `PLATFORM_HANDLER_PACKAGES` env
 * var at boot. `@kedge-agentic/backend` has zero compile-time
 * knowledge of this package — `main.ts` dynamically `await import()`s
 * it and passes the module to `AppModule.register({ extraModules })`.
 *
 * This is a SCAFFOLD ONLY at this commit (phase 5.5 step 1). Step 2
 * fills in the ontology registrar; step 3 fills in the workflow
 * handlers + dashboard. The module is exported here from step 1 so
 * `app.module.ts` + `main.ts` can be refactored against a real
 * import target before the handler files land.
 */

import { Module } from '@nestjs/common';

@Module({
  imports: [],
  providers: [],
  controllers: [],
})
export class LiveLessonPlatformHandlersModule {}
