/**
 * Bundle Registry
 *
 * Defines built-in platform bundles. Bundles are pluggable capability packages
 * that provide MCP tools and event trigger mappings.
 *
 * Bundles are enabled at the tenant level (config.enabledBundles) and
 * referenced by session templates (template.bundles).
 */

import type { BundleDefinition } from '@kedge-agentic/common';

/**
 * Built-in bundle definitions (hardcoded constants, not DB entities).
 *
 * - structured-output: Maps write_output tool results to output_update events.
 *   The tool itself is provided by solution MCP servers (field schema is solution-specific).
 *
 * - file-attachments: Maps attach_file tool results to output_update events.
 *   The tool is provided by core (packages/mcp/attach-file-server).
 */
export const BUILTIN_BUNDLES: Record<string, BundleDefinition> = {
  'structured-output': {
    id: 'structured-output',
    name: '结构化输出',
    description:
      '通过 write_output 工具将 AI 生成的结构化数据同步到前端表单。' +
      '工具由 Solution MCP Server 提供（因为字段 schema 是 Solution 特有的），' +
      'Bundle 只负责 event trigger mapping。',
    toolEventTriggers: [
      { toolName: 'write_output', eventType: 'output_update' },
    ],
  },
  'file-attachments': {
    id: 'file-attachments',
    name: '文件附件',
    description:
      '通过 attach_file 工具将 session 中生成的文件作为附件输出。' +
      '使用 core file registration API 注册文件。',
    mcpServer: {
      command: 'node',
      args: ['${CORE_MCP_DIR}/attach-file-server/dist/index.js'],
    },
    toolEventTriggers: [
      { toolName: 'attach_file', eventType: 'output_update' },
    ],
  },
  'shared-context': {
    id: 'shared-context',
    name: '共享上下文',
    description:
      '通过 read_context 工具读取前端同步的页面上下文，' +
      '支持 full 和 diff 两种模式。',
    mcpServer: {
      command: 'node',
      args: ['${CORE_MCP_DIR}/shared-context-server/dist/index.js'],
    },
    toolEventTriggers: [],
  },
};

/**
 * Get a bundle definition by ID.
 * Returns undefined if the bundle is not found.
 */
export function getBundle(bundleId: string): BundleDefinition | undefined {
  return BUILTIN_BUNDLES[bundleId];
}

/**
 * Get all available bundle definitions.
 */
export function getAllBundles(): BundleDefinition[] {
  return Object.values(BUILTIN_BUNDLES);
}
