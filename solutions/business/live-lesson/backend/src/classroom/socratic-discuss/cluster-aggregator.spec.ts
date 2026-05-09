import { ClusterAggregator } from './cluster-aggregator';
import type { ClassifyResult } from '../../schemas/classroom/clustering';

function makeEvent(overrides: Partial<ClassifyResult> = {}): ClassifyResult {
  return {
    clusterId: 'c1',
    confidence: 'high',
    eventType: 'new_signal',
    evidenceSpan: 'some evidence',
    isHighlight: false,
    highlightGist: null,
    ...overrides,
  } as ClassifyResult;
}

describe('ClusterAggregator', () => {
  let agg: ClusterAggregator;

  beforeEach(() => {
    agg = new ClusterAggregator();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── new_signal ──

  describe('new_signal', () => {
    it('creates a new observation', () => {
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent());
      const stats = agg.getClusterStats('s1', 1);
      expect(stats).toHaveLength(1);
      expect(stats[0].clusterId).toBe('c1');
      expect(stats[0].activeCount).toBe(1);
      expect(stats[0].observations[0].evidenceSpans).toEqual(['some evidence']);
    });

    it('appends evidence to existing observation', () => {
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent({ evidenceSpan: 'e1' }));
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent({ evidenceSpan: 'e2' }));
      const obs = agg.getClusterStats('s1', 1)[0].observations[0];
      expect(obs.evidenceSpans).toEqual(['e1', 'e2']);
    });

    it('caps evidence at 5 items', () => {
      for (let i = 1; i <= 7; i++) {
        agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent({ evidenceSpan: `e${i}` }));
      }
      const obs = agg.getClusterStats('s1', 1)[0].observations[0];
      expect(obs.evidenceSpans).toHaveLength(5);
      expect(obs.evidenceSpans[0]).toBe('e3'); // oldest 2 dropped
    });
  });

  // ── confidence remapping ──

  describe('confidence remapping', () => {
    it('remaps non-high confidence to "other" cluster', () => {
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent({ confidence: 'medium', clusterId: 'c1' }));
      const stats = agg.getClusterStats('s1', 1);
      expect(stats[0].clusterId).toBe('other');
    });

    it('keeps high confidence cluster as-is', () => {
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent({ confidence: 'high', clusterId: 'c1' }));
      const stats = agg.getClusterStats('s1', 1);
      expect(stats[0].clusterId).toBe('c1');
    });
  });

  // ── reinforcing ──

  describe('reinforcing', () => {
    it('appends evidence to existing observation', () => {
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent({ evidenceSpan: 'e1' }));
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent({ eventType: 'reinforcing', evidenceSpan: 'e2' }));
      const obs = agg.getClusterStats('s1', 1)[0].observations[0];
      expect(obs.evidenceSpans).toEqual(['e1', 'e2']);
    });

    it('creates new observation when no prior record exists', () => {
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent({ eventType: 'reinforcing' }));
      const stats = agg.getClusterStats('s1', 1);
      expect(stats).toHaveLength(1);
      expect(stats[0].activeCount).toBe(1);
    });
  });

  // ── state_change ──

  describe('state_change', () => {
    it('resolves same-cluster active observations and creates new entry', () => {
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent({ clusterId: 'c1' }));
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent({ eventType: 'state_change', clusterId: 'c1' }));
      const stats = agg.getClusterStats('s1', 1);
      // The old one is resolved but a new active one exists (same key, re-created)
      expect(stats[0].observations).toHaveLength(1);
    });

    it('resolves stale observations within 2-minute window', () => {
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent({ clusterId: 'c1' }));
      // Advance 1 minute (within 2-min window)
      jest.advanceTimersByTime(60_000);
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent({ eventType: 'state_change', clusterId: 'c2' }));

      const stats = agg.getClusterStats('s1', 1);
      const c1 = stats.find(s => s.clusterId === 'c1');
      const c2 = stats.find(s => s.clusterId === 'c2');
      expect(c1!.resolvedCount).toBe(1);
      expect(c2!.activeCount).toBe(1);
    });

    it('does NOT resolve old observations outside 2-minute window', () => {
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent({ clusterId: 'c1' }));
      // Advance 3 minutes (outside 2-min window)
      jest.advanceTimersByTime(3 * 60_000);
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent({ eventType: 'state_change', clusterId: 'c2' }));

      const stats = agg.getClusterStats('s1', 1);
      const c1 = stats.find(s => s.clusterId === 'c1');
      expect(c1!.activeCount).toBe(1); // still active — outside window
    });
  });

  // ── getClusterStats ──

  describe('getClusterStats', () => {
    it('returns empty for unknown session', () => {
      expect(agg.getClusterStats('unknown', 1)).toEqual([]);
    });

    it('counts unique students correctly', () => {
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent({ clusterId: 'c1' }));
      agg.ingest('s1', 1, 'stu2', 'Bob', makeEvent({ clusterId: 'c1' }));
      const stats = agg.getClusterStats('s1', 1);
      expect(stats[0].uniqueStudents).toBe(2);
      expect(stats[0].observationCount).toBe(2);
    });

    it('separates observations by taskNum', () => {
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent());
      agg.ingest('s1', 2, 'stu1', 'Alice', makeEvent());
      expect(agg.getClusterStats('s1', 1)).toHaveLength(1);
      expect(agg.getClusterStats('s1', 2)).toHaveLength(1);
    });
  });

  // ── cleanupSession ──

  describe('cleanupSession', () => {
    it('removes all data for session', () => {
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent());
      agg.cleanupSession('s1');
      expect(agg.getClusterStats('s1', 1)).toEqual([]);
    });

    it('does not affect other sessions', () => {
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent());
      agg.ingest('s2', 1, 'stu2', 'Bob', makeEvent());
      agg.cleanupSession('s1');
      expect(agg.getClusterStats('s2', 1)).toHaveLength(1);
    });
  });
});
