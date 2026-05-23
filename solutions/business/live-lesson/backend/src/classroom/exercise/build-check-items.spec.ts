/**
 * Per-type buildCheckItems contract tests.
 *
 * The legacy `build-check-items.ts` switch was deleted (B6 — all callers
 * now go through `ExerciseTypeRegistry.buildCheckItems`). This spec runs
 * the same fixtures via the registry so the canonical per-type shape is
 * still pinned down in one place.
 */
import { ExerciseTypeRegistry } from './exercise-type-registry';
import { createPluginRegistryTestingModule } from './plugins/test-utils';
import type { GradeResult } from '../../schemas';

let registry: ExerciseTypeRegistry;

beforeAll(async () => {
  const handle = await createPluginRegistryTestingModule();
  registry = handle.registry;
});

function buildCheckItems(ak: Record<string, unknown>, data: Record<string, unknown>, gr: GradeResult): Array<Record<string, unknown>> {
  const items = registry.buildCheckItems(ak, data, gr);
  if (!items) throw new Error(`no buildCheckItems impl for type "${ak.type}"`);
  return items;
}

describe('buildCheckItems (via registry)', () => {
  // ── quiz ──

  describe('quiz', () => {
    const ak = {
      type: 'quiz',
      answers: [
        { questionIdx: 0, correct: 1, hint: 'Hint0', hintZh: '提示0', walkthrough: 'WT0', walkthroughZh: 'WT0Zh' },
        { questionIdx: 1, correct: 0 },
      ],
    };

    it('all correct → no hints', () => {
      const gr: GradeResult = { total: 100, byDimension: { q0: true, q1: true } };
      const items = buildCheckItems(ak, { answers: [1, 0] }, gr);
      expect(items).toHaveLength(2);
      expect(items[0]).toEqual({ idx: 0, correct: true });
      expect(items[1]).toEqual({ idx: 1, correct: true });
    });

    it('wrong answers include hint/walkthrough fields', () => {
      const gr: GradeResult = { total: 0, byDimension: { q0: false, q1: false } };
      const items = buildCheckItems(ak, { answers: [0, 1] }, gr);
      expect(items[0]).toEqual({
        idx: 0, correct: false,
        hint: 'Hint0', hintZh: '提示0', walkthrough: 'WT0', walkthroughZh: 'WT0Zh',
      });
      // q1 has no hint fields
      expect(items[1]).toEqual({ idx: 1, correct: false });
    });

    it('partial correct', () => {
      const gr: GradeResult = { total: 50, byDimension: { q0: true, q1: false } };
      const items = buildCheckItems(ak, { answers: [1, 1] }, gr);
      expect(items[0].correct).toBe(true);
      expect(items[1].correct).toBe(false);
    });
  });

  // ── match ──

  describe('match', () => {
    const ak = {
      type: 'match',
      answers: [
        { pairIdx: 0, left: 'A', correct: 'x', hint: 'MHint' },
        { pairIdx: 1, left: 'B', correct: 'y' },
      ],
    };

    it('all correct', () => {
      const gr: GradeResult = { total: 100, byDimension: { p0: true, p1: true } };
      const items = buildCheckItems(ak, {}, gr);
      expect(items.every(i => i.correct)).toBe(true);
    });

    it('wrong pair shows hint', () => {
      const gr: GradeResult = { total: 50, byDimension: { p0: false, p1: true } };
      const items = buildCheckItems(ak, {}, gr);
      expect(items[0]).toEqual({ idx: 0, correct: false, hint: 'MHint' });
      expect(items[1]).toEqual({ idx: 1, correct: true });
    });
  });

  // ── matrix ──

  describe('matrix', () => {
    const ak = {
      type: 'matrix',
      answers: [
        { rowIdx: 0, isDemo: true },
        { rowIdx: 1, isDemo: false, hint: 'Row1Hint', hintZh: 'Row1提示' },
        { rowIdx: 2, isDemo: false },
      ],
    };

    it('filters out demo rows', () => {
      const gr: GradeResult = { total: 100, byDimension: { place: true, practice: true, reason: true } };
      const items = buildCheckItems(ak, {}, gr);
      // Only non-demo rows (idx 1 and 2)
      expect(items).toHaveLength(2);
      expect(items.map(i => i.idx)).toEqual([1, 2]);
    });

    it('all dimensions correct → items correct', () => {
      const gr: GradeResult = { total: 100, byDimension: { place: 100, practice: 100, reason: 100 } };
      const items = buildCheckItems(ak, {}, gr);
      expect(items.every(i => i.correct)).toBe(true);
    });

    it('any dimension wrong → items incorrect with hint', () => {
      const gr: GradeResult = { total: 33, byDimension: { place: true, practice: false, reason: true } };
      const items = buildCheckItems(ak, {}, gr);
      expect(items[0]).toEqual({ idx: 1, correct: false, hint: 'Row1Hint', hintZh: 'Row1提示' });
      expect(items[1]).toEqual({ idx: 2, correct: false });
    });
  });

  // ── stance ──

  describe('stance', () => {
    const ak = { type: 'stance' };

    it('both correct', () => {
      const gr: GradeResult = { total: 100, byDimension: { position: true, evidence: true } };
      const items = buildCheckItems(ak, {}, gr);
      expect(items).toEqual([
        { idx: 'position', correct: true },
        { idx: 'evidence', correct: true },
      ]);
    });

    it('position wrong, evidence correct', () => {
      const gr: GradeResult = { total: 50, byDimension: { position: false, evidence: true } };
      const items = buildCheckItems(ak, {}, gr);
      expect(items[0]).toEqual({ idx: 'position', correct: false });
      expect(items[1]).toEqual({ idx: 'evidence', correct: true });
    });

    it('both wrong', () => {
      const gr: GradeResult = { total: 0, byDimension: { position: false, evidence: false } };
      const items = buildCheckItems(ak, {}, gr);
      expect(items.every(i => !i.correct)).toBe(true);
    });
  });

  // ── order ──

  describe('order', () => {
    const ak = {
      type: 'order',
      items: ['Intro', 'Body', 'Conclusion'],
      correctOrder: [0, 1, 2],
    };

    it('correct order → all correct', () => {
      const data = { order: ['Intro', 'Body', 'Conclusion'] };
      const gr: GradeResult = { total: 100, byDimension: {} };
      const items = buildCheckItems(ak, data, gr);
      expect(items).toHaveLength(3);
      expect(items.every(i => i.correct)).toBe(true);
    });

    it('wrong order → marks wrong positions', () => {
      const data = { order: ['Conclusion', 'Body', 'Intro'] };
      const gr: GradeResult = { total: 0, byDimension: {} };
      const items = buildCheckItems(ak, data, gr);
      expect(items[0]).toEqual({ idx: 0, correct: false }); // Conclusion != Intro
      expect(items[1]).toEqual({ idx: 1, correct: true });  // Body == Body
      expect(items[2]).toEqual({ idx: 2, correct: false }); // Intro != Conclusion
    });

    it('handles numeric order values', () => {
      const data = { order: [0, 1, 2] };
      const gr: GradeResult = { total: 100, byDimension: {} };
      const items = buildCheckItems(ak, data, gr);
      expect(items.every(i => i.correct)).toBe(true);
    });
  });

  // ── select-evidence ──

  describe('select-evidence', () => {
    const ak = {
      type: 'select-evidence',
      sections: [
        { id: 's1', correctFunction: 'cause-effect', hint: 'H1', hintZh: 'H1Zh', aiCorrect: 'Good!', aiPartial: 'Try again' },
        { id: 's2', correctFunction: 'compare' },
      ],
    };

    it('correct function → correct with aiCorrect message', () => {
      const data = { sections: { s1: { function: 'cause-effect' }, s2: { function: 'compare' } } };
      const gr: GradeResult = { total: 100, byDimension: {} };
      const items = buildCheckItems(ak, data, gr);
      expect(items[0]).toEqual({ idx: 's1', correct: true, aiMessage: 'Good!' });
      expect(items[1]).toEqual({ idx: 's2', correct: true });
    });

    it('wrong function → incorrect with hint and aiPartial', () => {
      const data = { sections: { s1: { function: 'wrong' }, s2: { function: 'wrong' } } };
      const gr: GradeResult = { total: 0, byDimension: {} };
      const items = buildCheckItems(ak, data, gr);
      expect(items[0]).toEqual({ idx: 's1', correct: false, hint: 'H1', hintZh: 'H1Zh', aiMessage: 'Try again' });
      expect(items[1]).toEqual({ idx: 's2', correct: false });
    });

    it('case-insensitive function matching', () => {
      const data = { sections: { s1: { function: 'Cause-Effect' } } };
      const gr: GradeResult = { total: 100, byDimension: {} };
      const items = buildCheckItems(ak, data, gr);
      expect(items[0].correct).toBe(true);
    });
  });

  // ── map ──

  describe('map', () => {
    const ak = {
      type: 'map',
      items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      practiceCount: 2,
    };

    it('correct placements with LLM feedback', () => {
      const data = { practiceItemIds: ['a', 'b'] };
      const gr: GradeResult = {
        total: 100,
        byDimension: {
          a_placed: true, a_reasoned: true, a_positionScore: 80,
          b_placed: true, b_reasoned: true, b_positionScore: 90,
        },
        llmFeedback: 'Overall good work',
        llmItems: [
          { index: 0, id: 'a', relevant: true, reason: 'Well placed' },
          { index: 1, id: 'b', relevant: true, reason: 'Good reasoning' },
        ],
      };
      const items = buildCheckItems(ak, data, gr);
      expect(items.filter(i => i.idx !== '_llm')).toHaveLength(2);
      expect(items.find(i => i.idx === 'a')).toEqual({ idx: 'a', correct: true, hint: 'Well placed' });
      expect(items.find(i => i.idx === '_llm')).toEqual({ idx: '_llm', correct: true, hint: 'Overall good work' });
    });

    it('low positionScore → incorrect', () => {
      const data = { practiceItemIds: ['a'] };
      const gr: GradeResult = {
        total: 30,
        byDimension: { a_placed: true, a_reasoned: true, a_positionScore: 20 },
      };
      const items = buildCheckItems(ak, data, gr);
      expect(items[0].correct).toBe(false);
    });

    it('missing reasoning → incorrect', () => {
      const data = { practiceItemIds: ['a'] };
      const gr: GradeResult = {
        total: 30,
        byDimension: { a_placed: true, a_reasoned: false, a_positionScore: 100 },
      };
      const items = buildCheckItems(ak, data, gr);
      expect(items[0].correct).toBe(false);
    });
  });

  // ── default / unknown type ──

  describe('unknown type', () => {
    it('returns null from the registry (caller responsibility to default to [])', () => {
      const items = registry.buildCheckItems(
        { type: 'unknown-type' },
        {},
        { total: 0, byDimension: {} },
      );
      // Legacy returned `[]`; registry returns `null` so callers can decide
      // whether to fall back. ExerciseService + StudentSubmissionService
      // both coerce null → [].
      expect(items).toBeNull();
    });
  });
});
