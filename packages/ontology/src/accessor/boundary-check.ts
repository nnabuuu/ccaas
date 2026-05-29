/**
 * `checkBoundary` — the single pure-function gate. Spec §5.2.
 *
 * Given a manifest + a role + the operation being attempted (+ optional
 * runtime snapshots of state and slot-bindings), returns
 * allow/deny. Used by `ManifestAccessor` implementations as the
 * authority on every read / write / action / subscribe call.
 *
 * Phase 1 behavior:
 *
 *  - Role lookup: `manifest.boundaries.find(b => b.role === role)`. No
 *    boundary for the role → deny.
 *
 *  - `read` / `write`: path matches if `boundary.readable`
 *    (resp. `.writable`) contains either `'*'`, the exact path, or the
 *    path's first dot-segment as a prefix (so `'plan'` in the boundary
 *    list authorizes reads of `'plan.objective'`).
 *
 *  - `action`: two-gate per spec §3.3.
 *      Gate A: `boundary.actions` contains `'*'` or the actionApiName.
 *      Gate B: if `op.actionDef` was provided, also check
 *        `actionDef.allowedRoles` AND evaluate
 *        `actionDef.preconditions`.
 *    When `actionDef` is absent, gate B is skipped — caller is taking
 *    responsibility for those checks downstream.
 *
 *  - `subscribe`: stream apiName must be in `boundary.subscribes`
 *    (or `'*'`).
 *
 *  - Precondition kinds:
 *      - `stateEquals`: passes iff `input.state[fieldApiName]` equals
 *        the expected value. Without `input.state` → fails.
 *      - `slotBound`: passes iff `input.boundSlots` contains the slot
 *        apiName. Without `input.boundSlots` → fails.
 *      - `named`: Phase 1 stub — always returns unmet with a "Phase 4"
 *        reason. The named-predicate registry lands with Tier 2.
 *
 * Pure, no side effects, no I/O. All inputs are passed in; all outputs
 * land in the return value.
 *
 * @see ../../../docs/ontology/kedge-ontology-design.md (§5.2)
 */

import type { ActionDef, ActionPrecondition } from '../schema/index.js';
import type { AccessBoundary } from '../manifest/index.js';
import type {
  BoundaryCheckInput,
  BoundaryDecision,
  BoundaryOp,
} from './boundary-decision.js';

export function checkBoundary(input: BoundaryCheckInput): BoundaryDecision {
  const { manifest, role, op } = input;

  const boundary = manifest.boundaries.find((b) => b.role === role);
  if (!boundary) {
    return {
      allowed: false,
      reason: `no AccessBoundary declared for role '${role}' on manifest '${manifest.name}'`,
    };
  }

  switch (op.kind) {
    case 'read':
      return checkPath(boundary.readable, op.path, role, 'read');
    case 'write':
      return checkPath(boundary.writable, op.path, role, 'write');
    case 'subscribe':
      return checkSubscribe(boundary, op.streamApiName, role);
    case 'action':
      return checkAction(boundary, op, input);
    default: {
      // Exhaustiveness guard. Any future BoundaryOp variant added
      // without a case here trips the never-assignment compile error.
      const _exhaustive: never = op;
      return {
        allowed: false,
        reason: `unknown op kind: ${JSON.stringify(_exhaustive)}`,
      };
    }
  }
}

// ----- internals -----

function checkPath(
  allowList: readonly string[],
  path: string,
  role: string,
  verb: 'read' | 'write',
): BoundaryDecision {
  if (allowList.includes('*')) return { allowed: true };
  if (allowList.includes(path)) return { allowed: true };
  // Dot-path prefix: 'plan' in the allow-list authorizes 'plan.objective'.
  const head = path.split('.')[0];
  if (head !== path && allowList.includes(head)) return { allowed: true };
  const adjective = verb === 'read' ? 'readable' : 'writable';
  return {
    allowed: false,
    reason: `path '${path}' not ${adjective} for role '${role}'`,
  };
}

function checkSubscribe(
  boundary: AccessBoundary,
  streamApiName: string,
  role: string,
): BoundaryDecision {
  const subscribes = boundary.subscribes ?? [];
  if (subscribes.includes('*') || subscribes.includes(streamApiName)) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: `stream '${streamApiName}' not subscribable for role '${role}'`,
  };
}

function checkAction(
  boundary: AccessBoundary,
  op: Extract<BoundaryOp, { kind: 'action' }>,
  input: BoundaryCheckInput,
): BoundaryDecision {
  // Gate A: boundary.actions
  if (
    !boundary.actions.includes('*') &&
    !boundary.actions.includes(op.actionApiName)
  ) {
    return {
      allowed: false,
      reason: `action '${op.actionApiName}' not in AccessBoundary.actions for role '${input.role}'`,
    };
  }

  // Without ActionDef, caller has opted out of the second gate.
  if (!op.actionDef) return { allowed: true };

  return checkActionDef(op.actionDef, input);
}

function checkActionDef(
  actionDef: ActionDef,
  input: BoundaryCheckInput,
): BoundaryDecision {
  // Gate B.1: ActionDef.allowedRoles
  if (
    actionDef.allowedRoles &&
    actionDef.allowedRoles.length > 0 &&
    !actionDef.allowedRoles.includes(input.role)
  ) {
    return {
      allowed: false,
      reason: `role '${input.role}' not in ActionDef.allowedRoles for '${actionDef.apiName}'`,
    };
  }

  // Gate B.2: preconditions
  if (!actionDef.preconditions || actionDef.preconditions.length === 0) {
    return { allowed: true };
  }

  const unmet: ActionPrecondition[] = [];
  for (const pc of actionDef.preconditions) {
    if (!evaluatePrecondition(pc, input)) unmet.push(pc);
  }

  if (unmet.length > 0) {
    return {
      allowed: false,
      reason: `preconditions unmet for action '${actionDef.apiName}': ${unmet.length} of ${actionDef.preconditions.length}`,
      unmetPreconditions: unmet,
    };
  }
  return { allowed: true };
}

function evaluatePrecondition(
  pc: ActionPrecondition,
  input: BoundaryCheckInput,
): boolean {
  switch (pc.kind) {
    case 'stateEquals': {
      if (!input.state) return false; // fail-safe
      // Phase 1: direct key lookup against state field apiName. Spec's
      // `path` allows dot-path; Solutions in Phase 1 only target top-
      // level state fields, so traversal isn't needed yet.
      return Object.is(input.state[pc.path], pc.value);
    }
    case 'slotBound': {
      if (!input.boundSlots) return false; // fail-safe
      return input.boundSlots.has(pc.slot);
    }
    case 'named': {
      // Phase 1 stub. Named predicates land in Phase 4 alongside
      // BoundaryPredicate; until then every named precondition is unmet
      // so a Solution declaring one fails closed.
      return false;
    }
    default: {
      const _exhaustive: never = pc;
      void _exhaustive;
      return false;
    }
  }
}
