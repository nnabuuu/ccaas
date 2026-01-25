/**
 * Protocol Module Exports
 *
 * Frontend-Backend integration protocol for Claude-Code-as-a-Service.
 */

// Module
export * from './protocol.module';

// Event types
export * from './events';

// Error handling & recovery
export * from './errors';

// Observability & metrics
export * from './metrics';

// Output schema & transformation
export * from './output-schema';
export * from './output-transformer.service';
export * from './validation.service';
