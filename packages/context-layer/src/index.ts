// Main entry — re-exports everything for NestJS users
export { ContextLayerModule } from './nestjs/context-layer.module.js';
export type { ContextLayerModuleOptions } from './nestjs/context-layer.module.js';
export { Referenceable, Tracked } from './nestjs/context-layer.decorator.js';
export { ContextLayerController } from './nestjs/context-layer.controller.js';
export { ContextLayerInterceptor } from './nestjs/context-layer.interceptor.js';
export { REFERENCEABLE_KEY, TRACKED_KEY } from './nestjs/context-layer.constants.js';

// Core classes (for direct use)
export { EntityRegistry } from './core/entity-registry.js';
export { ActivityEmitter } from './core/activity-emitter.js';
export { RecommendEngine } from './core/recommend-engine.js';
export { ContextInjector } from './core/context-injector.js';
export { ShortcutManager } from './core/shortcut-manager.js';
export { RelationInferrer } from './core/relation-inferrer.js';

// Ontology converters (Phase 2)
export {
  referenceableOptionsToPicker,
  pickerToReferenceableOptions,
} from './core/referenceable-options-converter.js';

// All types
export * from './core/interfaces.js';

// Client
export { ContextLayerClient } from './client/context-layer-client.js';
