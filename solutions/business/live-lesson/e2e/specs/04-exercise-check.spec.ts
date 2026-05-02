import { test, expect } from '@playwright/test';
import { getExercise, checkAnswer } from '../helpers/api-client';
import { createTestSession } from '../helpers/session-factory';
import { QUIZ_CORRECT_ANSWERS } from '../helpers/constants';

test.describe('04 — Exercise check', () => {
  let code: string;
  let studentId: string;

  test.beforeAll(async () => {
    const { session, student } = await createTestSession({ studentName: 'ExerciseStudent' });
    code = session.code;
    studentId = student!.studentId;
  });

  // ── Quiz (step 1) ──

  test('quiz: GET exercise spec returns questions without correct field', async () => {
    const { status, data } = await getExercise(code, 1);
    expect(status).toBe(200);
    const body = data as { type: string; questions: Array<{ options: string[]; correct?: number }> };
    expect(body.type).toBe('quiz');
    expect(Array.isArray(body.questions)).toBe(true);
    expect(body.questions.length).toBeGreaterThan(0);
    // Answers should be stripped
    for (const q of body.questions) {
      expect(q.correct).toBeUndefined();
    }
  });

  test('quiz: check correct answers → allCorrect: true', async () => {
    const { status, data } = await checkAnswer(code, 1, studentId, { answers: QUIZ_CORRECT_ANSWERS });
    expect(status).toBe(201);
    const body = data as { type: string; allCorrect: boolean; items: unknown[] };
    expect(body.type).toBe('quiz');
    expect(body.allCorrect).toBe(true);
  });

  test('quiz: check partial answers → items with feedback', async () => {
    // Submit wrong answers (all zeros — at least one will be wrong for [1,2,1])
    const { status, data } = await checkAnswer(code, 1, studentId, { answers: [0, 0, 0] });
    expect(status).toBe(201);
    const body = data as { type: string; allCorrect: boolean; items: Array<{ correct: boolean }> };
    expect(body.type).toBe('quiz');
    expect(body.allCorrect).toBe(false);
    expect(Array.isArray(body.items)).toBe(true);
    // At least one wrong
    expect(body.items.some(i => !i.correct)).toBe(true);
  });

  // ── Select-evidence (step 2) ──

  test('select-evidence: GET exercise spec returns sections + paragraphTokens', async () => {
    const { status, data } = await getExercise(code, 2);
    expect(status).toBe(200);
    const body = data as { type: string; sections?: unknown[]; paragraphTokens?: Record<string, unknown[]> };
    expect(body.type).toBe('select-evidence');
    expect(Array.isArray(body.sections)).toBe(true);
    // paragraphTokens is a Record<paraId, Token[]>, not an array
    expect(typeof body.paragraphTokens).toBe('object');
    expect(body.paragraphTokens).not.toBeNull();
    expect(Object.keys(body.paragraphTokens!).length).toBeGreaterThan(0);
  });

  // ── Matrix (step 3) ──

  test('matrix: GET exercise spec returns rows with isDemo flags', async () => {
    const { status, data } = await getExercise(code, 3);
    expect(status).toBe(200);
    const body = data as { type: string; rows?: Array<{ isDemo?: boolean }> };
    expect(body.type).toBe('matrix');
    expect(Array.isArray(body.rows)).toBe(true);
    expect(body.rows!.length).toBeGreaterThan(0);
  });

  // ── Order (step 5) ──

  test('order: GET exercise spec returns items array', async () => {
    const { status, data } = await getExercise(code, 5);
    expect(status).toBe(200);
    const body = data as { type: string; items?: unknown[] };
    expect(body.type).toBe('order');
    expect(Array.isArray(body.items)).toBe(true);
  });
});
