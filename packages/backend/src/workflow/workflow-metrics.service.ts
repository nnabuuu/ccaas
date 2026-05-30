/**
 * `WorkflowMetricsService` — cheap in-process counters for engine
 * health.
 *
 * Phase 5 M1 ships counters only (no histograms / no exported
 * Prometheus endpoint). The metrics dimension is the metric name
 * itself; we don't break down by trigger apiName because trigger
 * counts can explode the cardinality. Per-trigger breakdown lives
 * inside structured logs.
 *
 * Counters are read-only from outside the engine; getters allow
 * ops smoke + integration tests to assert "X was dropped".
 */

import { Injectable } from '@nestjs/common';

export type WorkflowCounter =
  /** Trigger considered for dispatch (predicate evaluated + accessor built). */
  | 'triggers_fired'
  /** Trigger's `when` predicate returned false (or threw). */
  | 'triggers_predicate_rejected'
  /** Trigger's args-mapper threw — dispatch aborted, audited as execution_error. */
  | 'triggers_args_mapper_threw'
  /** Trigger's ActionRef.action wasn't registered in any toolkit. */
  | 'triggers_action_not_found'
  /** Trigger dispatch returned ok:false (any non-ok ToolResult code). */
  | 'triggers_action_failed'
  /** Per-session queue full; oldest dropped (drop_oldest backpressure). */
  | 'events_dropped_queue_full'
  /** Event ingest received a duplicate eventId (dedup hit). */
  | 'events_dropped_duplicate'
  /** Cascade depth exceeded ceiling — downstream trigger silently dropped. */
  | 'cascade_depth_exceeded'
  /** State-change listener invocation threw — swallowed. */
  | 'state_change_listener_threw'
  /** Subscribe handler threw on publish — swallowed. */
  | 'subscriber_threw';

@Injectable()
export class WorkflowMetricsService {
  private readonly counters = new Map<WorkflowCounter, number>();

  inc(counter: WorkflowCounter, by: number = 1): void {
    this.counters.set(counter, (this.counters.get(counter) ?? 0) + by);
  }

  get(counter: WorkflowCounter): number {
    return this.counters.get(counter) ?? 0;
  }

  snapshot(): Readonly<Record<WorkflowCounter, number>> {
    const out = {} as Record<WorkflowCounter, number>;
    for (const k of [
      'triggers_fired',
      'triggers_predicate_rejected',
      'triggers_args_mapper_threw',
      'triggers_action_not_found',
      'triggers_action_failed',
      'events_dropped_queue_full',
      'events_dropped_duplicate',
      'cascade_depth_exceeded',
      'state_change_listener_threw',
      'subscriber_threw',
    ] as WorkflowCounter[]) {
      out[k] = this.counters.get(k) ?? 0;
    }
    return out;
  }

  /** Test helper. */
  reset(): void {
    this.counters.clear();
  }
}
