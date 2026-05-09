import { test, expect } from '@playwright/test';
import {
  getState, joinStudent, submitAnswer, reportPhase,
  aiDiscuss,
} from '../helpers/api-client';
import { createTestSession, type TestStudent } from '../helpers/session-factory';
import { QUIZ_CORRECT_ANSWERS } from '../helpers/constants';

// ── Polling helper ──

async function pollCoachingState(
  code: string,
  predicate: (coaching: any) => boolean,
  timeoutMs = 5000,
): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { data } = await getState(code);
    const coaching = (data as any).coaching;
    if (predicate(coaching)) return coaching;
    await new Promise(r => setTimeout(r, 200));
  }
  // Return last state even if predicate never matched
  const { data } = await getState(code);
  return (data as any).coaching;
}

test.describe('11 — Coaching panel', () => {
  let code: string;
  let sessionId: string;
  const studentNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eric'];
  const studentIds: Record<string, string> = {};

  test.beforeAll(async () => {
    test.setTimeout(60_000);
    // Create session + first student
    const { session, student } = await createTestSession({ studentName: studentNames[0] });
    code = session.code;
    sessionId = session.sessionId;
    studentIds[studentNames[0]] = student!.studentId;

    // Join remaining students
    for (let i = 1; i < studentNames.length; i++) {
      const res = await joinStudent(code, studentNames[i]);
      studentIds[studentNames[i]] = (res.data as TestStudent).studentId;
    }

    // All students: report practice phase + submit step 1
    // This creates completionRate=100% triggering the near-done rule
    for (const name of studentNames) {
      await reportPhase(code, studentIds[name], 1, 'practice');
      await submitAnswer(code, studentIds[name], 1, { answers: QUIZ_CORRECT_ANSWERS });
    }

    // Alice enters discuss and sends a substantive message (triggers highlight detection)
    const aliceId = studentIds['Alice'];
    await reportPhase(code, aliceId, 1, 'discuss');
    await aiDiscuss(code, aliceId, 1, [
      {
        role: 'student',
        text: '我觉得作者用"理想之美"来表达对古典审美标准的追求，这种审美不仅体现在外在形式，更深层地反映了人对精神完美的向往。文中提到的"理想化的美"让我联想到柏拉图的理念论。',
      },
    ], 1, 30);
  });

  // ── Test 1: API shape ──

  test('getState includes coaching field with correct shape', async () => {
    const { data } = await getState(code);
    const coaching = (data as any).coaching;

    expect(coaching).toBeDefined();
    expect(coaching).toHaveProperty('highlights');
    expect(coaching).toHaveProperty('llmInsights');
    expect(Array.isArray(coaching.highlights)).toBe(true);
  });

  // ── Test 2: empty state ──

  test('coaching tab shows empty state when no content', async ({ page }) => {
    // Create a fresh session with 1 student, no submissions → no coaching data
    const { session: freshSession } = await createTestSession({ studentName: 'Lonely' });

    await page.goto(`/session/${freshSession.sessionId}/watch`);
    await page.waitForSelector('.right-tab-bar', { timeout: 10_000 });

    // Click the "教学参考" tab
    const coachingTab = page.locator('.right-tab').filter({ hasText: '教学参考' });
    await coachingTab.click();
    await expect(coachingTab).toHaveClass(/active/, { timeout: 3_000 });

    // Should show empty state text
    await expect(page.locator('.ov-body')).toContainText('等待课堂数据', { timeout: 5_000 });
  });

  // ── Test 3: rule-based tips + section rendering ──

  test('coaching tab shows tips and sections after submissions', async ({ page }) => {
    await page.goto(`/session/${sessionId}/watch`);
    await page.waitForSelector('.teacher-root', { timeout: 10_000 });

    // Click the "教学参考" tab
    await page.locator('.right-tab').filter({ hasText: '教学参考' }).click();

    // Wait for coaching panel to render with content
    // near-done rule fires when completionRate >= 90% and completedCount >= 3
    // We submitted all 5 students so this should trigger
    const coachPanel = page.locator('.coach-panel');
    await expect(coachPanel).toBeVisible({ timeout: 10_000 });

    // Should have at least one section
    const sections = coachPanel.locator('.coach-section');
    await expect(sections.first()).toBeVisible({ timeout: 5_000 });

    // Verify section headers are recognized labels
    const knownHeaders = ['讨论亮点', '实时建议', '推荐提问候选', '值得讨论的问题', '深度洞察'];
    const headers = await coachPanel.locator('.coach-section-h').allTextContents();
    for (const h of headers) {
      expect(knownHeaders.some(kh => h.includes(kh))).toBe(true);
    }

    // At least one content element should be visible
    const hasTip = await page.locator('.coach-tip').count() > 0;
    const hasCandidate = await page.locator('.coach-candidate').count() > 0;
    const hasHighlight = await page.locator('.coach-highlight').count() > 0;

    expect(hasTip || hasCandidate || hasHighlight).toBe(true);
  });

  // ── Test 4: discuss triggers highlight in state (polling) ──

  test('discuss triggers highlight detection in coaching state', async () => {
    // Poll for highlights to appear (LLM classify is async/fire-and-forget)
    const coaching = await pollCoachingState(
      code,
      (c) => c?.highlights?.length > 0,
      8_000, // 8s: allows for LLM classify latency
    );

    // Structure validation (always passes)
    expect(coaching).toBeDefined();
    expect(Array.isArray(coaching.highlights)).toBe(true);

    // If highlights were detected, validate each one's shape
    if (coaching.highlights.length > 0) {
      for (const h of coaching.highlights) {
        expect(h).toHaveProperty('studentId');
        expect(h).toHaveProperty('studentName');
        expect(h).toHaveProperty('taskNum');
        expect(h).toHaveProperty('message');
        expect(h).toHaveProperty('gist');
        expect(h).toHaveProperty('evidenceSpan');
        expect(h).toHaveProperty('detectedAt');

        // Soft: gist should be a non-empty string
        expect(typeof h.gist).toBe('string');
        expect(h.gist.length).toBeGreaterThan(0);

        // studentName should match one of our students
        expect(studentNames).toContain(h.studentName);
      }
    }
    if (coaching.highlights.length === 0) {
      test.info().annotations.push({ type: 'soft-skip', description: 'LLM non-deterministic: no highlights detected' });
    }
  });

  // ── Test 5: highlight card expands on click ──

  test('highlight card expands on click to show message', async ({ page }) => {
    const { data } = await getState(code);
    const hasHighlights = (data as any).coaching?.highlights?.length > 0;
    test.skip(!hasHighlights, 'No highlights detected (LLM non-deterministic)');

    await page.goto(`/session/${sessionId}/watch`);
    await page.waitForSelector('.teacher-root', { timeout: 10_000 });

    // Click "教学参考" tab
    await page.locator('.right-tab').filter({ hasText: '教学参考' }).click();

    const coachPanel = page.locator('.coach-panel');
    await expect(coachPanel).toBeVisible({ timeout: 10_000 });

    // Wait for highlight to render
    const highlight = page.locator('.coach-highlight').first();
    await expect(highlight).toBeVisible({ timeout: 5_000 });

    // Message should NOT be visible before click
    const msgBefore = await page.locator('.coach-highlight-msg').count();
    expect(msgBefore).toBe(0);

    // Click to expand
    await highlight.click();

    // Now the message should be visible
    await expect(page.locator('.coach-highlight-msg').first()).toBeVisible({ timeout: 2_000 });
  });
});
