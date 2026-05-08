/**
 * Full Student Lesson Walkthrough — Ideal Beauty Reading
 *
 * Teacher actions (create, start session) via API.
 * Student actions (join, navigate, interact with exercises) via Playwright browser.
 * Navigation between tasks via postMessage sync (bypasses discuss/takeaway phases).
 * Screenshots at each major milestone → e2e/screenshots/
 */
import { test, expect, type Page, type Locator } from '@playwright/test';
import { createTestSession } from '../helpers/session-factory';
import { getExercise } from '../helpers/api-client';
import { QUIZ_CORRECT_ANSWERS, LESSON_ID } from '../helpers/constants';
import path from 'path';
import fs from 'fs';

/**
 * React-compatible fill: uses the native value setter + input event dispatch
 * so React's controlled input onChange handler fires correctly.
 * Playwright's fill() sometimes doesn't trigger React's synthetic event system.
 */
async function reactFill(locator: Locator, value: string) {
  await locator.evaluate((el: HTMLInputElement | HTMLTextAreaElement, val: string) => {
    const isTextarea = el.tagName === 'TEXTAREA';
    const proto = isTextarea ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, val);
    else el.value = val;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

const SS = path.join(__dirname, '..', 'screenshots');
const snap = (name: string) => path.join(SS, `${name}.png`);

interface StepReport { step: string; status: string; notes: string }

test.describe('Full Student Lesson Walkthrough', () => {
  let code: string;
  let studentId: string;
  const report: StepReport[] = [];

  test.beforeAll(async () => {
    fs.mkdirSync(SS, { recursive: true });
    const { session } = await createTestSession({ lessonId: LESSON_ID });
    code = session.code;
    console.log(`[WALK] Session code: ${code}`);
  });

  test('walk through Ideal Beauty reading lesson', async ({ page }) => {
    test.setTimeout(300_000); // 5 min

    // ── JOIN ─────────────────────────────────────────────────
    await page.goto('/join');
    await expect(page.getByText('加入课堂')).toBeVisible({ timeout: 15_000 });
    await page.getByPlaceholder('课堂码...').fill(code);
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page.getByPlaceholder('你的姓名...')).toBeVisible({ timeout: 10_000 });
    await page.getByPlaceholder('你的姓名...').fill('Playwright Student');
    await page.getByRole('button', { name: '加入课堂' }).click();
    await page.waitForURL(/\/session\//, { timeout: 15_000 });
    await page.screenshot({ path: snap('00-joined'), fullPage: true });

    // Capture studentId from localStorage for exercise API calls
    studentId = await page.evaluate((c) => {
      const raw = localStorage.getItem(`classroom:session:${c}`);
      return raw ? JSON.parse(raw).studentId : null;
    }, code);
    console.log(`[WALK] Student ID: ${studentId}`);

    report.push({ step: 'Join', status: '\u2713', notes: `Session ${code}` });

    // Student lands directly on Task 1 (Listen phase) for started sessions.

    // ── TASK 1: Predict / Quiz ───────────────────────────────
    await doTask1Quiz(page);

    // Navigate to task 2 via postMessage sync
    await navigateToTask(page, 2);
    await doTask2Evidence(page);

    await navigateToTask(page, 3);
    await doTask3Matrix(page);

    await navigateToTask(page, 4);
    await doTask4Map(page);

    await navigateToTask(page, 5);
    await doTask5Order(page);

    // ── FINAL REPORT ─────────────────────────────────────────
    await page.screenshot({ path: snap('99-final'), fullPage: true });
    const sep = '='.repeat(55);
    console.log(`\n${sep}`);
    console.log('  WALKTHROUGH REPORT');
    console.log(sep);
    report.forEach(r => console.log(`  ${r.status} ${r.step}: ${r.notes}`));
    console.log(sep);
    console.log(`  Screenshots: ${SS}`);
  });

  // ── Navigation helpers ──────────────────────────────────────

  /** Use the demo orchestrator postMessage to switch tasks */
  async function navigateToTask(page: Page, taskNum: number) {
    await page.evaluate((step) => {
      window.postMessage({ type: 'sync', step }, window.location.origin);
    }, taskNum - 1);
    await page.waitForTimeout(1000);
  }

  async function confirmListen(page: Page) {
    const btn = page.locator('#phase-listen button.stu-btn:not([disabled])');
    try {
      await expect(btn).toBeVisible({ timeout: 8_000 });
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
      await page.waitForTimeout(500);
    } catch { /* already confirmed or not present */ }
  }

  async function scrollToPractice(page: Page) {
    const el = page.locator('#phase-practice');
    try {
      await expect(el).toBeVisible({ timeout: 8_000 });
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
    } catch { /* may not exist */ }
  }

  // ── Task implementations ────────────────────────────────────

  async function doTask1Quiz(page: Page) {
    try {
      await confirmListen(page);
      await scrollToPractice(page);

      const firstCard = page.locator('.stu-quiz-card').first();
      await expect(firstCard).toBeVisible({ timeout: 10_000 });
      await page.screenshot({ path: snap('01-task1-quiz'), fullPage: true });

      const cards = page.locator('.stu-quiz-card');
      const count = await cards.count();
      for (let i = 0; i < Math.min(count, QUIZ_CORRECT_ANSWERS.length); i++) {
        const card = cards.nth(i);
        await card.scrollIntoViewIfNeeded();
        await card.locator('.stu-quiz-opt').nth(QUIZ_CORRECT_ANSWERS[i]).click();
        await page.waitForTimeout(300);
      }
      await page.screenshot({ path: snap('01-task1-quiz-selected'), fullPage: true });

      const submitBtn = page.locator('#phase-practice button.stu-btn.pri');
      if (await submitBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await submitBtn.scrollIntoViewIfNeeded();
        await submitBtn.click();
        await page.waitForTimeout(2000);
      }
      await page.screenshot({ path: snap('01-task1-quiz-result'), fullPage: true });

      const correctCount = await page.locator('.stu-quiz-card.correct').count();
      const complete = await page.getByText('Practice complete').isVisible({ timeout: 2_000 }).catch(() => false);
      report.push({
        step: 'Task 1 (Quiz)',
        status: complete ? '\u2713' : '\u26a0',
        notes: `${correctCount}/${count} correct${complete ? ' \u2014 practice complete' : ''}`,
      });
    } catch (e: any) {
      await page.screenshot({ path: snap('01-task1-error'), fullPage: true });
      report.push({ step: 'Task 1 (Quiz)', status: '\u2717', notes: e.message?.slice(0, 120) });
    }
  }

  async function doTask2Evidence(page: Page) {
    try {
      await confirmListen(page);
      await scrollToPractice(page);

      await expect(page.locator('.se-strip')).toBeVisible({ timeout: 10_000 });
      await page.screenshot({ path: snap('02-task2-evidence'), fullPage: true });

      const { data: spec } = await getExercise(code, 2);
      const sections = (spec as any).sections || [];
      let sectionsGraded = 0;

      for (let s = 0; s < sections.length; s++) {
        const section = sections[s];
        const correctFunc = section.correctFunction;
        const paraRange: number[] = section.range || [];

        // Click section tab
        const sTab = page.locator('.se-strip-btn').nth(s);
        if (await sTab.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await sTab.click();
          await page.waitForTimeout(800);
        }

        // Skip already-graded sections
        const doneMarker = await sTab.textContent();
        if (doneMarker?.includes('\u2713')) { sectionsGraded++; continue; }

        // Stage 1 — pick correct function
        const funcBtn = page.locator('.se-func-btn:not(.locked):not(.dim)').filter({ hasText: correctFunc });
        if (await funcBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await funcBtn.click();
          await page.waitForTimeout(300);
          const confirmBtn = page.locator('.se-btn:not(.off)').filter({ hasText: /Confirm/i });
          if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
            await confirmBtn.click();
            await page.waitForTimeout(1000);
          }
        }

        // Stage 2 — select idle evidence tokens ONLY within this section's paragraphs
        // Tokens outside the current section are also .se-tk-idle but clicking them does nothing
        for (const pn of paraRange) {
          const paraTokens = page.locator(`[data-para="p${pn}"] .se-tk.se-tk-idle`);
          const tkCount = await paraTokens.count();
          for (let t = 0; t < tkCount; t++) {
            const tk = paraTokens.nth(t);
            if (await tk.isVisible({ timeout: 300 }).catch(() => false)) {
              await tk.click();
              await page.waitForTimeout(100);
            }
          }
        }

        // Check evidence
        const checkBtn = page.locator('.se-btn:not(.off)').filter({ hasText: /Check evidence/i });
        if (await checkBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await checkBtn.click();
          await page.waitForTimeout(1500);
        }
        await page.screenshot({ path: snap(`02-task2-section${s}`), fullPage: true });

        // Advance to next section (only shown when passed)
        const nextBtn = page.locator('.se-btn').filter({ hasText: /Next section/i });
        if (await nextBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await nextBtn.click();
          await page.waitForTimeout(800);
          sectionsGraded++;
        } else {
          // Last section — check for "All N done" text
          const allDone = await page.locator('.se-action-row').getByText(/All.*done/i).isVisible({ timeout: 2_000 }).catch(() => false);
          if (allDone) sectionsGraded++;
        }
      }

      const complete = await page.getByText('Practice complete').isVisible({ timeout: 5_000 }).catch(() => false);
      report.push({
        step: 'Task 2 (Select-Evidence)',
        status: complete ? '\u2713' : '\u26a0',
        notes: `${sectionsGraded}/${sections.length} sections graded${complete ? ' \u2014 complete' : ''}`,
      });
    } catch (e: any) {
      await page.screenshot({ path: snap('02-task2-error'), fullPage: true });
      report.push({ step: 'Task 2 (Select-Evidence)', status: '\u2717', notes: e.message?.slice(0, 120) });
    }
  }

  async function doTask3Matrix(page: Page) {
    try {
      await confirmListen(page);
      await scrollToPractice(page);

      await expect(page.locator('.stu-mat-wrap')).toBeVisible({ timeout: 10_000 });
      await page.screenshot({ path: snap('03-task3-matrix'), fullPage: true });

      // Fill matrix rows sequentially (rows unlock as previous are filled)
      // Each practice row has 2 inputs (what + why), both need ≥ 3 chars to unlock next row
      let rowsFilled = 0;
      for (let attempt = 0; attempt < 15; attempt++) {
        const inputs = page.locator('input.stu-mat-in:not([disabled])');
        const count = await inputs.count();
        if (count === 0) break;

        let filledAny = false;
        for (let i = 0; i < count; i++) {
          const input = inputs.nth(i);
          const val = await input.inputValue();
          if (val.length >= 3) continue;

          await input.scrollIntoViewIfNeeded();
          const ph = await input.getAttribute('placeholder') || '';
          // Second column is "why" — placeholders vary per row
          const isWhy = i % 2 === 1;
          const value = isWhy
            ? 'Cultural belonging and identity'
            : 'Traditional beauty practice';

          await reactFill(input, value);
          filledAny = true;
          if (isWhy) rowsFilled++;
          await page.waitForTimeout(200);
        }

        if (!filledAny) break;
        // Wait for React to re-render and potentially unlock next row
        await page.waitForTimeout(1000);
      }
      await page.screenshot({ path: snap('03-task3-matrix-filled'), fullPage: true });

      // Submit and wait for server check to complete
      const submitBtn = page.locator('#phase-practice button.stu-btn.pri');
      if (await submitBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await submitBtn.scrollIntoViewIfNeeded();
        await submitBtn.click();
        // Wait for server check: "Checking..." disappears → "Practice complete" or "Try Again"
        await page.waitForFunction(() => {
          const btn = document.querySelector('#phase-practice button.stu-btn.pri');
          const done = document.querySelector('#phase-practice');
          return (done?.textContent?.includes('Practice complete'))
            || (btn?.textContent?.includes('Try Again'))
            || (!btn?.textContent?.includes('Checking'));
        }, { timeout: 30_000 }).catch(() => {});
        await page.waitForTimeout(500);
      }
      await page.screenshot({ path: snap('03-task3-matrix-result'), fullPage: true });

      const complete = await page.getByText('Practice complete').isVisible({ timeout: 2_000 }).catch(() => false);
      report.push({
        step: 'Task 3 (Matrix)',
        status: complete ? '\u2713' : '\u26a0',
        notes: `${rowsFilled} rows filled${complete ? ' \u2014 complete' : ''}`,
      });
    } catch (e: any) {
      await page.screenshot({ path: snap('03-task3-error'), fullPage: true });
      report.push({ step: 'Task 3 (Matrix)', status: '\u2717', notes: e.message?.slice(0, 120) });
    }
  }

  async function doTask4Map(page: Page) {
    try {
      await confirmListen(page);
      await scrollToPractice(page);

      // Wait for coordinate plane (crosshair cursor)
      const plane = page.locator('div[style*="crosshair"]');
      await expect(plane).toBeVisible({ timeout: 10_000 });
      await page.screenshot({ path: snap('04-task4-map'), fullPage: true });

      const planeBox = await plane.boundingBox();
      if (!planeBox) throw new Error('Cannot get plane bounding box');

      // Fetch exercise spec with studentId to get practiceItemIds (randomPractice)
      const { data: mapSpec } = await getExercise(code, 4, studentId);
      const mapItems = (mapSpec as any).mapItems || (mapSpec as any).items || [];
      const practiceItemIds: string[] | undefined = (mapSpec as any).practiceItemIds;

      // Only place chips that are in practiceItemIds (the rest appear pre-placed)
      const practiceItems = practiceItemIds
        ? mapItems.filter((it: any) => practiceItemIds.includes(it.id))
        : mapItems;
      const givenCount = mapItems.length - practiceItems.length;

      const chipLabels: string[] = practiceItems.map((it: any) => it.label);
      console.log(`[MAP] ${chipLabels.length} practice chips (${givenCount} pre-placed): ${chipLabels.join(', ')}`);

      // Verify pre-placed (given) chips are visible on the plane
      if (givenCount > 0) {
        const givenItems = mapItems.filter((it: any) => !practiceItemIds?.includes(it.id));
        for (const gi of givenItems) {
          const givenChip = page.locator('.map-chip-placed, [data-chip-id]').filter({ hasText: gi.label });
          const visible = await givenChip.isVisible({ timeout: 3_000 }).catch(() => false);
          console.log(`[MAP] Pre-placed "${gi.label}": ${visible ? 'visible' : 'not found'}`);
        }
        await page.screenshot({ path: snap('04-task4-map-given'), fullPage: true });
      }

      // Positions spread across the plane quadrants
      const positions = [
        { x: 0.7, y: 0.3 }, { x: 0.3, y: 0.3 },
        { x: 0.7, y: 0.7 }, { x: 0.3, y: 0.7 },
        { x: 0.5, y: 0.2 }, { x: 0.2, y: 0.5 }, { x: 0.8, y: 0.5 },
      ];
      let placed = 0;

      for (let i = 0; i < chipLabels.length; i++) {
        // Find tray chip by its label text
        const chip = page.locator('#phase-practice button').filter({ hasText: chipLabels[i] });
        if (!await chip.isVisible({ timeout: 2_000 }).catch(() => false)) {
          console.log(`[MAP] Chip "${chipLabels[i]}" not visible, skipping`);
          continue;
        }

        // Click chip → sets pendingTrayChip
        await chip.click();
        await page.waitForTimeout(500);

        // Click on the plane → places the chip
        const pos = positions[i % positions.length];
        await plane.click({ position: { x: planeBox.width * pos.x, y: planeBox.height * pos.y } });
        await page.waitForTimeout(500);

        // Fill the newest reason textarea using reactFill for reliable React state updates
        const textareas = page.locator('textarea[placeholder="Why did you place it here?"]');
        const taCount = await textareas.count();
        if (taCount > 0) {
          const lastTa = textareas.nth(taCount - 1);
          await lastTa.scrollIntoViewIfNeeded();
          await reactFill(lastTa, 'This practice reflects deep cultural meaning and identity.');
          await page.waitForTimeout(200);
        }
        placed++;
        console.log(`[MAP] Placed chip ${placed}: "${chipLabels[i]}"`);
      }
      await page.screenshot({ path: snap('04-task4-map-placed'), fullPage: true });

      // Submit and wait for server check (map uses LLM feedback, can be slow)
      const submitBtn = page.locator('#phase-practice button.stu-btn.pri');
      if (await submitBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await submitBtn.scrollIntoViewIfNeeded();
        await submitBtn.click();
        // Wait for server check: "Checking..." disappears → "Practice complete" or "Try Again"
        await page.waitForFunction(() => {
          const btn = document.querySelector('#phase-practice button.stu-btn.pri');
          const done = document.querySelector('#phase-practice');
          return (done?.textContent?.includes('Practice complete'))
            || (btn?.textContent?.includes('Try Again'))
            || (!btn?.textContent?.includes('Checking'));
        }, { timeout: 60_000 }).catch(() => {});
        await page.waitForTimeout(500);
      }
      await page.screenshot({ path: snap('04-task4-map-result'), fullPage: true });

      const complete = await page.getByText('Practice complete').isVisible({ timeout: 2_000 }).catch(() => false);
      report.push({
        step: 'Task 4 (Map)',
        status: complete ? '\u2713' : '\u26a0',
        notes: `${placed} practice chips placed, ${givenCount} pre-placed${complete ? ' \u2014 complete' : ''}`,
      });
    } catch (e: any) {
      await page.screenshot({ path: snap('04-task4-error'), fullPage: true });
      report.push({ step: 'Task 4 (Map)', status: '\u2717', notes: e.message?.slice(0, 120) });
    }
  }

  async function doTask5Order(page: Page) {
    try {
      await confirmListen(page);
      await scrollToPractice(page);

      await expect(page.locator('.stu-order-choice').first()).toBeVisible({ timeout: 10_000 });
      await page.screenshot({ path: snap('05-task5-order'), fullPage: true });

      // items: [0]Scanning, [1]Predicting, [2]Evaluating, [3]Skimming
      // correctOrder = [1, 3, 0, 2] → Predict(1) → Skim(3) → Scan(0) → Evaluate(2)
      const clickOrder = ['Predict', 'Skim', 'Scan', 'Evaluat'];
      let selectedCount = 0;

      for (const keyword of clickOrder) {
        const choice = page.locator('.stu-order-choice').filter({ hasText: new RegExp(keyword, 'i') });
        if (await choice.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await choice.scrollIntoViewIfNeeded();
          await choice.click();
          selectedCount++;
          console.log(`[ORDER] Selected: ${keyword} (${selectedCount}/4)`);
          await page.waitForTimeout(500);
        } else {
          console.log(`[ORDER] Choice "${keyword}" not found among .stu-order-choice`);
        }
      }

      // Verify all items were selected (no more .stu-order-choice visible)
      const remaining = await page.locator('.stu-order-choice').count();
      console.log(`[ORDER] ${selectedCount} selected, ${remaining} remaining choices`);

      await page.screenshot({ path: snap('05-task5-order-selected'), fullPage: true });

      // Submit — wait for button to be enabled (not dimmed)
      const submitBtn = page.locator('#phase-practice button.stu-btn.pri');
      if (await submitBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await page.waitForTimeout(500);
        await submitBtn.scrollIntoViewIfNeeded();
        await submitBtn.click();
        // Wait for server check to complete
        await page.waitForFunction(() => {
          const btn = document.querySelector('#phase-practice button.stu-btn.pri');
          const done = document.querySelector('#phase-practice');
          return (done?.textContent?.includes('Practice complete'))
            || (btn?.textContent?.includes('Try Again'))
            || (!btn?.textContent?.includes('Checking'));
        }, { timeout: 30_000 }).catch(() => {});
        await page.waitForTimeout(500);
      }
      await page.screenshot({ path: snap('05-task5-order-result'), fullPage: true });

      const complete = await page.getByText('Practice complete').isVisible({ timeout: 2_000 }).catch(() => false);
      report.push({
        step: 'Task 5 (Order)',
        status: complete ? '\u2713' : '\u26a0',
        notes: complete ? `Correct order (${selectedCount}/4 selected) \u2014 complete` : `${selectedCount}/4 selected`,
      });
    } catch (e: any) {
      await page.screenshot({ path: snap('05-task5-error'), fullPage: true });
      report.push({ step: 'Task 5 (Order)', status: '\u2717', notes: e.message?.slice(0, 120) });
    }
  }
});
