/**
 * Workspace sub-module — Phase A (shipped).
 *
 * BaseMaterializer + ContentSource port + Logger port.
 * Originally the entirety of @kedge-agentic/agentfs-runtime (pre-rename).
 */

export { BaseMaterializer } from './base-materializer.js';
export type {
  ContentSource,
  SkillContent,
  SkillFileContent,
  McpServerContent,
  MaterializeResult,
} from './types.js';
export { noopLogger } from './logger.js';
export type { Logger } from './logger.js';
