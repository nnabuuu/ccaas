import { test, expect, Page } from '@playwright/test';
import { createTestSession, TestSession } from '../helpers/session-factory';
import {
  reportPhase,
  discussComplete,
  getStudentProgress,
  getState,
  endSession,
  setStep,
} from '../helpers/api-client';

// ---------------------------------------------------------------------------
// Helper: SVG buffer for Playwright setInputFiles
// ---------------------------------------------------------------------------
function svgBuffer(text: string) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100">` +
    `<rect width="400" height="100" fill="white"/>` +
    `<text x="200" y="60" text-anchor="middle" font-size="32" fill="black">${escaped}</text>` +
    `</svg>`;
  return {
    name: 'answer.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(svg),
  };
}

// ---------------------------------------------------------------------------
// Dismiss the first-visit StudentGuide modal if it appears
// ---------------------------------------------------------------------------
async function dismissGuideIfPresent(page: Page) {
  const backdrop = page.locator('.sd-guide-backdrop');
  const visible = await backdrop
    .waitFor({ state: 'visible', timeout: 5_000 })
    .then(() => true)
    .catch(() => false);
  if (!visible) return;

  const startBtn = page.locator('.sd-guide-footer button.stu-btn.pri');
  await startBtn.click();
  await backdrop.waitFor({ state: 'hidden', timeout: 3_000 });
}

// ---------------------------------------------------------------------------
// Confirm the listen phase (with try-catch, matching reading-lesson pattern)
// ---------------------------------------------------------------------------
async function confirmListen(page: Page) {
  // Listen phase may use ExampleDemoCard which auto-plays a multi-stage animation
  // (each stage ~1200ms, 5-10 stages). The confirm button only becomes visible
  // after all stages complete (.demo-actions.vis). Use a longer timeout.
  const btn = page.locator('#phase-listen button.stu-btn.pri:not([disabled])');
  await expect(btn).toBeVisible({ timeout: 30_000 });
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
  await page.waitForTimeout(500);
}

// ---------------------------------------------------------------------------
// Navigate to a task using the demo orchestrator postMessage
// ---------------------------------------------------------------------------
async function navigateToTask(page: Page, taskNum: number) {
  await page.evaluate((step) => {
    window.postMessage({ type: 'sync', step }, window.location.origin);
  }, taskNum - 1);
  await page.waitForTimeout(1_000);
}

// ---------------------------------------------------------------------------
// Upload SVG photo and submit for one RCQ part
// ---------------------------------------------------------------------------
async function uploadSvgAndSubmit(page: Page, answerText: string) {
  // Wait for the problem card
  await page.locator('.rcq-problem-card').first().waitFor({ state: 'visible', timeout: 15_000 });

  // Upload SVG via hidden file input (use .first() — multiple file inputs may exist)
  const fileInput = page.locator('input[type="file"][accept="image/*"]').first();
  await fileInput.setInputFiles(svgBuffer(answerText));

  // Wait for photo preview
  await page.locator('.hw-photo-wrap img').first().waitFor({ state: 'visible', timeout: 10_000 });

  // Click submit
  const submitBtn = page.locator('.rcq-submit-btn');
  await submitBtn.waitFor({ state: 'visible', timeout: 5_000 });
  await submitBtn.click();

  // Wait for grading (Vision LLM — can take 10-30s, longer on cold start)
  await page.locator('.rcq-checking-card').waitFor({ state: 'visible', timeout: 10_000 });
  await page.locator('.rcq-checking-card').waitFor({ state: 'hidden', timeout: 60_000 });

  // If multi-part, click next to advance
  const nextBtn = page.locator('.rcq-next-btn');
  if (await nextBtn.isVisible()) {
    await nextBtn.click();
  }
}

