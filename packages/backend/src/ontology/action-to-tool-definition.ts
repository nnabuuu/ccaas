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

/**
 * BoundaryRoles known to the platform today. Used by the bridge as the
 * defense-in-depth whitelist when the invocation context claims a role
 * — anything outside this list collapses to `opts.defaultRole`. The
 * `ExecutionContext.actingRole` contract says only the platform writes
 * it, but a stricter runtime check costs nothing and would catch a
 * future regression that lets agents influence the role propagation.
 */
const RECOGNIZED_ROLES: ReadonlySet<BoundaryRole> = new Set<BoundaryRole>([
  'agent',
  'picker',
  'admin',
  'student',
  'teacher',
]);

export interface CompileActionOptions {
  /**
   * Role to use when `invocation.context.actingRole` is absent OR is
   * outside the recognized whitelist (defense in depth).
   * Most ActionDefs allow only `'agent'`, so that's the default.
   */
  defaultRole?: BoundaryRole;
  /**
   * Optional resolver for the runtime state snapshot used by
   * `checkBoundary` to evaluate `stateEquals` preconditions. Without
   * this, any action carrying a precondition denies fail-safe — see
   * `boundary-check.ts:182-191`.
   */
  resolveState?: (
    invocation: ToolInvocation,
  ) =>
    | Readonly<Record<string, unknown>>
    | undefined
    | Promise<Readonly<Record<string, unknown>> | undefined>;
  /**
   * Optional resolver for the set of currently-bound slot apiNames, used
   * by `slotBound` preconditions.
   */
  resolveBoundSlots?: (
    invocation: ToolInvocation,
  ) => ReadonlySet<string> | undefined | Promise<ReadonlySet<string> | undefined>;
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
      const claimedRole = invocation.context.actingRole as
        | BoundaryRole
        | undefined;
      const role: BoundaryRole =
        claimedRole && RECOGNIZED_ROLES.has(claimedRole)
          ? claimedRole
          : defaultRole;

      const state = opts.resolveState
        ? await opts.resolveState(invocation)
        : undefined;
      const boundSlots = opts.resolveBoundSlots
        ? await opts.resolveBoundSlots(invocation)
        : undefined;

      const decision = checkBoundary({
        manifest,
        role,
        op: {
          kind: 'action',
          actionApiName: action.apiName,
          actionDef: action,
        },
        state,
        boundSlots,
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
