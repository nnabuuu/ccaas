/**
 * `@kedge-agentic/ontology/accessor` subpath — Phase 1 (core + Tier 1).
 *
 * The runtime-facing layer: the `ManifestAccessor` interface (no impls
 * here — impls live in the consuming runtime), plus the pure
 * `checkBoundary` gate and the value shapes both sides share
 * (`ActionResult`, `BoundaryDecision`, `BoundaryCheckInput`).
 *
 * Phase 5 will add `ActionResult.returnValue` (gap-analysis G7) and the
 * `'compliance_blocked'` ActionErrorCode (G9). Both are absent from
 * the unions today.
 */

export type {
  ActionResult,
  ActionErrorCode,
  StateChange,
} from './action-result.js';
export type {
  BoundaryDecision,
  BoundaryCheckInput,
  BoundaryOp,
} from './boundary-decision.js';
export type {
  ManifestAccessor,
  ActionDescriptor,
} from './manifest-accessor.js';
export { checkBoundary } from './boundary-check.js';
