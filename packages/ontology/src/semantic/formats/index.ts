/**
 * Format adapters for `projectManifest`. Each adapter takes a
 * manifest + registry + role and returns its native projection format.
 */

export {
  projectAsAnthropicTools,
  type AnthropicTool,
} from './anthropic-tools.js';
export { projectAsMcpTools, type McpTool } from './mcp-tools.js';
export { projectAsSystemPrompt } from './system-prompt.js';