// ---------------------------------------------------------------------------
// Complete the guided discovery phase (4 sub-steps)
// ---------------------------------------------------------------------------
async function completeDiscoveryPhase(page: Page) {
  await page.locator('#phase-discovery').waitFor({ state: 'visible', timeout: 10_000 });

  // Helper: fill a GdInputField (keyboard method) — finds first empty blank
  async function fillBlank(value: string) {
    // Click the first empty (unfilled) collapsed blank to expand it.
    // GdInputField uses `.empty` class when no value, `.has-content` when filled.
    const emptyBlank = page.locator(
      '#phase-discovery .math-input-collapsed.empty:not(.active)',
    ).first();
    await emptyBlank.waitFor({ state: 'visible', timeout: 8_000 });
    await emptyBlank.scrollIntoViewIfNeeded();
    await emptyBlank.click();
    // Wait for the expanded panel to render (.25s animation)
    const input = page.locator('#phase-discovery .math-input-field');
    await input.waitFor({ state: 'visible', timeout: 8_000 });
    await input.fill(value);
    // Confirm — click the confirm button inside the currently-expanded panel
    const confirmBtn = page.locator('#phase-discovery .math-input-confirm');
    await confirmBtn.waitFor({ state: 'visible', timeout: 3_000 });
    await confirmBtn.click();
    await page.waitForTimeout(400);
  }

  // Helper: click check button and wait for advance button
  async function checkAndAdvance(advanceText: string) {
    const checkBtn = page.locator('#phase-discovery button.stu-btn.pri:not([disabled])').first();
    await checkBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await checkBtn.click();
    // Wait for server check → advance button appears.
    // Use .last() because completed steps (progressive reveal) keep their advance buttons
    // in the DOM — we want the one from the current (last visible) step.
    const advBtn = page.locator(`#phase-discovery button:has-text("${advanceText}")`).last();
    await advBtn.waitFor({ state: 'visible', timeout: 20_000 });
    await advBtn.click();
    // Wait for entrance animation of next step card (.35s)
    await page.waitForTimeout(500);
  }

  // ── Sub-step 1: observation_choice (auto-checks client-side) ──
  // c1→相同项(0), c2→相反项(1), c3→相同项(0), c4→相反项(1)
  const correctChoices = ['相同项', '相反项', '相同项', '相反项'];
  for (const choiceText of correctChoices) {
    const btn = page.locator(
      `#phase-discovery button:not([disabled]):has-text("${choiceText}")`,
    ).first();
    await btn.waitFor({ state: 'visible', timeout: 5_000 });
    await btn.click();
    await page.waitForTimeout(300);
  }
  // No check button for observation — auto-checks. Click advance directly.
  const obsAdvance = page.locator('#phase-discovery button:has-text("继续下一问")');
  await obsAdvance.waitFor({ state: 'visible', timeout: 5_000 });
  await obsAdvance.click();
  // Wait for formula_blanks step card to animate in
  await page.waitForTimeout(600);

  // ── Sub-step 2: formula_blanks ──
  // f1_left = "(a+b)(a-b)", f1_right = "a^2-b^2"
  await fillBlank('(a+b)(a-b)');
  await fillBlank('a^2-b^2');
  await checkAndAdvance('继续下一问');

  // ── Sub-step 3: derivation_blank ──
  // d1 = "a^2-ab+ab-b^2"
  await fillBlank('a^2-ab+ab-b^2');
  await checkAndAdvance('继续下一问');

  // ── Sub-step 4: text_blanks (plain inputs, no GdInputField) ──
  // blank 1 = "和", blank 2 = "差"
  const textInputs = page.locator('#phase-discovery input[placeholder="___"]');
  await textInputs.first().waitFor({ state: 'visible', timeout: 8_000 });
  await textInputs.nth(0).fill('和');
  await textInputs.nth(1).fill('差');
  // Last step → "查看总结"
  await checkAndAdvance('查看总结');
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------
test.describe('Math Difference-of-Squares Student Walkthrough (Browser)', () => {
  let session: TestSession;
  let code: string;
  let studentId: string;

  test.beforeAll(async () => {
    const result = await createTestSession({
      lessonId: 'math-difference-of-squares',
    });
    session = result.session;
    code = session.code;
  });

  test.afterAll(async () => {
    if (code) await endSession(code).catch(() => {});
  });

  test('complete all 6 steps via browser', async ({ page }) => {
    test.setTimeout(300_000);

    // ── Join via browser ─────────────────────────────────────────────
    await page.goto('/join');
    const codeInput = page.locator('[placeholder="课堂码..."]');
    await codeInput.waitFor({ state: 'visible', timeout: 10_000 });
    await codeInput.fill(code);
    await page.locator('text=✓').waitFor({ state: 'visible', timeout: 10_000 });
    await page.locator('[placeholder="你的姓名..."]').fill('MathStudent');
    await page.locator('button.stu-btn.pri:has-text("加入课堂")').click();
    await page.waitForURL(/\/session\//, { timeout: 15_000 });

    // Extract studentId from localStorage
    const stored = await page.evaluate((c: string) => {
      const raw = localStorage.getItem(`classroom:session:${c}`);
      return raw ? JSON.parse(raw) : null;
    }, code);
    expect(stored).toBeTruthy();
    studentId = stored.studentId;
    expect(studentId).toBeTruthy();

    // ── Dismiss first-visit guide if shown ────────────────────────────
    await dismissGuideIfPresent(page);

    // ── Step 1: 探索发现 (custom 6-phase) ────────────────────────────
    // Student starts at task 1 (no separate step 0 in UI).
    // Phase: listen
    await confirmListen(page);

    // Phase: practice-1 (q1: y²-4)
    await uploadSvgAndSubmit(page, 'y²-4');

    // Phase: practice-2 (q2: 9-a²)
    await uploadSvgAndSubmit(page, '9-a²');

    // Phase: practice-3 (q3: 4a²-b²)
    await uploadSvgAndSubmit(page, '4a²-b²');

    // Phase: discovery (4 guided-discovery sub-steps)
    await completeDiscoveryPhase(page);

    // Phase: takeaway — click continue (auto-advances to task 2)
    const takeawayBtn = page.locator('#phase-takeaway button.stu-btn').first();
    await takeawayBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await takeawayBtn.click();

    // ── Steps 2–6: Standard flow ─────────────────────────────────────

    const standardSteps = [
      {
        taskNum: 2, stepIdx: 2,
        parts: [{ answer: '4m²-9n²' }, { answer: '¼x²-4/9y²' }],
      },
      {
        taskNum: 3, stepIdx: 3,
        parts: [{ answer: '9b²-4a²' }],
      },
      {
        taskNum: 4, stepIdx: 4,
        parts: [{ answer: '①②③⑥' }, { answer: 'C' }],
      },
      {
        taskNum: 5, stepIdx: 5,
        parts: [{ answer: '9m²-4n²' }, { answer: '9b²-16a²' }],
      },
      {
        taskNum: 6, stepIdx: 6,
        parts: [{ answer: 'a²-4' }, { answer: '4x²-y²' }],
      },
    ];

    for (const step of standardSteps) {
      // Teacher advances class step + navigate browser
      await setStep(code, step.stepIdx);
      // Task 2 may auto-advance from takeaway; for 3+ use postMessage
      if (step.taskNum > 2) {
        await navigateToTask(page, step.taskNum);
      } else {
        await page.waitForTimeout(1_000); // wait for auto-advance from step 1
      }

      // Listen → confirm
      await confirmListen(page);

      // Practice — upload SVG for each part
      for (const part of step.parts) {
        await uploadSvgAndSubmit(page, part.answer);
      }

      // Discuss — API shortcut (skip AI conversation)
      let res = await reportPhase(code, studentId, step.taskNum, 'discuss');
      expect(res.status).toBeLessThan(300);
      res = await discussComplete(code, studentId, step.taskNum, 'goal_reached', 1, 30);
      expect(res.status).toBeLessThan(300);

      // Advance server state: takeaway → completed
      res = await reportPhase(code, studentId, step.taskNum, 'takeaway');
      expect(res.status).toBeLessThan(300);
      res = await reportPhase(code, studentId, step.taskNum, 'completed');
      expect(res.status).toBeLessThan(300);
    }

    // ── Verification (API) ───────────────────────────────────────────

    const progressRes = await getStudentProgress(code, studentId, 'submissions');
    expect(progressRes.status).toBe(200);
    const progress = progressRes.data as {
      submissions?: Record<string, unknown>;
    };
    for (let stepIdx = 1; stepIdx <= 6; stepIdx++) {
      expect(
        progress.submissions?.[stepIdx],
        `Expected submission for step ${stepIdx}`,
      ).toBeTruthy();
    }

    const stateRes = await getState(code);
    expect(stateRes.status).toBe(200);
    const state = stateRes.data as {
      students?: Array<{ id: string; currentTask: number; currentPhase: string }>;
    };
    const stu = state.students?.find((s) => s.id === studentId);
    expect(stu, 'Student should be in state').toBeTruthy();
    expect(stu!.currentTask).toBe(6);
    expect(stu!.currentPhase).toBe('completed');
  });
});
