/**
 * Project a manifest to the Anthropic tools format.
 *
 * Anthropic's tool-use API expects each tool as
 *   { name, description, input_schema }.
 *
 * We project:
 *   - every ActionDef on a slot-bound ObjectType that the role can
 *     invoke (boundary.actions gate + ActionDef.allowedRoles gate),
 *   - every FunctionDef whose allowedRoles includes the role.
 *
 * Preconditions are NOT evaluated here (no runtime state); the
 * Anthropic tool list reflects "what's structurally available to the
 * role," not "what's currently runnable." Runtime gating happens at
 * invocation time.
 */

import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ManifestDef } from '../../manifest/index.js';
import type { OntologyRegistry } from '../../registry/index.js';
import type { BoundaryRole } from '../../types.js';
import { checkBoundary } from '../../accessor/index.js';

export interface AnthropicTool {
  readonly name: string;
  readonly description: string;
  readonly input_schema: unknown;
}

export function projectAsAnthropicTools(
  manifest: ManifestDef,
  registry: OntologyRegistry,
  role: BoundaryRole,
): readonly AnthropicTool[] {
  const tools: AnthropicTool[] = [];

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
      // Skip preconditions for visibility purposes: a precondition
      // unmet by the empty state context is still a structurally
      // available action.
      if (!decision.allowed && decision.unmetPreconditions === undefined) {
        continue;
      }
      tools.push({
        name: action.apiName,
        description: action.semantic,
        input_schema: zodToJsonSchema(action.params, { $refStrategy: 'none' }),
      });
    }
  }

  for (const f of registry.getAllFunctions()) {
    if (f.allowedRoles.length > 0 && !f.allowedRoles.includes(role)) continue;
    tools.push({
      name: f.apiName,
      description: f.semantic,
      input_schema: zodToJsonSchema(f.params, { $refStrategy: 'none' }),
    });
  }

  return tools;
}
