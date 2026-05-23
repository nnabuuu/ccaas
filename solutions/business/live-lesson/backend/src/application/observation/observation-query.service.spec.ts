import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ObservationRecord } from '@kedge-agentic/observer-engine';
import { ObservationQueryService } from './observation-query.service';
import type { IndicatorDef } from '../../schemas/classroom/observation';

// ── Helpers ──

const SESSION = 'sess-test';
const NOW = Date.now();
let idSeq = 0;

function makeRecord(overrides: Partial<ObservationRecord> & { type: string; entityId: string }): Partial<ObservationRecord> {
  const ts = overrides.createdAtEpoch ?? NOW;
  return {
    id: `obs-${++idSeq}`,
    sessionId: SESSION,
    tenantId: 'tenant-1',
    data: {},
    triggerEventId: 'evt-0',
    createdAtEpoch: ts,
    updatedAtEpoch: overrides.updatedAtEpoch ?? ts,
    ...overrides,
  };
}

const INDICATORS: IndicatorDef[] = [
  { id: 'K1', type: 'knowledge', label: '理解夹角', description: 'd1' },
  { id: 'K2', type: 'knowledge', label: '识别相似', description: 'd2' },
  { id: 'M1', type: 'misconception', label: '非夹角混淆', description: 'd3' },
  { id: 'M2', type: 'misconception', label: '比例颠倒', description: 'd4' },
];

// ── Tests ──

