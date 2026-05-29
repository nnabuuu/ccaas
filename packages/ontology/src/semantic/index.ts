/**
 * `@kedge-agentic/ontology/semantic` subpath — Phase 1 (core).
 *
 * Adapters that project a Manifest + role into the formats an agent
 * runtime needs: Anthropic tool-use, MCP tools, or a Markdown system
 * prompt block.
 */

export {
  projectManifest,
  type ProjectionFormat,
  type ProjectionInput,
  type ProjectionResult,
} from './project.js';
export {
  projectAsAnthropicTools,
  projectAsMcpTools,
  projectAsSystemPrompt,
  type AnthropicTool,
  type McpTool,
} from './formats/index.js';
