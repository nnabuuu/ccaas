/**
 * @kedge-agentic/agent-runtime — public API surface.
 *
 * Phase 0 (shipped):
 *   - workspace/  — BaseMaterializer + ContentSource + Logger (was the
 *                   entirety of @kedge-agentic/agentfs-runtime pre-rename)
 *   - artifact/   — types + JsonEditProvider (one concrete editor)
 *   - project/    — interface skeleton (impls in Phase 1)
 *   - schema/     — interface skeleton (Zod adapter in Phase 1)
 *   - sync/       — interface skeleton (in-memory impl in Phase 2)
 *
 * Sub-module imports also work for tighter dependency scoping:
 *   import { BaseMaterializer } from '@kedge-agentic/agent-runtime/workspace';
 *   import { JsonEditProvider } from '@kedge-agentic/agent-runtime/artifact';
 *
 * The flat root re-export below is convenient but signals "no
 * sub-module preference"; the per-area imports above signal what
 * surface you actually depend on. Either is fine.
 */

// Workspace (Phase A complete)
export { BaseMaterializer } from './workspace/base-materializer.js';
export type {
  ContentSource,
  SkillContent,
  SkillFileContent,
  McpServerContent,
  MaterializeResult,
} from './workspace/types.js';
export { noopLogger } from './workspace/logger.js';
export type { Logger } from './workspace/logger.js';

// Artifact (Phase 0 + Phase 1 source-loader port + Phase 2b-4 binary port)
export { JsonEditProvider } from './artifact/json-edit-provider.js';
export type {
  ArtifactType,
  Artifact,
  ArtifactStore,
  EditOperation,
  EditResult,
  ArtifactEditor,
  JsonEditProviderOptions,
  ArtifactSnapshot,
  ProjectArtifactSource,
  SaveArtifactResult,
  ProjectTenantResolver,
  BinaryArtifactSnapshot,
  BinaryArtifactListing,
  BinaryArtifactSource,
  SaveBinaryArtifactResult,
} from './artifact/index.js';

// Project (Phase 0 interfaces)
export type {
  Project,
  ProjectListOptions,
  ProjectStore,
  ProjectSession,
} from './project/types.js';

// Schema (Phase 0 interfaces)
export type {
  ValidationResult,
  SchemaValidator,
  SchemaRegistry,
} from './schema/types.js';

// Sync (Phase 0 interface + Phase 1 in-memory impl + sync engine)
export type { ChangeEvent, ChangeListener, ChangeStream } from './sync/types.js';
export { InMemoryChangeStream } from './sync/in-memory-change-stream.js';
export { InMemorySnapshotStore } from './sync/snapshot-store.js';
export type { SnapshotEntry, SnapshotStore } from './sync/snapshot-store.js';
export { SyncEngine } from './sync/sync-engine.js';
export type {
  ContentHasher,
  FsDelta,
  SyncAction,
  SyncEngineInput,
  SyncPlan,
  BinaryContentHasher,
  BinaryFsDelta,
  BinarySyncAction,
  BinarySyncEngineInput,
  BinarySyncPlan,
} from './sync/sync-engine.js';
