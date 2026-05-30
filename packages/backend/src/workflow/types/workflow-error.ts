/**
 * `WorkflowError` — domain-specific failure shape for trigger dispatch.
 *
 * Distinct from `ToolResult { ok:false, code, ... }` because the
 * proxy's failure shape models tool-call failure modes, while
 * WorkflowError covers the orchestration layer's own failure modes:
 * predicate threw, args-mapper threw, manifest not registered,
 * cascade-budget exceeded.
 *
 * Engines should NEVER throw to callers of `WorkflowEngineService.ingest`
 * or to `onStateChange` listeners — every WorkflowError gets logged +
 * counted in `WorkflowMetricsService`, never propagated up the user-facing
 * call stack.
 */

export type WorkflowErrorCode =
  | 'predicate_threw'
  | 'args_mapper_threw'
  | 'manifest_not_registered'
  | 'cascade_budget_exceeded'
  | 'queue_overflow'
  | 'duplicate_event_dropped'
  | 'action_dispatch_failed';

export interface WorkflowError {
  readonly code: WorkflowErrorCode;
  readonly triggerApiName?: string;
  readonly sessionId?: string;
  readonly message: string;
  readonly cause?: unknown;
}

export function isWorkflowError(x: unknown): x is WorkflowError {
  return (
    typeof x === 'object' &&
    x !== null &&
    typeof (x as WorkflowError).code === 'string' &&
    typeof (x as WorkflowError).message === 'string'
  );
}
