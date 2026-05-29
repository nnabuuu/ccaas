/**
 * Project a manifest to the MCP (Model Context Protocol) tools format.
 *
 * MCP's `tools/list` response shape:
 *   { name, description, inputSchema }
 *
 * Only differences vs the Anthropic projection:
 *   - field name `inputSchema` (camelCase) vs `input_schema` (snake)
 *   - description is recommended but optional in the MCP spec; we
 *     always populate it from ActionDef.semantic
 *
 * Visibility rules match the Anthropic projection: actions visible to
 * the role get listed; preconditions are NOT evaluated here.
 */

import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ManifestDef } from '../../manifest/index.js';
import type { OntologyRegistry } from '../../registry/index.js';
import type { BoundaryRole } from '../../types.js';
import { checkBoundary } from '../../accessor/index.js';

export interface McpTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: unknown;
}

export function projectAsMcpTools(
  manifest: ManifestDef,
  registry: OntologyRegistry,
  role: BoundaryRole,
): readonly McpTool[] {
  const tools: McpTool[] = [];

  for (const slot of manifest.slots) {
    if (slot.target.kind !== 'objectType') continue;
    const ot = registry.getObjectType(slot.target.apiName);
    if (!ot) continue;
    for (const action of ot.actions) {
      const decision = checkBoundary({
        manifest,
        role,
        op: { kind: 'action', actionApiName: action.apiName, actionDef: action },
      });
      if (!decision.allowed && decision.unmetPreconditions === undefined) {
        continue;
      }
      tools.push({
        name: action.apiName,
        description: action.semantic,
        inputSchema: zodToJsonSchema(action.params, { $refStrategy: 'none' }),
      });
    }
  }

  for (const f of registry.getAllFunctions()) {
    if (f.allowedRoles.length > 0 && !f.allowedRoles.includes(role)) continue;
    tools.push({
      name: f.apiName,
      description: f.semantic,
      inputSchema: zodToJsonSchema(f.params, { $refStrategy: 'none' }),
    });
  }

  return tools;
}
