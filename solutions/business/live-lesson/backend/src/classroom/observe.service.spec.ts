import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ObserveService } from './observe.service';
import { Student } from '../entities/student.entity';
import { Submission } from '../entities/submission.entity';
import { ChatMessage } from '../entities/chat-message.entity';

// ── Factory helpers ──

let seq = 0;
function makeStudent(sessionId: string, overrides?: Partial<Student>): Student {
  const s = new Student();
  s.id = overrides?.id ?? `stu-${++seq}`;
  s.sessionId = sessionId;
  s.name = overrides?.name ?? `S${seq}`;
  s.lessonId = 'L1';
  s.currentTask = 1;
  s.currentPhase = 'practice';
  s.joinedAt = overrides?.joinedAt ?? new Date();
  return s;
}

function makeMcSub(
  studentId: string, sessionId: string, step: number,
  answers: number[], scoreTotal: number,
  extra?: { answerChanges?: any[]; questionTimes?: Record<number, number> },
): Submission {
  const s = new Submission();
  s.studentId = studentId; s.sessionId = sessionId; s.step = step; s.lessonId = 'L1';
  s.dataJson = { answers, ...extra };
  s.scoreJson = { total: scoreTotal };
  return s;
}

function makeEvSub(
  studentId: string, sessionId: string, step: number,
  sections: Record<string, { function: string; picked: string[]; attempts?: number }>,
): Submission {
  const s = new Submission();
  s.studentId = studentId; s.sessionId = sessionId; s.step = step; s.lessonId = 'L1';
  s.dataJson = { sections };
  s.scoreJson = null;
  return s;
}

function makeMapSub(
  studentId: string, sessionId: string, step: number,
  placements: Record<string, [number, number]>,
  reasons?: Record<string, string>,
): Submission {
  const s = new Submission();
  s.studentId = studentId; s.sessionId = sessionId; s.step = step; s.lessonId = 'L1';
  s.dataJson = { placements, ...(reasons ? { reasons } : {}) };
  s.scoreJson = null;
  return s;
}

function buildSubsMap(...subs: Submission[]): Map<string, Record<number, Submission>> {
  const m = new Map<string, Record<number, Submission>>();
  for (const sub of subs) {
    if (!m.has(sub.studentId)) m.set(sub.studentId, {});
    m.get(sub.studentId)![sub.step] = sub;
  }
  return m;
}

// ── Answer keys ──

const MC_KEY = {
  answers: [
    { correct: 1, options: ['A', 'B', 'C', 'D'], questionText: 'Q1' },
    { correct: 0, options: ['X', 'Y', 'Z'], questionText: 'Q2' },
  ],
};

const EV_KEY = {
  sections: [
    { id: 'sec1', label: 'S1', correctFunction: 'cause-effect' },
    { id: 'sec2', label: 'S2', correctFunction: 'compare-contrast' },
  ],
  paragraphTokens: {
    sec1: [
      { t: 'rain', kind: 'key', paraId: 'sec1', idx: 0 },
      { t: 'fell', kind: 'neutral', paraId: 'sec1', idx: 1 },
    ],
    sec2: [{ t: 'sun', kind: 'key', paraId: 'sec2', idx: 0 }],
  },
};

const MAP_KEY = {
  items: [{ id: 'i1', label: 'I1' }, { id: 'i2', label: 'I2' }],
  expected: { i1: [3, 4] as [number, number], i2: [1, 2] as [number, number] },
  axes: { x: { neg: 'L', pos: 'R', label: 'X' }, y: { neg: 'B', pos: 'T', label: 'Y' } },
};

// ── Tests ──

