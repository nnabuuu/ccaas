/**
 * Type Definitions
 *
 * Barrel export for all type definitions.
 */

// Connection types
export * from './connection'

// Agent state types
export * from './agent-state'

// Form bridge types
export * from './form-bridge'

// Plan proposal types
export * from './plan-proposal'

// Socket event types
export * from './events'

// Entity bridge types (UseEntityBridgeReturn exported from composables)
export type {
  SectionStatus,
  SectionState,
  EntityOutputUpdateEvent,
  EntityBridgeConfig,
} from './entity-bridge'

// Output sync, skills, and API client types
export * from './output-sync'

// Chat types (content blocks, messages, splitting, colors)
export * from './chat'

// File management types
export * from './files'

// Task tracking types
export * from './tasks'

// Layout types
export * from './layout'