describe('ObservationQueryService', () => {
  let module: TestingModule;
  let service: ObservationQueryService;
  let repo: Repository<ObservationRecord>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [ObservationRecord],
          synchronize: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([ObservationRecord]),
      ],
      providers: [ObservationQueryService],
    }).compile();

    await module.init();
    service = module.get(ObservationQueryService);
    repo = module.get(getRepositoryToken(ObservationRecord));
  });

  afterAll(() => module.close());

  beforeEach(async () => {
    await repo.clear();
    service.clearSession(SESSION);
    idSeq = 0;
  });

  // ── Indicator Map CRUD ──

  describe('setIndicators / getIndicators / clearSession', () => {
    it('stores and retrieves indicators', () => {
      service.setIndicators(SESSION, INDICATORS);
      expect(service.getIndicators(SESSION)).toEqual(INDICATORS);
    });

    it('returns empty array for unknown session', () => {
      expect(service.getIndicators('no-such-session')).toEqual([]);
    });

    it('clearSession removes indicators', () => {
      service.setIndicators(SESSION, INDICATORS);
      service.clearSession(SESSION);
      expect(service.getIndicators(SESSION)).toEqual([]);
    });
  });

  // ── getStudentLogs ──

  describe('getStudentLogs', () => {
    it('returns empty array for session with no records', async () => {
      const logs = await service.getStudentLogs(SESSION);
      expect(logs).toEqual([]);
    });

    it('converts indicator_hit to event with source "llm"', async () => {
      await repo.save(repo.create(makeRecord({
        type: 'indicator_hit', entityId: 'stu-1',
        data: { anchors: ['M1'], gist: 'confused about angles', quote: '"this angle"' },
      })));

      const logs = await service.getStudentLogs(SESSION);
      expect(logs).toHaveLength(1);
      expect(logs[0].events).toHaveLength(1);
      const ev = logs[0].events[0];
      expect(ev.source).toBe('llm');
      expect(ev.anchors).toEqual(['M1']);
      expect(ev.gist).toBe('confused about angles');
      expect(ev.quote).toBe('"this angle"');
    });

    it('converts lifecycle join to student name gist', async () => {
      await repo.save(repo.create(makeRecord({
        type: 'lifecycle', entityId: 'stu-1',
        data: { action: 'join', studentName: 'Alice' },
      })));

      const logs = await service.getStudentLogs(SESSION);
      expect(logs[0].studentName).toBe('Alice');
      expect(logs[0].events[0].gist).toBe('Alice 加入课堂');
      expect(logs[0].events[0].source).toBe('system');
    });

    it('converts exercise to score gist', async () => {
      await repo.save(repo.create(makeRecord({
        type: 'exercise', entityId: 'stu-1',
        data: { score: 80, step: 2 },
      })));

      const logs = await service.getStudentLogs(SESSION);
      expect(logs[0].events[0].gist).toBe('提交 Step 2 答案，得分 80%');
    });

    it('converts progress to step completion gist', async () => {
      await repo.save(repo.create(makeRecord({
        type: 'progress', entityId: 'stu-1',
        data: { taskNum: 1, nextTask: 2 },
      })));

      const logs = await service.getStudentLogs(SESSION);
      expect(logs[0].events[0].gist).toBe('完成 Task 1，进入 Task 2');
    });

    it('groups multiple students correctly', async () => {
      await repo.save([
        repo.create(makeRecord({ type: 'lifecycle', entityId: 'stu-1', data: { action: 'join', studentName: 'Alice' } })),
        repo.create(makeRecord({ type: 'lifecycle', entityId: 'stu-2', data: { action: 'join', studentName: 'Bob' } })),
        repo.create(makeRecord({ type: 'indicator_hit', entityId: 'stu-1', data: { anchors: ['K1'], gist: 'g1' } })),
      ]);

      const logs = await service.getStudentLogs(SESSION);
      expect(logs).toHaveLength(2);
      const names = logs.map(l => l.studentName).sort();
      expect(names).toEqual(['Alice', 'Bob']);
      const alice = logs.find(l => l.studentName === 'Alice')!;
      expect(alice.events).toHaveLength(2); // join + indicator_hit
    });

    it('computes systemMetrics correctly', async () => {
      const ts = NOW - 10_000;
      await repo.save([
        repo.create(makeRecord({
          type: 'lifecycle', entityId: 'stu-1',
          data: { action: 'join', studentName: 'Alice' },
          createdAtEpoch: ts, updatedAtEpoch: ts,
        })),
        repo.create(makeRecord({
          type: 'exercise', entityId: 'stu-1',
          data: { score: 80, step: 1 },
          createdAtEpoch: ts + 1000, updatedAtEpoch: ts + 1000,
        })),
        repo.create(makeRecord({
          type: 'exercise', entityId: 'stu-1',
          data: { score: 60, step: 2 },
          createdAtEpoch: ts + 2000, updatedAtEpoch: ts + 2000,
        })),
        repo.create(makeRecord({
          type: 'progress', entityId: 'stu-1',
          data: { step: 2, taskNum: 2, nextTask: 3 },
          createdAtEpoch: ts + 3000, updatedAtEpoch: ts + 3000,
        })),
        repo.create(makeRecord({
          type: 'indicator_hit', entityId: 'stu-1',
          data: { anchors: ['K1'], gist: 'got it' },
          createdAtEpoch: ts + 4000, updatedAtEpoch: ts + 5000,
        })),
      ]);

      const logs = await service.getStudentLogs(SESSION);
      const m = logs[0].systemMetrics;
      expect(m.exerciseCorrectRate).toBe(70); // (80+60)/2 = 70
      expect(m.messageCount).toBe(1); // 1 indicator_hit
      expect(m.lastActiveAt).toBe(ts + 5000); // max updatedAt
      expect(m.currentStep).toBe('step-2');
    });
  });

  // ── generateAlerts ──

  describe('generateAlerts', () => {
    it('returns no alerts for active students', async () => {
      // Recent activity, no M-indicators → active
      await repo.save(repo.create(makeRecord({
        type: 'indicator_hit', entityId: 'stu-1',
        data: { anchors: ['K1'], gist: 'correct' },
        createdAtEpoch: NOW, updatedAtEpoch: NOW,
      })));

      const alerts = await service.generateAlerts(SESSION);
      expect(alerts).toEqual([]);
    });

    it('generates idle alert for inactive students (via deriveStatus)', async () => {
      const old = NOW - 200_000; // > 180s idle threshold
      await repo.save(repo.create(makeRecord({
        type: 'lifecycle', entityId: 'stu-1',
        data: { action: 'join', studentName: 'Alice' },
        createdAtEpoch: old, updatedAtEpoch: old,
      })));

      const alerts = await service.generateAlerts(SESSION);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('info');
      expect(alerts[0].message).toContain('Alice');
      expect(alerts[0].message).toContain('无活动');
    });

    it('generates stuck alert for many M-indicators', async () => {
      service.setIndicators(SESSION, INDICATORS);
      const records = [];
      for (let i = 0; i < 4; i++) {
        records.push(repo.create(makeRecord({
          type: 'indicator_hit', entityId: 'stu-1',
          data: { anchors: ['M1'], gist: `stuck-${i}` },
          createdAtEpoch: NOW - 1000 * i, updatedAtEpoch: NOW - 1000 * i,
        })));
      }
      records.push(repo.create(makeRecord({
        type: 'lifecycle', entityId: 'stu-1',
        data: { action: 'join', studentName: 'Bob' },
        createdAtEpoch: NOW - 5000, updatedAtEpoch: NOW - 5000,
      })));
      await repo.save(records);

      const alerts = await service.generateAlerts(SESSION);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('urgent');
      expect(alerts[0].indicatorId).toBe('M1');
      expect(alerts[0].message).toContain('Bob');
    });

    it('uses alertMessage from student_status when present', async () => {
      await repo.save([
        repo.create(makeRecord({
          type: 'student_status', entityId: 'stu-1',
          data: { status: 'struggling', alertMessage: 'Custom alert text' },
          createdAtEpoch: NOW, updatedAtEpoch: NOW,
        })),
        repo.create(makeRecord({
          type: 'lifecycle', entityId: 'stu-1',
          data: { action: 'join', studentName: 'Carol' },
        })),
      ]);

      const alerts = await service.generateAlerts(SESSION);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].message).toBe('Custom alert text');
      expect(alerts[0].severity).toBe('warn');
    });

    it('sorts alerts by severity: urgent > warn > info', async () => {
      // stu-1: idle (info)
      const old = NOW - 200_000;
      await repo.save(repo.create(makeRecord({
        type: 'lifecycle', entityId: 'stu-1',
        data: { action: 'join', studentName: 'Idle' },
        createdAtEpoch: old, updatedAtEpoch: old,
      })));

      // stu-2: stuck (urgent) via student_status
      await repo.save(repo.create(makeRecord({
        type: 'student_status', entityId: 'stu-2',
        data: { status: 'stuck', alertMessage: 'stuck msg' },
        createdAtEpoch: NOW, updatedAtEpoch: NOW,
      })));

      // stu-3: struggling (warn) via student_status
      await repo.save(repo.create(makeRecord({
        type: 'student_status', entityId: 'stu-3',
        data: { status: 'struggling', alertMessage: 'warn msg' },
        createdAtEpoch: NOW, updatedAtEpoch: NOW,
      })));

      const alerts = await service.generateAlerts(SESSION);
      expect(alerts.length).toBeGreaterThanOrEqual(3);
      expect(alerts[0].severity).toBe('urgent');
      expect(alerts[1].severity).toBe('warn');
      expect(alerts[2].severity).toBe('info');
    });
  });

  // ── computeIndicatorStats ──

  describe('computeIndicatorStats', () => {
    it('returns empty stats when no indicators set', async () => {
      const stats = await service.computeIndicatorStats(SESSION);
      expect(stats).toEqual([]);
    });

    it('returns zero counts when no hits exist', async () => {
      service.setIndicators(SESSION, INDICATORS);
      const stats = await service.computeIndicatorStats(SESSION);
      expect(stats).toHaveLength(4);
      for (const s of stats) {
        expect(s.studentCount).toBe(0);
        expect(s.latestGist).toBe('');
      }
    });

    it('counts distinct students and picks latest gist', async () => {
      service.setIndicators(SESSION, INDICATORS);
      const ts = NOW;
      await repo.save([
        repo.create(makeRecord({
          type: 'indicator_hit', entityId: 'stu-1',
          data: { anchors: ['M1'], gist: 'early hit' },
          createdAtEpoch: ts, updatedAtEpoch: ts,
        })),
        repo.create(makeRecord({
          type: 'indicator_hit', entityId: 'stu-1',
          data: { anchors: ['M1'], gist: 'second hit same student' },
          createdAtEpoch: ts + 1000, updatedAtEpoch: ts + 1000,
        })),
        repo.create(makeRecord({
          type: 'indicator_hit', entityId: 'stu-2',
          data: { anchors: ['M1'], gist: 'latest hit' },
          createdAtEpoch: ts + 2000, updatedAtEpoch: ts + 2000,
        })),
        repo.create(makeRecord({
          type: 'indicator_hit', entityId: 'stu-1',
          data: { anchors: ['K1'], gist: 'knowledge hit' },
          createdAtEpoch: ts + 500, updatedAtEpoch: ts + 500,
        })),
      ]);

      const stats = await service.computeIndicatorStats(SESSION);
      const m1 = stats.find(s => s.indicatorId === 'M1')!;
      expect(m1.studentCount).toBe(2); // stu-1 + stu-2
      expect(m1.latestGist).toBe('latest hit');

      const k1 = stats.find(s => s.indicatorId === 'K1')!;
      expect(k1.studentCount).toBe(1);
      expect(k1.latestGist).toBe('knowledge hit');

      const k2 = stats.find(s => s.indicatorId === 'K2')!;
      expect(k2.studentCount).toBe(0);
    });
  });

  // ── deriveStatusFromObservations (tested indirectly via generateAlerts) ──

  describe('deriveStatusFromObservations (indirect)', () => {
    it('derives "struggling" for 1-2 M-indicators', async () => {
      // 1 M-hit, no K-hits → struggling
      await repo.save([
        repo.create(makeRecord({
          type: 'lifecycle', entityId: 'stu-1',
          data: { action: 'join', studentName: 'Eve' },
          createdAtEpoch: NOW - 1000, updatedAtEpoch: NOW - 1000,
        })),
        repo.create(makeRecord({
          type: 'indicator_hit', entityId: 'stu-1',
          data: { anchors: ['M1'], gist: 'one M' },
          createdAtEpoch: NOW, updatedAtEpoch: NOW,
        })),
      ]);

      const alerts = await service.generateAlerts(SESSION);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('warn'); // struggling → warn
    });

    it('derives "active" when K-indicators dominate M-indicators', async () => {
      // 1 M + 3 K → mCount=1 ≥1, kCount=3 ≥2 and kCount > mCount → active
      const records = [
        repo.create(makeRecord({
          type: 'lifecycle', entityId: 'stu-1',
          data: { action: 'join', studentName: 'Frank' },
          createdAtEpoch: NOW - 5000, updatedAtEpoch: NOW - 5000,
        })),
        repo.create(makeRecord({
          type: 'indicator_hit', entityId: 'stu-1',
          data: { anchors: ['M1'], gist: 'one m' },
          createdAtEpoch: NOW - 1000, updatedAtEpoch: NOW - 1000,
        })),
      ];
      for (let i = 0; i < 3; i++) {
        records.push(repo.create(makeRecord({
          type: 'indicator_hit', entityId: 'stu-1',
          data: { anchors: ['K1'], gist: `k-${i}` },
          createdAtEpoch: NOW - 500 + i, updatedAtEpoch: NOW - 500 + i,
        })));
      }
      await repo.save(records);

      const alerts = await service.generateAlerts(SESSION);
      expect(alerts).toEqual([]); // active → no alert
    });

    it('derives "cruising" for high scores + few messages', async () => {
      // No M or K hits, high exercise score, ≤ 2 total hits → cruising
      await repo.save([
        repo.create(makeRecord({
          type: 'lifecycle', entityId: 'stu-1',
          data: { action: 'join', studentName: 'Grace' },
          createdAtEpoch: NOW - 1000, updatedAtEpoch: NOW - 1000,
        })),
        repo.create(makeRecord({
          type: 'exercise', entityId: 'stu-1',
          data: { score: 90, step: 1 },
          createdAtEpoch: NOW, updatedAtEpoch: NOW,
        })),
      ]);

      const alerts = await service.generateAlerts(SESSION);
      expect(alerts).toEqual([]); // cruising → no alert
    });
  });
});
