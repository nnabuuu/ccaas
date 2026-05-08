import { test, expect } from '@playwright/test';
import {
  joinStudent,
  submitAnswer,
  reportPhase,
  getState,
  aiDiscuss,
  discussComplete,
  observeStep,
} from '../helpers/api-client';
import { createTestSession, TestStudent } from '../helpers/session-factory';
import { QUIZ_CORRECT_ANSWERS } from '../helpers/constants';

/*
 * Teacher Observe E2E — Exercise Status + Discuss + Clusters
 *
 * Validates the full data pipeline: student action → backend state → teacher API → teacher UI.
 *
 * Setup: 3 students with different quiz answer patterns:
 *   Alice: all correct [1, 2, 1]
 *   Bob: Q1 wrong      [0, 2, 1]
 *   Charlie: Q1+Q2 wrong [0, 0, 1]
 *
 * Tests run sequentially and build on each other's state.
 * Phase progression is forward-only (updatePhase rejects backward moves).
 */
test.describe('Teacher Observe Walkthrough', () => {
  let code: string;
  let sessionId: string;

  const names = ['Alice', 'Bob', 'Charlie'] as const;
  const students: Record<string, string> = {}; // name → studentId

  // Answer patterns: Alice perfect, Bob Q1 wrong, Charlie Q1+Q2 wrong
  const answerSets: Record<string, number[]> = {
    Alice: QUIZ_CORRECT_ANSWERS,
    Bob: [0, QUIZ_CORRECT_ANSWERS[1], QUIZ_CORRECT_ANSWERS[2]],
    Charlie: [0, 0, QUIZ_CORRECT_ANSWERS[2]],
  };

  test.beforeAll(async () => {
    const { session, student } = await createTestSession({ studentName: 'Alice' });
    code = session.code;
    sessionId = session.sessionId;
    students['Alice'] = student!.studentId;

    for (const name of ['Bob', 'Charlie'] as const) {
      const res = await joinStudent(code, name);
      expect(res.status).toBe(201);
      students[name] = (res.data as TestStudent).studentId;
    }

    // Report all to practice phase on task 1
    for (const name of names) {
      await reportPhase(code, students[name], 1, 'practice');
    }

    // Submit quiz answers with different patterns
    for (const name of names) {
      const res = await submitAnswer(code, students[name], 1, { answers: answerSets[name] });
      expect(res.status).toBe(201);
    }
  });

  // ─── Phase 1: Student status correctness (API) ─────────────────────

  test.describe('Phase 1 — Student status', () => {
    test('after quiz submit: students on task 1 show prog with result', async () => {
      const { status, data } = await getState(code);
      expect(status).toBe(200);

      const state = data as any;
      expect(state.students).toHaveLength(3);

      for (const name of names) {
        const stu = state.students.find((s: any) => s.id === students[name]);
        expect(stu).toBeDefined();

        // Students are still on task 1 after submit → status is 'prog', not 'done'
        expect(stu.stepHistory).toBeDefined();
        expect(stu.stepHistory[1]).toBeDefined();
        expect(stu.stepHistory[1].status).toBe('prog');
        expect(stu.stepHistory[1].result).toBeDefined();
      }

      // Alice (perfect) should have 'correct' result
      const alice = state.students.find((s: any) => s.id === students['Alice']);
      expect(alice.stepHistory[1].result).toBe('correct');

      // Charlie (1/3 correct → score ~33) should be 'partial'
      const charlie = state.students.find((s: any) => s.id === students['Charlie']);
      expect(charlie.stepHistory[1].result).toBe('partial');
    });

    test('phase transitions update student status correctly', async () => {
      // Use Charlie for phase transitions (Alice stays on task 1 for Phase 3 discuss)
      // Phase progression is forward-only: can't go backwards.

      // Report Charlie to discuss on task 1 → status becomes 'prog' (still on task 1)
      await reportPhase(code, students['Charlie'], 1, 'discuss');
      let { data } = await getState(code);
      let state = data as any;
      let charlie = state.students.find((s: any) => s.id === students['Charlie']);
      expect(charlie.currentPhase).toBe('discuss');

      // Report Charlie to listen on task 2 → status becomes 'reading'
      await reportPhase(code, students['Charlie'], 2, 'listen');
      ({ data } = await getState(code));
      state = data as any;
      charlie = state.students.find((s: any) => s.id === students['Charlie']);
      expect(charlie.currentPhase).toBe('listen');
      expect(charlie.status).toBe('reading');

      // Now that Charlie moved past task 1, stepHistory[1] should be 'done'
      expect(charlie.stepHistory[1].status).toBe('done');
      expect(charlie.stepHistory[1].result).toBe('partial');

      // Report Charlie to practice on task 2 → status becomes 'prog'
      await reportPhase(code, students['Charlie'], 2, 'practice');
      ({ data } = await getState(code));
      state = data as any;
      charlie = state.students.find((s: any) => s.id === students['Charlie']);
      expect(charlie.currentPhase).toBe('practice');
      expect(charlie.status).toBe('prog');
    });

    test('stepHistory reflects full lifecycle', async () => {
      const { data } = await getState(code);
      const state = data as any;

      // Bob is still on task 1, so stepHistory[1] is 'prog' with result
      const bob = state.students.find((s: any) => s.id === students['Bob']);
      expect(bob.stepHistory[1].status).toBe('prog');
      expect(bob.stepHistory[1].result).toBeDefined();

      // ideal-beauty-reading has 5 tasks; task 3 should be 'future' for Bob
      expect(bob.stepHistory[3]).toBeDefined();
      expect(bob.stepHistory[3].status).toBe('future');

      // Charlie moved to task 2, so stepHistory[1] is 'done', stepHistory[3] is 'future'
      const charlie = state.students.find((s: any) => s.id === students['Charlie']);
      expect(charlie.stepHistory[1].status).toBe('done');
      expect(charlie.stepHistory[3].status).toBe('future');
    });
  });

  // ─── Phase 2: Exercise observe (API-only, no LLM) ─────────────────

  test.describe('Phase 2 — MC observe', () => {
    test('MC observe returns correct stats', async () => {
      const { status, data } = await observeStep(code, 1, 'mc');
      expect(status).toBe(200);

      const obs = data as any;
      expect(obs.stats).toBeDefined();
      expect(obs.stats.totalStudents).toBe(3);
      expect(obs.stats.submitted).toBe(3);
      // Only Alice got all correct
      expect(obs.stats.perfectCount).toBe(1);
    });

    test('MC per-question distribution is correct', async () => {
      const { data } = await observeStep(code, 1, 'mc');
      const obs = data as any;

      expect(obs.questions).toBeDefined();
      expect(obs.questions.length).toBe(3);

      // Q0: correct answer is index 1. Alice chose 1, Bob chose 0, Charlie chose 0
      const q0 = obs.questions[0];
      expect(q0.distribution).toBeDefined();

      // opt-0 picked by Bob+Charlie (2 students)
      expect(q0.distribution[0].count).toBe(2);
      // opt-1 picked by Alice (1 student)
      expect(q0.distribution[1].count).toBe(1);
      // correctRate is a percentage: 1/3 ≈ 33.33%
      expect(q0.correctRate).toBeCloseTo(100 / 3, 0);
    });

    test('getState stepMetrics has completedCount and byDimension', async () => {
      const { data } = await getState(code);
      const state = data as any;

      expect(state.stepMetrics).toBeDefined();
      expect(state.stepMetrics[1]).toBeDefined();

      const m = state.stepMetrics[1];
      expect(m.completedCount).toBe(3);
      expect(m.byDimension).toBeDefined();
      expect(typeof m.avgScore).toBe('number');
    });
  });

  // ─── Phase 3: Discuss observe + clustering (LLM, longer timeout) ──

  test.describe('Phase 3 — Discuss observe + clustering', () => {
    test('discuss rounds persist and observe returns conversation data', async () => {
      test.setTimeout(120_000);

      // Move Alice and Bob to discuss phase (forward from practice)
      await reportPhase(code, students['Alice'], 1, 'discuss');
      await reportPhase(code, students['Bob'], 1, 'discuss');

      // Send 2 discuss rounds for Alice
      await aiDiscuss(code, students['Alice'], 1, [
        { role: 'student', text: 'I think the writer uses two contrasting examples to make readers think about beauty standards.' },
      ], 1, 15);
      await aiDiscuss(code, students['Alice'], 1, [
        { role: 'student', text: 'I think the writer uses two contrasting examples to make readers think about beauty standards.' },
        { role: 'ai', text: 'Good observation! Why do you think the writer chose such different examples?' },
        { role: 'student', text: 'To show that beauty ideals are different across cultures and make us question our assumptions.' },
      ], 2, 30);

      // Send 1 discuss round for Bob
      await aiDiscuss(code, students['Bob'], 1, [
        { role: 'student', text: 'The article compares fat and slim beauty standards.' },
      ], 1, 10);

      // Check discuss observe API
      const { status, data } = await observeStep(code, 1, 'discuss');
      expect(status).toBe(200);

      const obs = data as any;
      expect(obs.stats).toBeDefined();
      expect(obs.stats.discussedCount).toBeGreaterThanOrEqual(2);

      // Find Alice in students list
      const aliceObs = obs.students.find((s: any) => s.id === students['Alice']);
      expect(aliceObs).toBeDefined();
      expect(aliceObs.roundsUsed).toBeGreaterThanOrEqual(2);
      expect(aliceObs.conversation).toBeDefined();
      expect(aliceObs.conversation.length).toBeGreaterThanOrEqual(2);

      // Conversations should have student and ai roles
      const roles = aliceObs.conversation.map((m: any) => m.role);
      expect(roles).toContain('student');
      expect(roles).toContain('ai');
    });

    test('discussComplete is reflected in getState', async () => {
      test.setTimeout(120_000);

      await discussComplete(code, students['Alice'], 1, 'goal_reached', 2, 45);

      const { data } = await getState(code);
      const state = data as any;
      const alice = state.students.find((s: any) => s.id === students['Alice']);

      // discussComplete auto-advances to takeaway phase
      expect(alice.currentPhase).toBe('takeaway');

      // Observe should still have Alice's conversation
      const { data: obsData } = await observeStep(code, 1, 'discuss');
      const obs = obsData as any;
      const aliceObs = obs.students.find((s: any) => s.id === students['Alice']);
      expect(aliceObs).toBeDefined();
      expect(aliceObs.conversation.length).toBeGreaterThanOrEqual(2);
    });

    test('clusterStats shape is valid when clusters exist', async () => {
      test.setTimeout(120_000);

      // Poll for cluster data (async classification may take a few seconds)
      let state: any;
      for (let i = 0; i < 6; i++) {
        const { data } = await getState(code);
        state = data;
        if (state.clusterStats?.[1]?.clusters?.length > 0) break;
        await new Promise(r => setTimeout(r, 2_000));
      }

      // clusterStats keyed by task number
      expect(state.clusterStats).toBeDefined();

      if (state.clusterStats[1]) {
        const cs = state.clusterStats[1];

        // definitions from manifest (c1, c2, c3)
        expect(cs.definitions).toBeDefined();
        expect(cs.definitions.length).toBe(3);
        expect(cs.definitions.map((d: any) => d.id)).toEqual(
          expect.arrayContaining(['c1', 'c2', 'c3']),
        );

        // If clusters have been populated by classifier (LLM-dependent, may be empty)
        if (cs.clusters && cs.clusters.length > 0) {
          for (const cluster of cs.clusters) {
            expect(cluster.clusterId).toBeDefined();
            expect(cluster.observationCount).toBeGreaterThanOrEqual(1);
            expect(cluster.observations).toBeDefined();
            for (const obs of cluster.observations) {
              expect(obs.studentId).toBeDefined();
              expect(obs.evidenceSpans).toBeDefined();
              expect(['active', 'resolved']).toContain(obs.status);
            }
          }
        }
      }
    });
  });

  // ─── Phase 4: Teacher dashboard UI verification (browser) ─────────

  test.describe('Phase 4 — Teacher dashboard UI', () => {
    test('teacher dashboard shows student list with correct names', async ({ page }) => {
      await page.goto(`/session/${sessionId}/watch`);
      await page.waitForSelector('.step-card', { timeout: 10_000 });

      // Student chips use title={name} with truncated visible text
      for (const name of names) {
        await expect(page.locator(`.sdot[title="${name}"]`).first()).toBeVisible({ timeout: 5_000 });
      }
    });

    test('discuss observe class view shows health cards and table', async ({ page }) => {
      // Navigate and wait for observe API response to complete
      const responsePromise = page.waitForResponse(
        resp => resp.url().includes('/observe/discuss') && resp.status() === 200,
      );
      await page.goto(`/session/${sessionId}/watch?observe=discuss&step=1`);
      await responsePromise;

      const layer0 = page.getByTestId('overlay-panel-0');
      await expect(layer0).toBeVisible({ timeout: 10_000 });

      // Wait for health cards to render (data-driven, not fixed delay)
      const firstCard = layer0.locator('.obs-health .hcard').first();
      await expect(firstCard).toBeVisible({ timeout: 10_000 });

      // Health cards should be present (对话达标, 兜底选择题, 平均轮次, etc.)
      const healthCards = layer0.locator('.obs-health .hcard');
      const cardCount = await healthCards.count();
      expect(cardCount).toBeGreaterThanOrEqual(3);

      // Table with discussed students (Alice + Bob had discuss rounds)
      const firstRow = layer0.locator('.obs-table tbody tr').first();
      await expect(firstRow).toBeVisible({ timeout: 10_000 });
      const rowCount = await layer0.locator('.obs-table tbody tr').count();
      expect(rowCount).toBeGreaterThanOrEqual(1);
    });

    test('clicking student row opens detail view with chat bubbles', async ({ page }) => {
      // Navigate and wait for observe API response to complete
      const responsePromise = page.waitForResponse(
        resp => resp.url().includes('/observe/discuss') && resp.status() === 200,
      );
      await page.goto(`/session/${sessionId}/watch?observe=discuss&step=1`);
      await responsePromise;

      const layer0 = page.getByTestId('overlay-panel-0');
      await expect(layer0).toBeVisible({ timeout: 10_000 });

      // Wait for table rows to render
      const studentRow = layer0.locator('.obs-table tbody tr').first();
      await expect(studentRow).toBeVisible({ timeout: 10_000 });
      await studentRow.click();

      // Layer 1 should appear
      const layer1 = page.getByTestId('overlay-panel-1');
      await expect(layer1).toBeVisible({ timeout: 5_000 });

      // Chat bubbles should be present (student + AI messages)
      const firstBubble = layer1.locator('.chat-bubble').first();
      await expect(firstBubble).toBeVisible({ timeout: 5_000 });
      const bubbleCount = await layer1.locator('.chat-bubble').count();
      expect(bubbleCount).toBeGreaterThanOrEqual(2);

      // Stats grid should be visible (轮次/用时/结束方式)
      const statsGrid = layer1.locator('.obs-stats-grid');
      await expect(statsGrid).toBeVisible({ timeout: 3_000 });
    });
  });
});
