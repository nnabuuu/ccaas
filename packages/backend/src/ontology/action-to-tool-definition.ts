/**
 * Bridge: compile a Solution-authored `ActionDef` (from the ontology
 * package) into a `ToolDefinition` consumable by the ToolCallerProxy.
 *
 * The wrapped handler interposes a `checkBoundary` call at proxy
 * pipeline step 3 (where the legacy STUB permission check lives), so
 * every ActionDef-routed invocation is gated by the manifest's
 * AccessBoundary + the ActionDef's allowedRoles + preconditions
 * without each solution having to write that gate by hand.
 *
 * Step 6 (audit) still runs in the proxy itself — denied calls produce
 * a `tool_events` row with `outcome: 'permission_denied'` the same way
 * any other failure does.
 *
 * @see docs/ontology/kedge-ontology-design.md §10.2
 */

import {
  checkBoundary,
  type ActionDef,
  type BoundaryRole,
  type ManifestDef,
} from '@kedge-agentic/ontology';
import type {
  ToolDefinition,
  ToolInvocation,
  ToolResult,
} from '../tool-caller/types';

export type ActionHandler<TArgs = Record<string, unknown>> = (
  invocation: ToolInvocation<TArgs>,
) => Promise<ToolResult>;

export interface CompileActionOptions {
  /**
   * Role to use when `invocation.context.actingRole` is absent.
   * Most ActionDefs allow only `'agent'`, so that's the default.
   */
  defaultRole?: BoundaryRole;
}

export function compileActionToToolDefinition(
  action: ActionDef,
  handler: ActionHandler,
  manifest: ManifestDef,
  opts: CompileActionOptions = {},
): ToolDefinition {
  const defaultRole: BoundaryRole = opts.defaultRole ?? 'agent';

  return {
    name: action.apiName,
    description: action.semantic,
    argsSchema: action.params,
    requiredPermissions: action.requiredScopes ? [...action.requiredScopes] : [],
    visibility: { roles: [...action.allowedRoles] },
    handler: async (invocation) => {
      const role =
        ((invocation.context.actingRole as BoundaryRole | undefined) ??
          defaultRole);

      const decision = checkBoundary({
        manifest,
        role,
        op: {
          kind: 'action',
          actionApiName: action.apiName,
          actionDef: action,
        },
      });

      if (!decision.allowed) {
        return {
          ok: false,
          code: 'permission_denied',
          reason: decision.reason,
          unmetPreconditions: decision.unmetPreconditions,
        };
      }

      return handler(invocation);
    },
  };
}
