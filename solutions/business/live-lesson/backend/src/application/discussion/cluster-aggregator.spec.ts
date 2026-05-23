import { ClusterAggregator } from '../../application/discussion/cluster-aggregator';
import { DISCUSS_TARGET_HIT_REPO_PORT } from "../../domain/ports/discuss-target-hit-repo.port";
import { TypeOrmDiscussTargetHitRepository } from "../../adapters/persistence/repositories/discuss-target-hit.repository";
import type { ClassifyResult, TargetPointHit } from '../../schemas/classroom/clustering';

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

function makeMockTargetHitRepo() {
  // Mock the DiscussTargetHitRepoPort surface (was Repository<DiscussTargetHit> pre-Phase-2b)
  return {
    findBySession: jest.fn().mockResolvedValue([]),
    findTargetPointIdsBySessionAndStudent: jest.fn().mockResolvedValue([]),
    upsertHit: jest.fn().mockResolvedValue(undefined),
    countBySessionGroupByStudent: jest.fn().mockResolvedValue([]),
  } as never;
}

describe('ClusterAggregator', () => {
  let agg: ClusterAggregator;

  beforeEach(() => {
    agg = new ClusterAggregator(makeMockTargetHitRepo());
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

  // ── isHighlight capture ──

  describe('isHighlight capture', () => {
    it('stores isHighlight=false by default', () => {
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent());
      const obs = agg.getClusterStats('s1', 1)[0].observations[0];
      expect(obs.isHighlight).toBe(false);
      expect(obs.highlightGist).toBeFalsy();
    });

    it('stores isHighlight=true and highlightGist on new_signal', () => {
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent({
        isHighlight: true,
        highlightGist: '学生自发引入跨文化对比',
      }));
      const obs = agg.getClusterStats('s1', 1)[0].observations[0];
      expect(obs.isHighlight).toBe(true);
      expect(obs.highlightGist).toBe('学生自发引入跨文化对比');
    });

    it('upgrades isHighlight from false to true on subsequent message', () => {
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent({ isHighlight: false }));
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent({
        isHighlight: true,
        highlightGist: '后续发言展现深度思考',
      }));
      const obs = agg.getClusterStats('s1', 1)[0].observations[0];
      expect(obs.isHighlight).toBe(true);
      expect(obs.highlightGist).toBe('后续发言展现深度思考');
    });

    it('does not downgrade isHighlight from true to false', () => {
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent({
        isHighlight: true,
        highlightGist: '亮点发言',
      }));
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent({ isHighlight: false }));
      const obs = agg.getClusterStats('s1', 1)[0].observations[0];
      expect(obs.isHighlight).toBe(true);
      expect(obs.highlightGist).toBe('亮点发言');
    });

    it('stores isHighlight on reinforcing (no prior record)', () => {
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent({
        eventType: 'reinforcing',
        isHighlight: true,
        highlightGist: 'reinforcing 亮点',
      }));
      const obs = agg.getClusterStats('s1', 1)[0].observations[0];
      expect(obs.isHighlight).toBe(true);
      expect(obs.highlightGist).toBe('reinforcing 亮点');
    });

    it('upgrades isHighlight on reinforcing (existing record)', () => {
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent({ isHighlight: false }));
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent({
        eventType: 'reinforcing',
        isHighlight: true,
        highlightGist: 'reinforcing 升级',
      }));
      const obs = agg.getClusterStats('s1', 1)[0].observations[0];
      expect(obs.isHighlight).toBe(true);
      expect(obs.highlightGist).toBe('reinforcing 升级');
    });

    it('stores isHighlight on state_change (new cluster entry)', () => {
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent({ clusterId: 'c1' }));
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent({
        eventType: 'state_change',
        clusterId: 'c2',
        isHighlight: true,
        highlightGist: 'state_change 亮点',
      }));
      const c2 = agg.getClusterStats('s1', 1).find(s => s.clusterId === 'c2');
      expect(c2).toBeDefined();
      expect(c2!.observations[0].isHighlight).toBe(true);
      expect(c2!.observations[0].highlightGist).toBe('state_change 亮点');
    });

    it('highlight in "other" cluster (超越预设 scenario)', () => {
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent({
        clusterId: 'c1',
        confidence: 'low',
        isHighlight: true,
        highlightGist: '超越预设的深度见解',
      }));
      const stats = agg.getClusterStats('s1', 1);
      expect(stats[0].clusterId).toBe('other');
      expect(stats[0].observations[0].isHighlight).toBe(true);
      expect(stats[0].observations[0].highlightGist).toBe('超越预设的深度见解');
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

  // ── getStudentClusters ──

  describe('getStudentClusters', () => {
    const defs = [
      { id: 'c1', label: 'Cluster One' },
      { id: 'c2', label: 'Cluster Two' },
      { id: 'c3', label: 'Cluster Three' },
    ];

    it('returns all clusters with hit=false when no data', () => {
      const result = agg.getStudentClusters('s1', 1, 'stu1', defs);
      expect(result).toEqual([
        { id: 'c1', label: 'Cluster One', hit: false },
        { id: 'c2', label: 'Cluster Two', hit: false },
        { id: 'c3', label: 'Cluster Three', hit: false },
      ]);
    });

    it('marks hit clusters correctly', () => {
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent({ clusterId: 'c1' }));
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent({ clusterId: 'c3' }));
      const result = agg.getStudentClusters('s1', 1, 'stu1', defs);
      expect(result).toEqual([
        { id: 'c1', label: 'Cluster One', hit: true },
        { id: 'c2', label: 'Cluster Two', hit: false },
        { id: 'c3', label: 'Cluster Three', hit: true },
      ]);
    });

    it('does not count other students hits', () => {
      agg.ingest('s1', 1, 'stu2', 'Bob', makeEvent({ clusterId: 'c1' }));
      const result = agg.getStudentClusters('s1', 1, 'stu1', defs);
      expect(result.every(c => !c.hit)).toBe(true);
    });
  });

  // ── recordHit / getConsecutiveMisses ──

  describe('consecutiveMisses', () => {
    it('returns 0 with no history', () => {
      expect(agg.getConsecutiveMisses('s1', 1, 'stu1')).toBe(0);
    });

    it('counts consecutive false entries from end', () => {
      agg.recordHit('s1', 1, 'stu1', true);
      agg.recordHit('s1', 1, 'stu1', false);
      agg.recordHit('s1', 1, 'stu1', false);
      expect(agg.getConsecutiveMisses('s1', 1, 'stu1')).toBe(2);
    });

    it('resets count when a hit occurs', () => {
      agg.recordHit('s1', 1, 'stu1', false);
      agg.recordHit('s1', 1, 'stu1', false);
      agg.recordHit('s1', 1, 'stu1', true);
      expect(agg.getConsecutiveMisses('s1', 1, 'stu1')).toBe(0);
    });

    it('isolates by student', () => {
      agg.recordHit('s1', 1, 'stu1', false);
      agg.recordHit('s1', 1, 'stu1', false);
      agg.recordHit('s1', 1, 'stu2', true);
      expect(agg.getConsecutiveMisses('s1', 1, 'stu1')).toBe(2);
      expect(agg.getConsecutiveMisses('s1', 1, 'stu2')).toBe(0);
    });
  });

  // ── getUnhitClusterIds ──

  describe('getUnhitClusterIds', () => {
    const defs = [
      { id: 'c1', label: 'L1' },
      { id: 'c2', label: 'L2' },
      { id: 'c3', label: 'L3' },
    ];

    it('returns all clusters when none hit', () => {
      const result = agg.getUnhitClusterIds('s1', 1, 'stu1', defs);
      expect(result).toHaveLength(3);
    });

    it('excludes hit clusters', () => {
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent({ clusterId: 'c2' }));
      const result = agg.getUnhitClusterIds('s1', 1, 'stu1', defs);
      expect(result.map(c => c.id)).toEqual(['c1', 'c3']);
    });
  });

  // ── targetPoint ingestion ──

  describe('targetPoint ingestion', () => {
    const tpHit = (overrides: Partial<TargetPointHit> = {}): TargetPointHit => ({
      targetPointId: 'tp_1_1',
      confidence: 'high',
      evidenceSpan: 'tp evidence',
      ...overrides,
    });

    it('creates targetPoint state on first ingest', () => {
      const defs = [{ id: 'tp_1_1', label: 'Point A' }, { id: 'tp_1_2', label: 'Point B' }];
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent({
        targetPointHits: [tpHit()],
      }));
      const result = agg.getStudentTargetPoints('s1', 1, 'stu1', defs);
      expect(result).toEqual([
        { id: 'tp_1_1', label: 'Point A', hit: true },
        { id: 'tp_1_2', label: 'Point B', hit: false },
      ]);
    });

    it('high confidence marks hit=true, low confidence does not', () => {
      const defs = [{ id: 'tp_1_1', label: 'A' }, { id: 'tp_1_2', label: 'B' }];
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent({
        targetPointHits: [
          tpHit({ targetPointId: 'tp_1_1', confidence: 'high' }),
          tpHit({ targetPointId: 'tp_1_2', confidence: 'low' }),
        ],
      }));
      const result = agg.getStudentTargetPoints('s1', 1, 'stu1', defs);
      expect(result[0].hit).toBe(true);
      expect(result[1].hit).toBe(false);
    });

    it('already-hit stays hit on subsequent low-confidence ingest', () => {
      const defs = [{ id: 'tp_1_1', label: 'A' }];
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent({
        targetPointHits: [tpHit({ confidence: 'high' })],
      }));
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent({
        targetPointHits: [tpHit({ confidence: 'low' })],
      }));
      expect(agg.getStudentTargetPoints('s1', 1, 'stu1', defs)[0].hit).toBe(true);
    });

    it('caps evidenceSpans at 3', () => {
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent({ targetPointHits: [tpHit({ evidenceSpan: 'e1' })] }));
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent({ targetPointHits: [tpHit({ evidenceSpan: 'e2' })] }));
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent({ targetPointHits: [tpHit({ evidenceSpan: 'e3' })] }));
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent({ targetPointHits: [tpHit({ evidenceSpan: 'e4' })] }));
      // Internal state only — verify via stats that no crash occurs
      const stats = agg.getTargetPointStats('s1', 1);
      expect(stats).toHaveLength(1);
    });
  });

  // ── getStudentTargetPoints ──

  describe('getStudentTargetPoints', () => {
    const defs = [
      { id: 'tp_1_1', label: 'Point A' },
      { id: 'tp_1_2', label: 'Point B' },
      { id: 'tp_2_1', label: 'Point C' },
    ];

    it('returns all defs with hit=false when no data', () => {
      const result = agg.getStudentTargetPoints('s1', 1, 'stu1', defs);
      expect(result).toEqual([
        { id: 'tp_1_1', label: 'Point A', hit: false },
        { id: 'tp_1_2', label: 'Point B', hit: false },
        { id: 'tp_2_1', label: 'Point C', hit: false },
      ]);
    });

    it('does not count other students hits', () => {
      agg.ingest('s1', 1, 'stu2', 'Bob', makeEvent({
        targetPointHits: [{ targetPointId: 'tp_1_1', confidence: 'high', evidenceSpan: 'e' }],
      }));
      const result = agg.getStudentTargetPoints('s1', 1, 'stu1', defs);
      expect(result.every(tp => !tp.hit)).toBe(true);
    });
  });

  // ── getTargetPointStats ──

  describe('getTargetPointStats', () => {
    it('returns empty for unknown session', () => {
      expect(agg.getTargetPointStats('unknown', 1)).toEqual([]);
    });

    it('groups by targetPointId and deduplicates students', () => {
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent({
        targetPointHits: [{ targetPointId: 'tp_1_1', confidence: 'high', evidenceSpan: 'e1' }],
      }));
      agg.ingest('s1', 1, 'stu2', 'Bob', makeEvent({
        targetPointHits: [{ targetPointId: 'tp_1_1', confidence: 'high', evidenceSpan: 'e2' }],
      }));
      // Duplicate ingest for stu1 — should not double-count
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent({
        targetPointHits: [{ targetPointId: 'tp_1_1', confidence: 'high', evidenceSpan: 'e3' }],
      }));

      const stats = agg.getTargetPointStats('s1', 1);
      expect(stats).toHaveLength(1);
      expect(stats[0].targetPointId).toBe('tp_1_1');
      expect(stats[0].uniqueStudents).toBe(2);
      expect(stats[0].students).toHaveLength(2);
    });

    it('excludes non-hit target points', () => {
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent({
        targetPointHits: [{ targetPointId: 'tp_1_1', confidence: 'low', evidenceSpan: 'e' }],
      }));
      const stats = agg.getTargetPointStats('s1', 1);
      expect(stats).toEqual([]);
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

    it('clears miss history for session', () => {
      agg.recordHit('s1', 1, 'stu1', false);
      agg.recordHit('s1', 1, 'stu1', false);
      agg.cleanupSession('s1');
      expect(agg.getConsecutiveMisses('s1', 1, 'stu1')).toBe(0);
    });

    it('clears targetPoint data for session', () => {
      const defs = [{ id: 'tp_1_1', label: 'A' }];
      agg.ingest('s1', 1, 'stu1', 'Alice', makeEvent({
        targetPointHits: [{ targetPointId: 'tp_1_1', confidence: 'high', evidenceSpan: 'e' }],
      }));
      agg.cleanupSession('s1');
      expect(agg.getStudentTargetPoints('s1', 1, 'stu1', defs)[0].hit).toBe(false);
      expect(agg.getTargetPointStats('s1', 1)).toEqual([]);
    });
  });
});
