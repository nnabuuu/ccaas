// Main entry — re-exports everything for NestJS users
export { HarnessModule } from './nestjs/harness.module.js';
export type { HarnessModuleOptions } from './nestjs/harness.module.js';
export { HarnessController } from './nestjs/harness.controller.js';
export { HARNESS_MODULE_OPTIONS, HARNESS_RUN_STORE } from './nestjs/harness.constants.js';

// Core classes
export { TaskRegistry } from './core/task-registry.js';
export { Orchestrator } from './core/orchestrator.js';
export { InMemoryRunStore } from './core/in-memory-run-store.js';
export { assembleContext } from './core/context-assembler.js';
export { extractOutput } from './core/output-extractor.js';
export { shouldExit } from './core/exit-evaluator.js';
export { pollUntilComplete } from './core/async-poller.js';
export { OutputSchemaRegistry } from './core/output-schema-registry.js';

// All types
export * from './core/interfaces.js';

// Client
export { HarnessClient } from './client/harness-client.js';
