import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ObservationService } from './observation.service';
import { ObservationEvent } from '../../entities/observation-event.entity';
import { ClassroomSnapshot } from '../../entities/classroom-snapshot.entity';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

const ANCHORS = [
  { id: 'K1', type: 'knowledge' as const, label: 'Scanning策略识别', description: '能区分scanning和精读' },
  { id: 'K2', type: 'knowledge' as const, label: '文本结构理解', description: '识别对比结构' },
  { id: 'K3', type: 'knowledge' as const, label: '细节信息提取', description: '准确提取事实信息' },
  { id: 'M1', type: 'misconception' as const, label: '表面理解陷阱', description: '只理解字面意思' },
  { id: 'M2', type: 'misconception' as const, label: '证据不足论证', description: '不引用文本证据' },
];

describe('ObservationService — aggregation', () => {
  let module: TestingModule;
  let svc: ObservationService;
  let eventRepo: Repository<ObservationEvent>;

  const SESSION = 'sess-001';

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [ObservationEvent],
          synchronize: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([ObservationEvent, ClassroomSnapshot]),
      ],
      providers: [ObservationService],
    }).compile();

    svc = module.get(ObservationService);
    eventRepo = module.get(getRepositoryToken(ObservationEvent));
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(async () => {
    // Reset in-memory state between tests by cleaning up then re-initializing
    await svc.cleanupSession(SESSION);
    await eventRepo.clear();
    svc.initSession(SESSION, ANCHORS);
  });

  // ─────────────────────────────────────────────
  // 1. Session lifecycle
  // ─────────────────────────────────────────────

  describe('session lifecycle', () => {
    it('should initialize indicators and return them', () => {
      const indicators = svc.getIndicators(SESSION);
      expect(indicators).toHaveLength(5);
      expect(indicators.map(a => a.id)).toEqual(['K1', 'K2', 'K3', 'M1', 'M2']);
    });

    it('should return empty logs before any students', () => {
      expect(svc.getStudentLogs(SESSION)).toEqual([]);
    });

    it('should return empty indicators for unknown session', () => {
      expect(svc.getIndicators('nonexistent')).toEqual([]);
    });

    it('should return empty logs for unknown session', () => {
      expect(svc.getStudentLogs('nonexistent')).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────
  // 1b. getStudentLog (singular)
  // ─────────────────────────────────────────────

  describe('getStudentLog (singular)', () => {
    it('should return null for unknown session', () => {
      expect(svc.getStudentLog('nonexistent', 'stu-1')).toBeNull();
    });

    it('should return null for unknown student in known session', () => {
      expect(svc.getStudentLog(SESSION, 'nonexistent')).toBeNull();
    });

    it('should return the specific student log', async () => {
      await svc.addSystemEvent(SESSION, 'stu-1', 'A', 'join', {}, 'A joined');
      await svc.addSystemEvent(SESSION, 'stu-2', 'B', 'join', {}, 'B joined');
      const log = svc.getStudentLog(SESSION, 'stu-1');
      expect(log).not.toBeNull();
      expect(log!.studentId).toBe('stu-1');
      expect(log!.studentName).toBe('A');
    });
  });

  // ─────────────────────────────────────────────
  // 2. System events (join, submit)
  // ─────────────────────────────────────────────

  describe('system events', () => {
    it('should record a join event', () => {
      svc.addSystemEvent(SESSION, 'stu-1', '小明', 'join', {}, '小明 加入课堂');

      const logs = svc.getStudentLogs(SESSION);
      expect(logs).toHaveLength(1);
      expect(logs[0].studentId).toBe('stu-1');
      expect(logs[0].studentName).toBe('小明');
      expect(logs[0].events).toHaveLength(1);
      expect(logs[0].events[0]).toMatchObject({
        id: 'e1',
        source: 'system',
        systemType: 'join',
        gist: '小明 加入课堂',
        anchors: [],
      });
    });

    it('should record exercise_result and update exerciseCorrectRate', () => {
      svc.addSystemEvent(SESSION, 'stu-1', '小明', 'join', {}, '小明 加入课堂');
      svc.addSystemEvent(SESSION, 'stu-1', '小明', 'exercise_result', { step: 1, score: 75 }, '提交 Step 1，得分 75%');

      const logs = svc.getStudentLogs(SESSION);
      expect(logs[0].events).toHaveLength(2);
      expect(logs[0].events[1].systemType).toBe('exercise_result');
      expect(logs[0].systemMetrics.exerciseCorrectRate).toBe(75);
    });

    it('should record a discuss_depth event with data payload', async () => {
      await svc.addSystemEvent(SESSION, 'stu-1', '小明', 'join', {}, '小明 加入课堂');
      await svc.addSystemEvent(SESSION, 'stu-1', '小明', 'discuss_depth', { taskNum: 1, depth: 'partial', interactionType: 'probeReply' }, 'Discuss depth: partial');

      const logs = svc.getStudentLogs(SESSION);
      expect(logs[0].events).toHaveLength(2);
      const depthEvent = logs[0].events[1];
      expect(depthEvent.systemType).toBe('discuss_depth');
      expect(depthEvent.data).toEqual({ taskNum: 1, depth: 'partial', interactionType: 'probeReply' });
      expect(depthEvent.gist).toBe('Discuss depth: partial');
    });

    it('should assign incrementing event IDs', () => {
      svc.addSystemEvent(SESSION, 'stu-1', '小明', 'join', {}, 'e1');
      svc.addSystemEvent(SESSION, 'stu-1', '小明', 'exercise_result', { score: 80 }, 'e2');
      svc.addSystemEvent(SESSION, 'stu-1', '小明', 'step_complete', {}, 'e3');

      const events = svc.getStudentLogs(SESSION)[0].events;
      expect(events.map(e => e.id)).toEqual(['e1', 'e2', 'e3']);
    });
  });

  // ─────────────────────────────────────────────
  // 3. Multi-student aggregation
  // ─────────────────────────────────────────────

  describe('multi-student aggregation', () => {
    beforeEach(() => {
      // Three students join
      svc.addSystemEvent(SESSION, 'stu-1', '小明', 'join', {}, '小明 加入');
      svc.addSystemEvent(SESSION, 'stu-2', '小红', 'join', {}, '小红 加入');
      svc.addSystemEvent(SESSION, 'stu-3', '小刚', 'join', {}, '小刚 加入');
    });

    it('should track separate logs per student', () => {
      const logs = svc.getStudentLogs(SESSION);
      expect(logs).toHaveLength(3);
      expect(logs.map(l => l.studentId).sort()).toEqual(['stu-1', 'stu-2', 'stu-3']);
    });

    it('should isolate events between students', () => {
      svc.addSystemEvent(SESSION, 'stu-1', '小明', 'exercise_result', { score: 100 }, '满分');
      svc.addSystemEvent(SESSION, 'stu-2', '小红', 'exercise_result', { score: 50 }, '半对');

      const logs = svc.getStudentLogs(SESSION);
      const ming = logs.find(l => l.studentId === 'stu-1')!;
      const hong = logs.find(l => l.studentId === 'stu-2')!;
      const gang = logs.find(l => l.studentId === 'stu-3')!;

      expect(ming.events).toHaveLength(2); // join + result
      expect(hong.events).toHaveLength(2);
      expect(gang.events).toHaveLength(1); // join only

      expect(ming.systemMetrics.exerciseCorrectRate).toBe(100);
      expect(hong.systemMetrics.exerciseCorrectRate).toBe(50);
      expect(gang.systemMetrics.exerciseCorrectRate).toBe(0);
    });
  });

  // ─────────────────────────────────────────────
  // 4. deriveStatus — status derivation
  // ─────────────────────────────────────────────

  describe('deriveStatus', () => {
    it('should return active by default for a fresh student', () => {
      svc.addSystemEvent(SESSION, 'stu-1', '小明', 'join', {}, '加入');
      const log = svc.getStudentLogs(SESSION)[0];
      expect(svc.deriveStatus(log)).toBe('active');
    });

    it('should return idle when lastActiveAt is > 3 min ago', () => {
      svc.addSystemEvent(SESSION, 'stu-1', '小明', 'join', {}, '加入');
      const log = svc.getStudentLogs(SESSION)[0];
      // Simulate idle by backdating lastActiveAt
      log.systemMetrics.lastActiveAt = Date.now() - 4 * 60 * 1000;
      expect(svc.deriveStatus(log)).toBe('idle');
    });

    it('should return struggling when 1 misconception event in last 5 min', () => {
      svc.addSystemEvent(SESSION, 'stu-1', '小明', 'join', {}, '加入');
      const log = svc.getStudentLogs(SESSION)[0];
      // Inject a recent LLM event with a misconception indicator
      log.events.push({
        id: 'e2', timestamp: Date.now(), updatedAt: Date.now(),
        anchors: ['M1'], gist: '混淆了字面意思', quote: null, source: 'llm',
      });
      expect(svc.deriveStatus(log)).toBe('struggling');
    });

    it('should return stuck when >= 3 misconception events in last 5 min', () => {
      svc.addSystemEvent(SESSION, 'stu-1', '小明', 'join', {}, '加入');
      const log = svc.getStudentLogs(SESSION)[0];
      const now = Date.now();
      for (let i = 0; i < 3; i++) {
        log.events.push({
          id: `m${i}`, timestamp: now - i * 1000, updatedAt: now,
          anchors: ['M1'], gist: `误解 ${i}`, quote: null, source: 'llm',
        });
      }
      expect(svc.deriveStatus(log)).toBe('stuck');
    });

    it('should return cruising when exerciseCorrectRate >= 80 and messageCount <= 2', () => {
      svc.addSystemEvent(SESSION, 'stu-1', '小明', 'join', {}, '加入');
      const log = svc.getStudentLogs(SESSION)[0];
      log.systemMetrics.exerciseCorrectRate = 85;
      log.systemMetrics.messageCount = 1;
      expect(svc.deriveStatus(log)).toBe('cruising');
    });

    it('should prefer idle over stuck (idle has higher priority)', () => {
      svc.addSystemEvent(SESSION, 'stu-1', '小明', 'join', {}, '加入');
      const log = svc.getStudentLogs(SESSION)[0];
      log.systemMetrics.lastActiveAt = Date.now() - 4 * 60 * 1000;
      // Also inject misconceptions — but idle should win
      for (let i = 0; i < 3; i++) {
        log.events.push({
          id: `m${i}`, timestamp: Date.now(), updatedAt: Date.now(),
          anchors: ['M2'], gist: `误解 ${i}`, quote: null, source: 'llm',
        });
      }
      expect(svc.deriveStatus(log)).toBe('idle');
    });
  });

  // ─────────────────────────────────────────────
  // 5. generateAlerts — alert generation
  // ─────────────────────────────────────────────

  describe('generateAlerts', () => {
    it('should return no alerts for all-active students', () => {
      svc.addSystemEvent(SESSION, 'stu-1', '小明', 'join', {}, '加入');
      svc.addSystemEvent(SESSION, 'stu-2', '小红', 'join', {}, '加入');
      expect(svc.generateAlerts(SESSION)).toEqual([]);
    });

    it('should generate urgent alert for stuck student', () => {
      svc.addSystemEvent(SESSION, 'stu-1', '小明', 'join', {}, '加入');
      const log = svc.getStudentLogs(SESSION)[0];
      const now = Date.now();
      for (let i = 0; i < 3; i++) {
        log.events.push({
          id: `m${i}`, timestamp: now, updatedAt: now,
          anchors: ['M1'], gist: `误解 ${i}`, quote: null, source: 'llm',
        });
      }

      const alerts = svc.generateAlerts(SESSION);
      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toMatchObject({
        studentName: '小明',
        studentId: 'stu-1',
        severity: 'urgent',
        indicatorId: 'M1',
      });
      expect(alerts[0].message).toContain('小明');
      expect(alerts[0].message).toContain('表面理解陷阱'); // indicator label
    });

    it('should generate warn alert for struggling student', () => {
      svc.addSystemEvent(SESSION, 'stu-1', '小明', 'join', {}, '加入');
      const log = svc.getStudentLogs(SESSION)[0];
      log.events.push({
        id: 'e2', timestamp: Date.now(), updatedAt: Date.now(),
        anchors: ['M2'], gist: '无证据论证', quote: null, source: 'llm',
      });

      const alerts = svc.generateAlerts(SESSION);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('warn');
      expect(alerts[0].indicatorId).toBe('M2');
    });

    it('should generate info alert for idle student', () => {
      svc.addSystemEvent(SESSION, 'stu-1', '小明', 'join', {}, '加入');
      const log = svc.getStudentLogs(SESSION)[0];
      log.systemMetrics.lastActiveAt = Date.now() - 4 * 60 * 1000;

      const alerts = svc.generateAlerts(SESSION);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('info');
      expect(alerts[0].message).toContain('3 分钟');
    });

    it('should sort alerts by severity: urgent > warn > info', () => {
      // Student A: stuck (urgent)
      svc.addSystemEvent(SESSION, 'stu-a', 'A', 'join', {}, 'A 加入');
      const logA = svc.getStudentLogs(SESSION).find(l => l.studentId === 'stu-a')!;
      for (let i = 0; i < 3; i++) {
        logA.events.push({
          id: `ma${i}`, timestamp: Date.now(), updatedAt: Date.now(),
          anchors: ['M1'], gist: `stuck ${i}`, quote: null, source: 'llm',
        });
      }

      // Student B: struggling (warn)
      svc.addSystemEvent(SESSION, 'stu-b', 'B', 'join', {}, 'B 加入');
      const logB = svc.getStudentLogs(SESSION).find(l => l.studentId === 'stu-b')!;
      logB.events.push({
        id: 'mb1', timestamp: Date.now(), updatedAt: Date.now(),
        anchors: ['M2'], gist: 'struggling', quote: null, source: 'llm',
      });

      // Student C: idle (info)
      svc.addSystemEvent(SESSION, 'stu-c', 'C', 'join', {}, 'C 加入');
      const logC = svc.getStudentLogs(SESSION).find(l => l.studentId === 'stu-c')!;
      logC.systemMetrics.lastActiveAt = Date.now() - 4 * 60 * 1000;

      const alerts = svc.generateAlerts(SESSION);
      expect(alerts).toHaveLength(3);
      expect(alerts[0].severity).toBe('urgent');
      expect(alerts[1].severity).toBe('warn');
      expect(alerts[2].severity).toBe('info');
    });
  });

  // ─────────────────────────────────────────────
  // 6. computeIndicatorStats — cross-student aggregation
  // ─────────────────────────────────────────────

  describe('computeIndicatorStats', () => {
    it('should return zero counts for all anchors when no events have anchors', () => {
      svc.addSystemEvent(SESSION, 'stu-1', '小明', 'join', {}, '加入');
      svc.addSystemEvent(SESSION, 'stu-2', '小红', 'join', {}, '加入');

      const stats = svc.computeIndicatorStats(SESSION);
      expect(stats).toHaveLength(5);
      for (const s of stats) {
        expect(s.studentCount).toBe(0);
        expect(s.latestGist).toBe('');
      }
    });

    it('should count distinct students per indicator', () => {
      // 小明 hits K1
      svc.addSystemEvent(SESSION, 'stu-1', '小明', 'join', {}, '加入');
      const logMing = svc.getStudentLogs(SESSION).find(l => l.studentId === 'stu-1')!;
      logMing.events.push({
        id: 'e2', timestamp: 1000, updatedAt: 1000,
        anchors: ['K1'], gist: '小明理解了scanning', quote: null, source: 'llm',
      });

      // 小红 also hits K1 + K2
      svc.addSystemEvent(SESSION, 'stu-2', '小红', 'join', {}, '加入');
      const logHong = svc.getStudentLogs(SESSION).find(l => l.studentId === 'stu-2')!;
      logHong.events.push({
        id: 'e2', timestamp: 2000, updatedAt: 2000,
        anchors: ['K1', 'K2'], gist: '小红区分了scanning和精读结构', quote: null, source: 'llm',
      });

      // 小刚 only joins — no indicators
      svc.addSystemEvent(SESSION, 'stu-3', '小刚', 'join', {}, '加入');

      const stats = svc.computeIndicatorStats(SESSION);
      const k1 = stats.find(s => s.indicatorId === 'K1')!;
      const k2 = stats.find(s => s.indicatorId === 'K2')!;
      const k3 = stats.find(s => s.indicatorId === 'K3')!;
      const m1 = stats.find(s => s.indicatorId === 'M1')!;

      expect(k1.studentCount).toBe(2); // 小明 + 小红
      expect(k2.studentCount).toBe(1); // 小红 only
      expect(k3.studentCount).toBe(0);
      expect(m1.studentCount).toBe(0);
    });

    it('should return latest gist per indicator across students', () => {
      svc.addSystemEvent(SESSION, 'stu-1', '小明', 'join', {}, '加入');
      const log1 = svc.getStudentLogs(SESSION)[0];
      log1.events.push({
        id: 'e2', timestamp: 1000, updatedAt: 1000,
        anchors: ['K1'], gist: '早期理解', quote: null, source: 'llm',
      });

      svc.addSystemEvent(SESSION, 'stu-2', '小红', 'join', {}, '加入');
      const log2 = svc.getStudentLogs(SESSION).find(l => l.studentId === 'stu-2')!;
      log2.events.push({
        id: 'e2', timestamp: 5000, updatedAt: 5000,
        anchors: ['K1'], gist: '更新的理解', quote: null, source: 'llm',
      });

      const stats = svc.computeIndicatorStats(SESSION);
      const k1 = stats.find(s => s.indicatorId === 'K1')!;
      expect(k1.latestGist).toBe('更新的理解');
      expect(k1.updatedAt).toBe(5000);
    });

    it('should count misconception anchors across students', () => {
      // 3 students all hit M1
      for (const [id, name] of [['s1', 'A'], ['s2', 'B'], ['s3', 'C']] as const) {
        svc.addSystemEvent(SESSION, id, name, 'join', {}, `${name} 加入`);
        const log = svc.getStudentLogs(SESSION).find(l => l.studentId === id)!;
        log.events.push({
          id: 'e2', timestamp: Date.now(), updatedAt: Date.now(),
          anchors: ['M1'], gist: `${name} 表面理解`, quote: null, source: 'llm',
        });
      }

      const stats = svc.computeIndicatorStats(SESSION);
      const m1 = stats.find(s => s.indicatorId === 'M1')!;
      expect(m1.studentCount).toBe(3);
      expect(m1.type).toBe('misconception');
    });

    it('should not double-count when same student has multiple events for same indicator', () => {
      svc.addSystemEvent(SESSION, 'stu-1', '小明', 'join', {}, '加入');
      const log = svc.getStudentLogs(SESSION)[0];
      log.events.push(
        { id: 'e2', timestamp: 1000, updatedAt: 1000, anchors: ['K1'], gist: '第一次', quote: null, source: 'llm' as const },
        { id: 'e3', timestamp: 2000, updatedAt: 2000, anchors: ['K1'], gist: '第二次', quote: null, source: 'llm' as const },
      );

      const stats = svc.computeIndicatorStats(SESSION);
      const k1 = stats.find(s => s.indicatorId === 'K1')!;
      expect(k1.studentCount).toBe(1); // same student, counted once
      expect(k1.latestGist).toBe('第二次'); // but latest gist is from e3
    });
  });

  // ─────────────────────────────────────────────
  // 7. Full integration: student flow → teacher aggregation
  // ─────────────────────────────────────────────

  describe('full student→teacher aggregation', () => {
    it('should aggregate a realistic classroom scenario', () => {
      // Phase 1: Three students join
      svc.addSystemEvent(SESSION, 's1', '小明', 'join', {}, '小明 加入课堂');
      svc.addSystemEvent(SESSION, 's2', '小红', 'join', {}, '小红 加入课堂');
      svc.addSystemEvent(SESSION, 's3', '小刚', 'join', {}, '小刚 加入课堂');

      // Phase 2: Students submit exercises
      svc.addSystemEvent(SESSION, 's1', '小明', 'exercise_result', { step: 1, score: 100 }, '提交 Step 1，得分 100%');
      svc.addSystemEvent(SESSION, 's2', '小红', 'exercise_result', { step: 1, score: 50 }, '提交 Step 1，得分 50%');
      svc.addSystemEvent(SESSION, 's3', '小刚', 'exercise_result', { step: 1, score: 75 }, '提交 Step 1，得分 75%');

      // Phase 3: LLM observation events (simulating what observeTurn would produce)
      const logs = svc.getStudentLogs(SESSION);
      const ming = logs.find(l => l.studentId === 's1')!;
      const hong = logs.find(l => l.studentId === 's2')!;
      const gang = logs.find(l => l.studentId === 's3')!;

      // 小明: demonstrates K1 (scanning) understanding
      ming.events.push({
        id: 'e3', timestamp: Date.now(), updatedAt: Date.now(),
        anchors: ['K1'], gist: '准确描述了scanning与精读的区别', quote: 'scanning就是快速找关键词', source: 'llm',
      });

      // 小红: shows M1 misconception
      hong.events.push({
        id: 'e3', timestamp: Date.now(), updatedAt: Date.now(),
        anchors: ['M1'], gist: '把standard of beauty理解为标准美', quote: null, source: 'llm',
      });

      // 小刚: shows K1 + M2 (understands scanning but can't provide evidence)
      gang.events.push({
        id: 'e3', timestamp: Date.now(), updatedAt: Date.now(),
        anchors: ['K1', 'M2'], gist: '理解scanning但论证缺少文本证据', quote: null, source: 'llm',
      });

      // ── Teacher sees aggregated state ──

      // Logs
      const allLogs = svc.getStudentLogs(SESSION);
      expect(allLogs).toHaveLength(3);
      expect(allLogs.every(l => l.events.length >= 2)).toBe(true); // at least join + result

      // Indicator stats
      const stats = svc.computeIndicatorStats(SESSION);
      const k1 = stats.find(s => s.indicatorId === 'K1')!;
      const m1 = stats.find(s => s.indicatorId === 'M1')!;
      const m2 = stats.find(s => s.indicatorId === 'M2')!;

      expect(k1.studentCount).toBe(2); // 小明 + 小刚
      expect(k1.type).toBe('knowledge');
      expect(m1.studentCount).toBe(1); // 小红
      expect(m1.type).toBe('misconception');
      expect(m2.studentCount).toBe(1); // 小刚

      // Alerts — 小红 is struggling (1 misconception), 小刚 is also struggling (M2)
      const alerts = svc.generateAlerts(SESSION);
      expect(alerts.length).toBeGreaterThanOrEqual(2);
      const warnAlerts = alerts.filter(a => a.severity === 'warn');
      expect(warnAlerts).toHaveLength(2);
      const alertNames = warnAlerts.map(a => a.studentName).sort();
      expect(alertNames).toEqual(['小刚', '小红']);

      // Status — 小明 has 100% score and low messageCount → cruising
      expect(svc.deriveStatus(ming)).toBe('cruising');
      expect(svc.deriveStatus(hong)).toBe('struggling');
      expect(svc.deriveStatus(gang)).toBe('struggling');
    });

    it('should track escalation from struggling to stuck', () => {
      svc.addSystemEvent(SESSION, 's1', '小红', 'join', {}, '小红 加入');
      const log = svc.getStudentLogs(SESSION)[0];

      // First misconception → struggling
      log.events.push({
        id: 'e2', timestamp: Date.now(), updatedAt: Date.now(),
        anchors: ['M1'], gist: '误解1', quote: null, source: 'llm',
      });
      expect(svc.deriveStatus(log)).toBe('struggling');
      expect(svc.generateAlerts(SESSION)[0].severity).toBe('warn');

      // Second misconception → still struggling
      log.events.push({
        id: 'e3', timestamp: Date.now(), updatedAt: Date.now(),
        anchors: ['M2'], gist: '误解2', quote: null, source: 'llm',
      });
      expect(svc.deriveStatus(log)).toBe('struggling');

      // Third misconception → stuck!
      log.events.push({
        id: 'e4', timestamp: Date.now(), updatedAt: Date.now(),
        anchors: ['M1'], gist: '误解3', quote: null, source: 'llm',
      });
      expect(svc.deriveStatus(log)).toBe('stuck');

      const alerts = svc.generateAlerts(SESSION);
      expect(alerts[0].severity).toBe('urgent');
      expect(alerts[0].indicatorId).toBe('M1'); // last misconception indicator
    });
  });

  // ─────────────────────────────────────────────
  // 8. Session isolation
  // ─────────────────────────────────────────────

  describe('session isolation', () => {
    it('should isolate observation data between sessions', async () => {
      const SESSION_B = 'sess-002';
      svc.initSession(SESSION_B, ANCHORS);

      svc.addSystemEvent(SESSION, 's1', '小明', 'join', {}, '加入A');
      svc.addSystemEvent(SESSION_B, 's2', '小红', 'join', {}, '加入B');

      expect(svc.getStudentLogs(SESSION)).toHaveLength(1);
      expect(svc.getStudentLogs(SESSION_B)).toHaveLength(1);
      expect(svc.getStudentLogs(SESSION)[0].studentName).toBe('小明');
      expect(svc.getStudentLogs(SESSION_B)[0].studentName).toBe('小红');

      // Cleanup B shouldn't affect A
      await svc.cleanupSession(SESSION_B);
      expect(svc.getStudentLogs(SESSION)).toHaveLength(1);
      expect(svc.getStudentLogs(SESSION_B)).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────
  // 9. DB persistence via cleanupSession
  // ─────────────────────────────────────────────

  describe('cleanupSession persistence', () => {
    it('should persist in-memory events to DB on cleanup', async () => {
      svc.addSystemEvent(SESSION, 's1', '小明', 'join', {}, '加入');
      const log = svc.getStudentLogs(SESSION)[0];
      log.events.push({
        id: 'e2', timestamp: Date.now(), updatedAt: Date.now(),
        anchors: ['K1'], gist: 'LLM观察', quote: '原文引用', source: 'llm',
      });

      await svc.cleanupSession(SESSION);

      // In-memory should be cleared
      expect(svc.getStudentLogs(SESSION)).toEqual([]);

      // DB should have the events
      const dbEvents = await eventRepo.find({ where: { sessionId: SESSION } });
      // The system event (join) was fire-and-forget persisted already;
      // cleanupSession persists any that weren't yet saved.
      // The LLM event (e2) was only in memory, so it should now be in DB.
      const llmEvent = dbEvents.find(e => e.eventId === 'e2');
      expect(llmEvent).toBeDefined();
      expect(llmEvent!.gist).toBe('LLM观察');
      expect(llmEvent!.quote).toBe('原文引用');
      expect(llmEvent!.anchors).toEqual(['K1']);
      expect(llmEvent!.source).toBe('llm');
    });
  });

  // ─────────────────────────────────────────────
  // 10. Phase 1+2 — event pipeline & state derivation
  // ─────────────────────────────────────────────

  describe('addSystemEvent persistence (Phase 1)', () => {
    it('should persist event to DB synchronously (await)', async () => {
      await svc.addSystemEvent(SESSION, 'stu-1', '小明', 'join', {}, '小明 加入课堂');

      // DB should have the event immediately after await
      const dbEvents = await eventRepo.find({ where: { sessionId: SESSION, studentId: 'stu-1' } });
      expect(dbEvents).toHaveLength(1);
      expect(dbEvents[0].eventId).toBe('e1');
      expect(dbEvents[0].gist).toBe('小明 加入课堂');
      expect(dbEvents[0].source).toBe('system');
      expect(dbEvents[0].systemType).toBe('join');
    });
  });

  describe('deriveStatus with K-indicator awareness (Phase 2)', () => {
    it('should return active when K-indicators outweigh single M-indicator', () => {
      svc.addSystemEvent(SESSION, 'stu-1', '小明', 'join', {}, '加入');
      const log = svc.getStudentLogs(SESSION)[0];
      const now = Date.now();
      // 1 misconception
      log.events.push({
        id: 'e2', timestamp: now, updatedAt: now,
        anchors: ['M1'], gist: '误解信号', quote: null, source: 'llm',
      });
      // 3 knowledge events (>= PROGRESS_ANCHOR_MIN=2, > misconceptions=1)
      for (let i = 0; i < 3; i++) {
        log.events.push({
          id: `k${i}`, timestamp: now, updatedAt: now,
          anchors: ['K1'], gist: `理解 ${i}`, quote: null, source: 'llm',
        });
      }
      // K=3 > M=1 and K >= PROGRESS_ANCHOR_MIN → active instead of struggling
      expect(svc.deriveStatus(log)).toBe('active');
    });

    it('should return struggling when mixed K+M but K does not outweigh', () => {
      svc.addSystemEvent(SESSION, 'stu-1', '小明', 'join', {}, '加入');
      const log = svc.getStudentLogs(SESSION)[0];
      const now = Date.now();
      // 2 misconceptions
      log.events.push({
        id: 'e2', timestamp: now, updatedAt: now,
        anchors: ['M1'], gist: '误解1', quote: null, source: 'llm',
      });
      log.events.push({
        id: 'e3', timestamp: now, updatedAt: now,
        anchors: ['M2'], gist: '误解2', quote: null, source: 'llm',
      });
      // 1 knowledge event (< PROGRESS_ANCHOR_MIN)
      log.events.push({
        id: 'k1', timestamp: now, updatedAt: now,
        anchors: ['K1'], gist: '理解1', quote: null, source: 'llm',
      });
      // K=1 < PROGRESS_ANCHOR_MIN=2 → still struggling
      expect(svc.deriveStatus(log)).toBe('struggling');
    });

    it('should downgrade stuck to struggling when K-anchors outweigh 3+ M-anchors', () => {
      svc.addSystemEvent(SESSION, 'stu-1', '小明', 'join', {}, '加入');
      const log = svc.getStudentLogs(SESSION)[0];
      const now = Date.now();
      // 3 misconceptions (would normally be stuck)
      for (let i = 0; i < 3; i++) {
        log.events.push({
          id: `m${i}`, timestamp: now, updatedAt: now,
          anchors: ['M1'], gist: `误解 ${i}`, quote: null, source: 'llm',
        });
      }
      // 4 knowledge events (>= PROGRESS_ANCHOR_MIN=2, K=4 > M=3)
      for (let i = 0; i < 4; i++) {
        log.events.push({
          id: `k${i}`, timestamp: now, updatedAt: now,
          anchors: ['K1'], gist: `理解 ${i}`, quote: null, source: 'llm',
        });
      }
      // Normally stuck (3 M events), but K=4 > M=3 → downgraded to struggling
      expect(svc.deriveStatus(log)).toBe('struggling');
    });
  });

  describe('computeIndicatorStats distinct student counting (Phase 2)', () => {
    it('should count distinct students correctly with K and M mixed events', () => {
      // Student A: K1 + M1
      svc.addSystemEvent(SESSION, 'stu-a', 'A', 'join', {}, 'A 加入');
      const logA = svc.getStudentLogs(SESSION).find(l => l.studentId === 'stu-a')!;
      logA.events.push({
        id: 'e2', timestamp: Date.now(), updatedAt: Date.now(),
        anchors: ['K1', 'M1'], gist: 'A mixed', quote: null, source: 'llm',
      });

      // Student B: K1 only
      svc.addSystemEvent(SESSION, 'stu-b', 'B', 'join', {}, 'B 加入');
      const logB = svc.getStudentLogs(SESSION).find(l => l.studentId === 'stu-b')!;
      logB.events.push({
        id: 'e2', timestamp: Date.now(), updatedAt: Date.now(),
        anchors: ['K1'], gist: 'B knowledge', quote: null, source: 'llm',
      });

      // Student C: M1 only
      svc.addSystemEvent(SESSION, 'stu-c', 'C', 'join', {}, 'C 加入');
      const logC = svc.getStudentLogs(SESSION).find(l => l.studentId === 'stu-c')!;
      logC.events.push({
        id: 'e2', timestamp: Date.now(), updatedAt: Date.now(),
        anchors: ['M1'], gist: 'C misconception', quote: null, source: 'llm',
      });

      const stats = svc.computeIndicatorStats(SESSION);
      const k1 = stats.find(s => s.indicatorId === 'K1')!;
      const m1 = stats.find(s => s.indicatorId === 'M1')!;

      expect(k1.studentCount).toBe(2); // A + B
      expect(m1.studentCount).toBe(2); // A + C
      expect(k1.type).toBe('knowledge');
      expect(m1.type).toBe('misconception');
    });
  });

  describe('generateAlerts severity (Phase 2)', () => {
    it('should produce urgent for stuck and warn for struggling in same session', () => {
      // Student A: stuck (3 M events → urgent)
      svc.addSystemEvent(SESSION, 'stu-a', 'A', 'join', {}, 'A 加入');
      const logA = svc.getStudentLogs(SESSION).find(l => l.studentId === 'stu-a')!;
      for (let i = 0; i < 3; i++) {
        logA.events.push({
          id: `ma${i}`, timestamp: Date.now(), updatedAt: Date.now(),
          anchors: ['M1'], gist: `stuck ${i}`, quote: null, source: 'llm',
        });
      }

      // Student B: struggling (1 M event → warn)
      svc.addSystemEvent(SESSION, 'stu-b', 'B', 'join', {}, 'B 加入');
      const logB = svc.getStudentLogs(SESSION).find(l => l.studentId === 'stu-b')!;
      logB.events.push({
        id: 'mb1', timestamp: Date.now(), updatedAt: Date.now(),
        anchors: ['M2'], gist: 'struggling', quote: null, source: 'llm',
      });

      // Student C: active (no alerts)
      svc.addSystemEvent(SESSION, 'stu-c', 'C', 'join', {}, 'C 加入');

      const alerts = svc.generateAlerts(SESSION);
      expect(alerts).toHaveLength(2);
      expect(alerts[0].severity).toBe('urgent');
      expect(alerts[0].studentId).toBe('stu-a');
      expect(alerts[1].severity).toBe('warn');
      expect(alerts[1].studentId).toBe('stu-b');
    });
  });

  // ─────────────────────────────────────────────
  // 11. Edge cases (original)
  // ─────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle addSystemEvent for unknown session (auto-creates log)', () => {
      const unknownSession = 'sess-unknown';
      // No initSession called — addSystemEvent should still work via ensureStudentLog
      svc.addSystemEvent(unknownSession, 's1', '小明', 'join', {}, '加入');
      const logs = svc.getStudentLogs(unknownSession);
      expect(logs).toHaveLength(1);
    });

    it('should return empty alerts for session with no students', () => {
      expect(svc.generateAlerts(SESSION)).toEqual([]);
    });

    it('should handle computeIndicatorStats with empty student list', () => {
      const stats = svc.computeIndicatorStats(SESSION);
      expect(stats).toHaveLength(5);
      expect(stats.every(s => s.studentCount === 0)).toBe(true);
    });

    it('should handle events with multiple anchors in stats computation', () => {
      svc.addSystemEvent(SESSION, 's1', '小明', 'join', {}, '加入');
      const log = svc.getStudentLogs(SESSION)[0];
      log.events.push({
        id: 'e2', timestamp: Date.now(), updatedAt: Date.now(),
        anchors: ['K1', 'K2', 'M1'], gist: '复杂事件', quote: null, source: 'llm',
      });

      const stats = svc.computeIndicatorStats(SESSION);
      expect(stats.find(s => s.indicatorId === 'K1')!.studentCount).toBe(1);
      expect(stats.find(s => s.indicatorId === 'K2')!.studentCount).toBe(1);
      expect(stats.find(s => s.indicatorId === 'M1')!.studentCount).toBe(1);
      expect(stats.find(s => s.indicatorId === 'K3')!.studentCount).toBe(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// observeTurn + callObserverGlm — GLM mock tests
// ═══════════════════════════════════════════════════════════════

describe('ObservationService — observeTurn + GLM', () => {
  let module: TestingModule;
  let svc: ObservationService;
  let eventRepo: Repository<ObservationEvent>;
  let configService: ConfigService;

  const SESSION = 'glm-sess';
  const originalFetch = global.fetch;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [ObservationEvent],
          synchronize: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([ObservationEvent, ClassroomSnapshot]),
      ],
      providers: [ObservationService],
    }).compile();

    svc = module.get(ObservationService);
    eventRepo = module.get(getRepositoryToken(ObservationEvent));
    configService = module.get(ConfigService);
  });

  afterAll(async () => {
    global.fetch = originalFetch;
    await module.close();
  });

  beforeEach(async () => {
    await svc.cleanupSession(SESSION);
    await eventRepo.clear();
    svc.initSession(SESSION, ANCHORS);
    jest.restoreAllMocks();
    global.fetch = originalFetch;
  });

  const TURN = { student: '我觉得scanning就是快速阅读', ai: '对，scanning是一种快速浏览策略' };
  const CTX = { currentStep: '1', exerciseCorrectRate: 80, idleSeconds: 0 };

  it('should return early when no API key', async () => {
    jest.spyOn(configService, 'get').mockReturnValue(undefined);

    svc.addSystemEvent(SESSION, 's1', '小明', 'join', {}, '加入');
    await svc.observeTurn(SESSION, 's1', '小明', TURN, CTX);

    const logs = svc.getStudentLogs(SESSION);
    // Only the join event; no LLM event appended
    expect(logs[0].events).toHaveLength(1);
  });

  it('should return early when indicators are empty', async () => {
    const emptySess = 'empty-indicators';
    svc.initSession(emptySess, []);
    svc.addSystemEvent(emptySess, 's1', '小明', 'join', {}, '加入');

    await svc.observeTurn(emptySess, 's1', '小明', TURN, CTX);

    const logs = svc.getStudentLogs(emptySess);
    expect(logs[0].events).toHaveLength(1);
  });

  it('should handle GLM skip action (no event appended)', async () => {
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'ZHIPU_API_KEY') return 'test-key';
      if (key === 'ZHIPU_OBSERVER_MODEL') return 'glm-4-flash';
      return undefined;
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: JSON.stringify({ action: 'skip', anchors: [], gist: '', quote: null }) } }],
      }),
    });

    svc.addSystemEvent(SESSION, 's1', '小明', 'join', {}, '加入');
    await svc.observeTurn(SESSION, 's1', '小明', TURN, CTX);

    const logs = svc.getStudentLogs(SESSION);
    // Only join event; skip means no new event
    expect(logs[0].events).toHaveLength(1);
    expect(logs[0].systemMetrics.messageCount).toBe(1);
  });

  it('should append event on GLM append action', async () => {
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'ZHIPU_API_KEY') return 'test-key';
      return undefined;
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: JSON.stringify({
          action: 'append',
          anchors: ['K1'],
          gist: '学生理解了scanning策略',
          quote: '我觉得scanning就是快速阅读',
        }) } }],
      }),
    });

    svc.addSystemEvent(SESSION, 's1', '小明', 'join', {}, '加入');
    await svc.observeTurn(SESSION, 's1', '小明', TURN, CTX);

    const logs = svc.getStudentLogs(SESSION);
    expect(logs[0].events).toHaveLength(2); // join + append
    const llmEvent = logs[0].events[1];
    expect(llmEvent.source).toBe('llm');
    expect(llmEvent.anchors).toEqual(['K1']);
    expect(llmEvent.gist).toBe('学生理解了scanning策略');
    expect(llmEvent.quote).toBe('我觉得scanning就是快速阅读');

    // Verify persisted to DB
    const dbEvents = await eventRepo.find({ where: { sessionId: SESSION, studentId: 's1', source: 'llm' } });
    expect(dbEvents).toHaveLength(1);
    expect(dbEvents[0].gist).toBe('学生理解了scanning策略');
  });

  it('should update existing event on GLM update action', async () => {
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'ZHIPU_API_KEY') return 'test-key';
      return undefined;
    });

    // First: add a join event and an LLM event manually
    svc.addSystemEvent(SESSION, 's1', '小明', 'join', {}, '加入');
    const log = svc.getStudentLogs(SESSION)[0];
    log.events.push({
      id: 'e2', timestamp: Date.now(), updatedAt: Date.now(),
      anchors: ['K1'], gist: '初步理解', quote: null, source: 'llm',
    });
    // Also persist e2 to DB so update can find it
    await eventRepo.save(eventRepo.create({
      sessionId: SESSION, studentId: 's1', eventId: 'e2',
      anchors: ['K1'], gist: '初步理解', quote: null,
      source: 'llm', systemType: null, data: null, updatedAt: new Date(),
    }));

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: JSON.stringify({
          action: 'update',
          updateTarget: 'e2',
          anchors: ['K1', 'K2'],
          gist: '深入理解了scanning和文本结构',
          quote: 'scanning就是快速找关键词',
        }) } }],
      }),
    });

    await svc.observeTurn(SESSION, 's1', '小明', TURN, CTX);

    const logs = svc.getStudentLogs(SESSION);
    // Still 2 events (join + updated e2), no new event appended
    expect(logs[0].events).toHaveLength(2);
    const updated = logs[0].events.find(e => e.id === 'e2')!;
    expect(updated.anchors).toEqual(['K1', 'K2']);
    expect(updated.gist).toBe('深入理解了scanning和文本结构');
    expect(updated.quote).toBe('scanning就是快速找关键词');
  });

  it('should handle fetch throwing an error gracefully', async () => {
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'ZHIPU_API_KEY') return 'test-key';
      return undefined;
    });

    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    svc.addSystemEvent(SESSION, 's1', '小明', 'join', {}, '加入');
    // Should not throw
    await svc.observeTurn(SESSION, 's1', '小明', TURN, CTX);

    const logs = svc.getStudentLogs(SESSION);
    expect(logs[0].events).toHaveLength(1); // only join
  });

  it('should handle HTTP non-200 response', async () => {
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'ZHIPU_API_KEY') return 'test-key';
      return undefined;
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve('Rate limit exceeded'),
    });

    svc.addSystemEvent(SESSION, 's1', '小明', 'join', {}, '加入');
    await svc.observeTurn(SESSION, 's1', '小明', TURN, CTX);

    const logs = svc.getStudentLogs(SESSION);
    expect(logs[0].events).toHaveLength(1); // only join
  });

  it('should handle response with no content', async () => {
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'ZHIPU_API_KEY') return 'test-key';
      return undefined;
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: {} }] }),
    });

    svc.addSystemEvent(SESSION, 's1', '小明', 'join', {}, '加入');
    await svc.observeTurn(SESSION, 's1', '小明', TURN, CTX);

    const logs = svc.getStudentLogs(SESSION);
    expect(logs[0].events).toHaveLength(1); // only join
  });

  it('should include (empty) in prompt when existingEvents is empty', async () => {
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'ZHIPU_API_KEY') return 'test-key';
      return undefined;
    });

    const fetchSpy = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: JSON.stringify({ action: 'skip', anchors: [], gist: '', quote: null }) } }],
      }),
    });
    global.fetch = fetchSpy;

    // Do NOT add any events before observeTurn (ensureStudentLog creates empty log)
    await svc.observeTurn(SESSION, 's1', '小明', TURN, CTX);

    // Verify fetch was called with (empty) in the prompt
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    const systemMsg = body.messages[0].content;
    expect(systemMsg).toContain('(empty)');
  });
});
