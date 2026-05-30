/**
 * Metrics counter contract — increment + read + snapshot + reset.
 */

import { WorkflowMetricsService } from './workflow-metrics.service';

describe('WorkflowMetricsService', () => {
  it('counters default to 0 and increment by 1', () => {
    const m = new WorkflowMetricsService();
    expect(m.get('triggers_fired')).toBe(0);
    m.inc('triggers_fired');
    m.inc('triggers_fired');
    expect(m.get('triggers_fired')).toBe(2);
  });

  it('inc accepts a custom delta', () => {
    const m = new WorkflowMetricsService();
    m.inc('events_dropped_queue_full', 10);
    expect(m.get('events_dropped_queue_full')).toBe(10);
  });

  it('snapshot returns every counter with 0 default', () => {
    const m = new WorkflowMetricsService();
    m.inc('triggers_fired');
    const snap = m.snapshot();
    expect(snap.triggers_fired).toBe(1);
    expect(snap.events_dropped_duplicate).toBe(0);
    expect(snap.cascade_depth_exceeded).toBe(0);
  });

  it('reset() clears every counter', () => {
    const m = new WorkflowMetricsService();
    m.inc('triggers_fired', 5);
    m.reset();
    expect(m.get('triggers_fired')).toBe(0);
  });
});