describe('ObserveService', () => {
  let module: TestingModule;
  let service: ObserveService;
  let studentRepo: Repository<Student>;
  let subRepo: Repository<Submission>;
  let chatRepo: Repository<ChatMessage>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [Student, Submission, ChatMessage],
          synchronize: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([Student, Submission, ChatMessage]),
      ],
      providers: [ObserveService],
    }).compile();

    service = module.get(ObserveService);
    studentRepo = module.get(getRepositoryToken(Student));
    subRepo = module.get(getRepositoryToken(Submission));
    chatRepo = module.get(getRepositoryToken(ChatMessage));
  });

  afterAll(() => module.close());

  // ── loadObserveData ──

  describe('loadObserveData', () => {
    it('returns students ordered by joinedAt ASC', async () => {
      const sid = 'load-order';
      const late = await studentRepo.save(studentRepo.create({
        sessionId: sid, lessonId: 'L1', name: 'Late', currentTask: 1, currentPhase: 'p',
      }));
      await studentRepo.save(studentRepo.create({
        sessionId: sid, lessonId: 'L1', name: 'Early', currentTask: 1, currentPhase: 'p',
      }));
      await studentRepo.query(
        `UPDATE reading_students SET joined_at = datetime('now', '+1 hour') WHERE id = ?`, [late.id],
      );

      const { students } = await service.loadObserveData(sid);
      expect(students).toHaveLength(2);
      expect(students[0].name).toBe('Early');
      expect(students[1].name).toBe('Late');
    });

    it('builds subsByStudent map: studentId → { [step]: Submission }', async () => {
      const sid = 'load-map';
      const s = await studentRepo.save(studentRepo.create({
        sessionId: sid, lessonId: 'L1', name: 'A', currentTask: 1, currentPhase: 'p',
      }));
      await subRepo.save(subRepo.create({
        sessionId: sid, studentId: s.id, lessonId: 'L1', step: 1,
        dataJson: { answers: [0] }, scoreJson: { total: 50 },
      }));
      await subRepo.save(subRepo.create({
        sessionId: sid, studentId: s.id, lessonId: 'L1', step: 2,
        dataJson: { answers: [1] }, scoreJson: { total: 100 },
      }));

      const { subsByStudent } = await service.loadObserveData(sid);
      expect(subsByStudent.size).toBe(1);
      const map = subsByStudent.get(s.id)!;
      expect(map[1].scoreJson).toEqual({ total: 50 });
      expect(map[2].scoreJson).toEqual({ total: 100 });
    });
  });

  // ── computeMcObserve ──

  describe('computeMcObserve', () => {
    const STEP = 1;

    it('empty class → all stats zero', () => {
      const r = service.computeMcObserve([], new Map(), STEP, MC_KEY);
      expect(r.stats).toEqual({ totalStudents: 0, submitted: 0, avgScore: 0, perfectCount: 0, zeroCount: 0, avgTime: 0, fastestTime: 0, slowestTime: 0 });
      expect(r.students).toEqual([]);
      expect(r.misconceptions).toEqual([]);
    });

    it('3 students, 2 questions → stats correct', () => {
      const [sA, sB, sC] = ['mc-a', 'mc-b', 'mc-c'].map(id => makeStudent('s1', { id, name: id }));
      const subs = buildSubsMap(
        makeMcSub('mc-a', 's1', STEP, [1, 0], 100, { questionTimes: { 0: 10, 1: 20 } }),
        makeMcSub('mc-b', 's1', STEP, [0, 0], 50, { questionTimes: { 0: 15, 1: 15 } }),
        makeMcSub('mc-c', 's1', STEP, [1, 1], 50),
      );
      const r = service.computeMcObserve([sA, sB, sC], subs, STEP, MC_KEY);
      expect(r.stats.totalStudents).toBe(3);
      expect(r.stats.submitted).toBe(3);
      expect(r.stats.avgScore).toBeCloseTo(200 / 3);
      expect(r.stats.perfectCount).toBe(1);
      expect(r.stats.zeroCount).toBe(0);
      expect(r.stats.avgTime).toBe(30); // (30+30)/2, C has no time
    });

    it('question distribution counts and percentages', () => {
      const [sA, sB] = ['qd-a', 'qd-b'].map(id => makeStudent('s1', { id, name: id }));
      const subs = buildSubsMap(
        makeMcSub('qd-a', 's1', STEP, [1, 0], 100),
        makeMcSub('qd-b', 's1', STEP, [0, 0], 50),
      );
      const r = service.computeMcObserve([sA, sB], subs, STEP, MC_KEY);
      // Q1 correct=1: A→1, B→0 → dist[0]=1 dist[1]=1 → correctRate=50%
      expect(r.questions[0].distribution[0].count).toBe(1);
      expect(r.questions[0].distribution[1].count).toBe(1);
      expect(r.questions[0].correctRate).toBe(50);
      // Q2 correct=0: both→0 → correctRate=100%
      expect(r.questions[1].correctRate).toBe(100);
    });

    it('misconception ≥3 same wrong option; severity=high when ≥5', () => {
      const students = Array.from({ length: 5 }, (_, i) => makeStudent('s1', { id: `mis-${i}`, name: `S${i}` }));
      const subs = buildSubsMap(...students.map(s => makeMcSub(s.id, 's1', STEP, [0, 0], 50)));
      const r = service.computeMcObserve(students, subs, STEP, MC_KEY);
      const mc = r.misconceptions.find(m => m.id === 'q0_opt0');
      expect(mc).toBeDefined();
      expect(mc!.count).toBe(5);
      expect(mc!.severity).toBe('high');
    });

    it('misconception severity=medium when count 3–4', () => {
      const students = Array.from({ length: 3 }, (_, i) => makeStudent('s1', { id: `med-${i}`, name: `S${i}` }));
      const subs = buildSubsMap(...students.map(s => makeMcSub(s.id, 's1', STEP, [0, 0], 50)));
      const r = service.computeMcObserve(students, subs, STEP, MC_KEY);
      const mc = r.misconceptions.find(m => m.id === 'q0_opt0');
      expect(mc!.severity).toBe('medium');
    });

    it('student with no submission → skipped in results', () => {
      const sA = makeStudent('s1', { id: 'no-sub', name: 'NoSub' });
      const r = service.computeMcObserve([sA], new Map(), STEP, MC_KEY);
      expect(r.stats.totalStudents).toBe(1);
      expect(r.stats.submitted).toBe(0);
      expect(r.students).toHaveLength(0);
    });

    it('answer change tracking → changed: true in per-Q answers', () => {
      const sA = makeStudent('s1', { id: 'chg', name: 'Chg' });
      const subs = buildSubsMap(
        makeMcSub('chg', 's1', STEP, [1, 0], 100, { answerChanges: [{ qi: 0, from: 0, to: 1 }] }),
      );
      const r = service.computeMcObserve([sA], subs, STEP, MC_KEY);
      expect(r.students[0].answers['0'].changed).toBe(true);
      expect(r.students[0].answers['1'].changed).toBe(false);
    });

    it('keyInsights: wrong count + change count', () => {
      const sA = makeStudent('s1', { id: 'ins', name: 'Ins' });
      const subs = buildSubsMap(
        makeMcSub('ins', 's1', STEP, [0, 1], 0, { answerChanges: [{ qi: 0, from: 1, to: 0 }] }),
      );
      const r = service.computeMcObserve([sA], subs, STEP, MC_KEY);
      expect(r.students[0].keyInsights).toContain('2 题答错');
      expect(r.students[0].keyInsights).toContain('改过 1 次答案');
    });
  });

  // ── computeEvidenceObserve ──

  describe('computeEvidenceObserve', () => {
    const STEP = 2;

    it('empty class → stats zero', () => {
      const r = service.computeEvidenceObserve([], new Map(), STEP, EV_KEY);
      expect(r.stats.totalStudents).toBe(0);
      expect(r.stats.allDone).toBe(0);
      expect(r.stats.funcWrongCount).toBe(0);
    });

    it('2 students, 2 sections → funcCorrectRate, evidenceHitRate', () => {
      const [sA, sB] = ['ev-a', 'ev-b'].map(id => makeStudent('s1', { id, name: id }));
      const subs = buildSubsMap(
        makeEvSub('ev-a', 's1', STEP, {
          sec1: { function: 'cause-effect', picked: ['sec1:0'] },
          sec2: { function: 'compare-contrast', picked: ['sec2:0'] },
        }),
        makeEvSub('ev-b', 's1', STEP, {
          sec1: { function: 'cause-effect', picked: [] },
          sec2: { function: 'cause-effect', picked: [] }, // wrong func
        }),
      );
      const r = service.computeEvidenceObserve([sA, sB], subs, STEP, EV_KEY);
      expect(r.stats.allDone).toBe(2);
      expect(r.sections[0].funcCorrectRate).toBe(100); // sec1: 2/2
      expect(r.sections[1].funcCorrectRate).toBe(50);  // sec2: 1/2
      expect(r.stats.evidenceHitRate).toBe(50); // A:2/2 + B:0/2 = 2/4
    });

    it('funcWrongCount counts unique students not sections (M3 regression)', () => {
      const sA = makeStudent('s1', { id: 'fw', name: 'A' });
      const subs = buildSubsMap(
        makeEvSub('fw', 's1', STEP, {
          sec1: { function: 'WRONG', picked: [] },
          sec2: { function: 'WRONG', picked: [] },
        }),
      );
      const r = service.computeEvidenceObserve([sA], subs, STEP, EV_KEY);
      expect(r.stats.funcWrongCount).toBe(1); // 1 student, not 2 sections
    });

    it('student missing a section → completed:false', () => {
      const sA = makeStudent('s1', { id: 'miss', name: 'A' });
      const subs = buildSubsMap(
        makeEvSub('miss', 's1', STEP, { sec1: { function: 'cause-effect', picked: ['sec1:0'] } }),
      );
      const r = service.computeEvidenceObserve([sA], subs, STEP, EV_KEY);
      expect(r.students[0].completed).toBe(false);
      expect(r.stats.perfectAll).toBe(0);
    });

    it('per-section missed array for missed tokens', () => {
      const sA = makeStudent('s1', { id: 'mst', name: 'A' });
      const subs = buildSubsMap(
        makeEvSub('mst', 's1', STEP, {
          sec1: { function: 'cause-effect', picked: [] },
          sec2: { function: 'compare-contrast', picked: ['sec2:0'] },
        }),
      );
      const r = service.computeEvidenceObserve([sA], subs, STEP, EV_KEY);
      expect(r.students[0].sections['sec1'].missed).toContain('rain');
    });
  });

  // ── computeMapObserve ──

  describe('computeMapObserve', () => {
    const STEP = 3;

    it('empty class → stats zero', () => {
      const r = service.computeMapObserve([], new Map(), STEP, MAP_KEY);
      expect(r.stats).toEqual({ totalStudents: 0, submitted: 0, avgDeviation: 0, reasonedCount: 0 });
    });

    it('2 students → avgDeviation = Euclidean distance average', () => {
      // expected: i1=[3,4], i2=[1,2]
      // A: i1@[0,0]→dev=5, i2@[1,2]→dev=0 → avg=2.5
      // B: i1@[3,4]→dev=0, i2@[4,6]→dev=5 → avg=2.5
      const [sA, sB] = ['mp-a', 'mp-b'].map(id => makeStudent('s1', { id, name: id }));
      const subs = buildSubsMap(
        makeMapSub('mp-a', 's1', STEP, { i1: [0, 0], i2: [1, 2] }),
        makeMapSub('mp-b', 's1', STEP, { i1: [3, 4], i2: [4, 6] }),
      );
      const r = service.computeMapObserve([sA, sB], subs, STEP, MAP_KEY);
      expect(r.stats.submitted).toBe(2);
      expect(r.stats.avgDeviation).toBeCloseTo(2.5);
      expect(r.students[0].avgDeviation).toBeCloseTo(2.5);
    });

    it('student with reasoning → reasoned:true, counted in reasonedCount', () => {
      const sA = makeStudent('s1', { id: 'rsn', name: 'A' });
      const subs = buildSubsMap(makeMapSub('rsn', 's1', STEP, { i1: [3, 4] }, { i1: 'Because it fits' }));
      const r = service.computeMapObserve([sA], subs, STEP, MAP_KEY);
      expect(r.students[0].reasoned).toBe(true);
      expect(r.stats.reasonedCount).toBe(1);
    });

    it('deviation > 2 → keyInsight "偏差较大"', () => {
      const sA = makeStudent('s1', { id: 'dev', name: 'A' });
      const subs = buildSubsMap(makeMapSub('dev', 's1', STEP, { i1: [0, 0] })); // dev=5
      const r = service.computeMapObserve([sA], subs, STEP, MAP_KEY);
      expect(r.students[0].keyInsights).toContain('偏差较大');
    });
  });

  // ── computeDiscussObserve ──

  describe('computeDiscussObserve', () => {
    const STEP = 4;

    async function insertChat(
      sessionId: string, studentId: string, step: number,
      role: string, content: string, seq: number, createdAt: Date,
    ): Promise<void> {
      await chatRepo.query(
        `INSERT INTO chat_messages (session_id, student_id, thread_id, role, content, seq, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [sessionId, studentId, `discuss:${step}`, role, content, seq, createdAt.toISOString()],
      );
    }

    it('no messages → stats zero, empty students', async () => {
      const sA = makeStudent('empty-d', { id: 'disc-none', name: 'A' });
      const r = await service.computeDiscussObserve('empty-d', [sA], STEP);
      expect(r.stats.discussedCount).toBe(0);
      expect(r.stats.goalReachedCount).toBe(0);
      expect(r.students).toEqual([]);
    });

    it('2 students → discussedCount, avgRounds, avgTime', async () => {
      const sid = 'disc-2s';
      const [sA, sB] = ['disc-a', 'disc-b'].map(id => makeStudent(sid, { id, name: id }));
      const t0 = new Date('2024-01-01T10:00:00Z');
      const t1 = new Date('2024-01-01T10:00:30Z');
      const t2 = new Date('2024-01-01T10:01:00Z');
      // A: 2 user msgs → rounds=2, time=60s
      await insertChat(sid, 'disc-a', STEP, 'user', 'Hello', 1, t0);
      await insertChat(sid, 'disc-a', STEP, 'assistant', 'Hi', 2, t1);
      await insertChat(sid, 'disc-a', STEP, 'user', 'More', 3, t2);
      // B: 1 user msg → rounds=1, time=30s
      await insertChat(sid, 'disc-b', STEP, 'user', 'Hey', 1, t0);
      await insertChat(sid, 'disc-b', STEP, 'assistant', 'What', 2, t1);

      const r = await service.computeDiscussObserve(sid, [sA, sB], STEP);
      expect(r.stats.discussedCount).toBe(2);
      expect(r.stats.avgRounds).toBe(1.5);
      expect(r.stats.avgTime).toBe(45); // (60+30)/2
    });

    it('last message "goal_reached" → goalReached:true', async () => {
      const sid = 'disc-goal';
      const sA = makeStudent(sid, { id: 'disc-g', name: 'A' });
      const t0 = new Date('2024-01-01T10:00:00Z');
      const t1 = new Date('2024-01-01T10:00:30Z');
      await insertChat(sid, 'disc-g', STEP, 'user', 'I think so', 1, t0);
      await insertChat(sid, 'disc-g', STEP, 'assistant', 'Correct! goal_reached', 2, t1);

      const r = await service.computeDiscussObserve(sid, [sA], STEP);
      expect(r.students[0].goalReached).toBe(true);
      expect(r.stats.goalReachedCount).toBe(1);
    });

    it('conversation maps user→student, assistant→ai', async () => {
      const sid = 'disc-roles';
      const sA = makeStudent(sid, { id: 'disc-r', name: 'A' });
      const t0 = new Date('2024-01-01T10:00:00Z');
      await insertChat(sid, 'disc-r', STEP, 'user', 'Hello', 1, t0);
      await insertChat(sid, 'disc-r', STEP, 'assistant', 'Hi', 2, t0);

      const r = await service.computeDiscussObserve(sid, [sA], STEP);
      expect(r.students[0].conversation[0].role).toBe('student');
      expect(r.students[0].conversation[1].role).toBe('ai');
    });
  });

  // ── computeMatrixObserve ──

  describe('computeMatrixObserve', () => {
    const STEP = 5;
    const MATRIX_KEY = {
      answers: [
        { rowIdx: 0, place: 'Demo Row', isDemo: true, practice: 'demo', reason: 'demo reason' },
        { rowIdx: 1, place: 'Row 1', whatPrompt: 'What happened?', paraRef: [1, 2] },
        { rowIdx: 2, place: 'Row 2', whatPrompt: 'What next?' },
      ],
    };

    function makeMatrixSub(
      studentId: string, sessionId: string, step: number,
      rows: Array<Record<string, string>>,
      cellQualities?: Record<string, { whatQ: number; whyQ: number }>,
    ): Submission {
      const s = new Submission();
      s.studentId = studentId; s.sessionId = sessionId; s.step = step; s.lessonId = 'L1';
      s.dataJson = { rows };
      s.scoreJson = cellQualities ? { cellQualities } : null;
      return s;
    }

    it('empty class → stats zero', () => {
      const r = service.computeMatrixObserve([], new Map(), STEP, MATRIX_KEY);
      expect(r.stats).toEqual({
        totalStudents: 0, submitted: 0, avgCompletion: 0,
        avgQuality: 0, whatAvg: 0, whyAvg: 0, needAttention: 0,
      });
      expect(r.rows).toHaveLength(2); // only practice rows
      expect(r.students).toEqual([]);
      expect(r.patterns).toEqual([]);
    });

    it('filters out demo rows from practice rows', () => {
      const r = service.computeMatrixObserve([], new Map(), STEP, MATRIX_KEY);
      expect(r.rows.every(row => row.id !== '0')).toBe(true);
      expect(r.rows[0].id).toBe('1');
      expect(r.rows[1].id).toBe('2');
    });

    it('row concept uses whatPrompt when available, falls back to place', () => {
      const r = service.computeMatrixObserve([], new Map(), STEP, MATRIX_KEY);
      expect(r.rows[0].concept).toBe('What happened?');
    });

    it('1 student with full responses → stats and completion', () => {
      const sA = makeStudent('s1', { id: 'mx-a', name: 'Alice' });
      const subs = buildSubsMap(
        makeMatrixSub('mx-a', 's1', STEP, [
          { practice: 'demo', reason: 'demo' },    // row 0 (demo, skipped)
          { practice: 'my what 1', reason: 'my why 1' }, // row 1
          { practice: 'my what 2', reason: 'my why 2' }, // row 2
        ], {
          '1': { whatQ: 3, whyQ: 2 },
          '2': { whatQ: 2, whyQ: 1 },
        }),
      );
      const r = service.computeMatrixObserve([sA], subs, STEP, MATRIX_KEY);
      expect(r.stats.submitted).toBe(1);
      expect(r.stats.avgCompletion).toBe(100); // 4/4 cells filled
      expect(r.stats.avgQuality).toBeGreaterThan(0);
      expect(r.students[0].completion.pct).toBe(100);
      expect(r.students[0].responses['1'].what).toBe('my what 1');
      expect(r.students[0].responses['1'].whatQ).toBe(3);
    });

    it('student with low quality → needAttention and keyInsight', () => {
      const sA = makeStudent('s1', { id: 'mx-low', name: 'Low' });
      const subs = buildSubsMap(
        makeMatrixSub('mx-low', 's1', STEP, [
          {},                              // demo
          { practice: 'x', reason: '' },   // minimal what, no why
          { practice: '', reason: '' },    // empty
        ]),
      );
      const r = service.computeMatrixObserve([sA], subs, STEP, MATRIX_KEY);
      expect(r.stats.needAttention).toBeGreaterThanOrEqual(1);
      expect(r.students[0].keyInsights.length).toBeGreaterThan(0);
    });

    it('student with empty rows → completion < 50% insight', () => {
      const sA = makeStudent('s1', { id: 'mx-emp', name: 'Empty' });
      const subs = buildSubsMap(
        makeMatrixSub('mx-emp', 's1', STEP, [
          {},
          { practice: '', reason: '' },
          { practice: '', reason: '' },
        ]),
      );
      const r = service.computeMatrixObserve([sA], subs, STEP, MATRIX_KEY);
      expect(r.students[0].completion.pct).toBe(0);
      expect(r.students[0].keyInsights).toContain('完成度低于50%');
    });

    it('pattern: why_blank when ≥2 students have ≥30% why empty', () => {
      // 2 practice rows → 1 empty why = 50% ≥ 30%
      const students = ['mx-wb1', 'mx-wb2'].map(id => makeStudent('s1', { id, name: id }));
      const subs = buildSubsMap(
        ...students.map(s => makeMatrixSub(s.id, 's1', STEP, [
          {},
          { practice: 'filled', reason: '' },   // why empty
          { practice: 'filled', reason: 'ok' },  // why filled
        ])),
      );
      const r = service.computeMatrixObserve(students, subs, STEP, MATRIX_KEY);
      const whyBlank = r.patterns.find(p => p.id === 'why_blank');
      expect(whyBlank).toBeDefined();
      expect(whyBlank!.count).toBe(2);
    });

    it('no pattern when only 1 student has why blank', () => {
      const sA = makeStudent('s1', { id: 'mx-solo', name: 'Solo' });
      const subs = buildSubsMap(
        makeMatrixSub('mx-solo', 's1', STEP, [
          {},
          { practice: 'filled', reason: '' },
          { practice: 'filled', reason: '' },
        ]),
      );
      const r = service.computeMatrixObserve([sA], subs, STEP, MATRIX_KEY);
      expect(r.patterns.find(p => p.id === 'why_blank')).toBeUndefined();
    });

    it('per-row paraRef is formatted as comma-separated string', () => {
      const r = service.computeMatrixObserve([], new Map(), STEP, MATRIX_KEY);
      expect(r.rows[0].paraRef).toBe('1, 2');
      expect(r.rows[1].paraRef).toBeUndefined();
    });
  });
});
