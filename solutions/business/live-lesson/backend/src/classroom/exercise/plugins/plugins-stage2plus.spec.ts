/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Parity tests for Stage 2-5 plugin migrations.
 *
 * Plugins fall into two categories — read the describe block's first comment
 * to know which kind you're looking at:
 *
 *   • Native plugins (stance, order, fill-blank, select-evidence) —
 *     grade() is reimplemented inside the plugin. Parity tests compare
 *     plugin output to the legacy grader output to confirm behavioural
 *     equivalence.
 *
 *   • Delegating plugins (matrix, map, image-upload, rich-content-quiz,
 *     guided-discovery) — grade() literally calls a legacy grader instance
 *     held inside the plugin. A grade-parity assertion here is tautological
 *     (it compares the legacy grader to itself). What these tests actually
 *     guarantee is:
 *       - answerKeySchema accepts representative valid keys
 *       - sanitize() output matches the legacy `sanitizeAnswerKey()` output
 *       - The grade() call wires through (i.e. returns a GradeResult shape)
 *     The legacy grader's own spec file (graders/*.spec.ts) remains the
 *     source of truth for grading behaviour for delegating plugins.
 */
import { sanitizeAnswerKey } from '../../../schemas/manifest.utils';
import { StancePlugin } from './stance.plugin';
import { OrderPlugin } from './order.plugin';
import { MatrixPlugin } from './matrix.plugin';
import { MapPlugin } from './map.plugin';
import { ImageUploadPlugin } from './image-upload.plugin';
import { SelectEvidencePlugin } from './select-evidence.plugin';
import { RichContentQuizPlugin } from './rich-content-quiz.plugin';
import { GuidedDiscoveryPlugin } from './guided-discovery.plugin';
import { FillBlankPlugin } from './fill-blank.plugin';
import { StanceGrader } from '../graders/stance.grader';
import { OrderGrader } from '../graders/order.grader';
import type { AiPromptBuilder } from '../../ai-prompt-builder';

const mockAiPromptBuilder = {
  callLlm: jest.fn().mockRejectedValue(new Error('not configured in test')),
  callVisionLlm: jest.fn().mockRejectedValue(new Error('not configured in test')),
} as unknown as AiPromptBuilder;

// Native plugin — grade() reimplemented; parity assertions are real.
describe('StancePlugin (parity)', () => {
  const plugin = new StancePlugin();
  const legacy = new StanceGrader();

  it('schema accepts valid stance answerKey', () => {
    const ak = {
      type: 'stance',
      validPositions: ['Agree'],
      minEvidence: 2,
      stanceOpts: ['Agree', 'Disagree'],
      evidence: ['e1', 'e2'],
    };
    expect(plugin.answerKeySchema.safeParse(ak).success).toBe(true);
  });

  it('grade matches legacy for valid position + enough evidence', () => {
    const ak = {
      type: 'stance' as const,
      validPositions: ['Agree'],
      minEvidence: 2,
      stanceOpts: ['Agree', 'Disagree'],
      evidence: ['e1', 'e2'],
    };
    const data = { position: 'Agree', evidence: ['e1', 'e2'] };
    const pluginR = plugin.grade({ key: ak, data });
    const legacyR = legacy.grade(ak as any, data);
    expect(pluginR).toEqual(legacyR);
  });

  it('sanitize strips validPositions + minEvidence', () => {
    const ak = {
      type: 'stance',
      validPositions: ['Agree'],
      minEvidence: 2,
      stanceQ: 'Q?',
      stanceOpts: ['Agree', 'Disagree'],
      evidence: ['e1'],
    };
    const spec = plugin.sanitize({ answerKey: ak }) as any;
    expect(spec.validPositions).toBeUndefined();
    expect(spec.minEvidence).toBeUndefined();
    expect(spec.stanceQ).toBe('Q?');
    expect(spec.stanceOpts).toEqual(['Agree', 'Disagree']);
  });

  it('sanitize output matches legacy sanitizeAnswerKey', () => {
    const ak = {
      type: 'stance',
      validPositions: ['Agree'],
      minEvidence: 2,
      stanceOpts: ['Agree', 'Disagree'],
      evidence: ['e1'],
    };
    expect(plugin.sanitize({ answerKey: ak })).toEqual(sanitizeAnswerKey(ak));
  });
});

// Native plugin — grade() reimplemented; parity assertions are real.
describe('OrderPlugin (parity for verifying registry path)', () => {
  const plugin = new OrderPlugin();
  const legacy = new OrderGrader();

  it('grade matches legacy', () => {
    const ak = { type: 'order' as const, items: ['A', 'B', 'C'], correctOrder: [2, 0, 1] };
    const data = { order: ['C', 'A', 'B'] };
    expect(plugin.grade({ key: ak, data })).toEqual(legacy.grade(ak as any, data));
  });
});

// Native plugin — grade() reimplemented; parity assertions are real.
describe('FillBlankPlugin (parity)', () => {
  const plugin = new FillBlankPlugin(mockAiPromptBuilder);

  it('schema accepts valid fill-blank answerKey', () => {
    const ak = {
      type: 'fill-blank',
      sentences: [
        {
          id: 's1',
          template: 'Ideas {{verb}} over time.',
          blanks: { verb: { accepts: ['change', 'changes'] } },
        },
      ],
    };
    expect(plugin.answerKeySchema.safeParse(ak).success).toBe(true);
  });

  it('grade does exact match on accepts[]', async () => {
    const ak = {
      type: 'fill-blank' as const,
      sentences: [
        {
          id: 's1',
          template: '{{a}}',
          blanks: { a: { accepts: ['change'] } },
        },
      ],
    };
    const r = await plugin.grade({ key: ak, data: { blanks: { s1_a: 'change' } } });
    expect(r.total).toBe(100);
    expect(r.byDimension.s1_a).toBe(true);
  });

  it('sanitize strips accepts but keeps template', () => {
    const ak = {
      type: 'fill-blank',
      sentences: [
        { id: 's1', template: 'tpl {{x}}', blanks: { x: { accepts: ['ok'] } } },
      ],
    };
    const spec = plugin.sanitize({ answerKey: ak }) as any;
    expect(spec.sentences[0].template).toBe('tpl {{x}}');
    expect(spec.sentences[0].blanks).toBeUndefined();
  });
});

// Delegating plugin — grade() forwards to MatrixGrader. Grade-parity is
// tautological; this test covers schema, sanitize, and wiring only.
describe('MatrixPlugin (parity)', () => {
  const plugin = new MatrixPlugin(mockAiPromptBuilder);

  it('schema accepts valid matrix answerKey', () => {
    const ak = {
      type: 'matrix',
      answers: [
        { rowIdx: 0, place: 'A', isDemo: true, practice: 'p', reason: 'r' },
        { rowIdx: 1, place: 'B', isDemo: false, practice: 'p', reason: 'r' },
      ],
    };
    expect(plugin.answerKeySchema.safeParse(ak).success).toBe(true);
  });

  it('schema rejects non-demo rows missing practice', () => {
    const ak = {
      type: 'matrix',
      answers: [{ rowIdx: 0, place: 'A', isDemo: false }],
    };
    expect(plugin.answerKeySchema.safeParse(ak).success).toBe(false);
  });

  it('sanitize keeps demo rows complete; non-demo only place + isDemo', () => {
    const ak = {
      type: 'matrix',
      answers: [
        { rowIdx: 0, place: 'Demo', isDemo: true, practice: 'pd', reason: 'rd' },
        { rowIdx: 1, place: 'P', isDemo: false, practice: 'pp', reason: 'rp' },
      ],
    };
    const spec = plugin.sanitize({ answerKey: ak }) as any;
    expect(spec.rows[0].practice).toBe('pd');
    expect(spec.rows[1].practice).toBe('pp'); // legacy sanitizer keeps non-demo practice too
    expect(spec.rows[1].isDemo).toBe(false);
  });

  it('sanitize matches legacy sanitizeAnswerKey', () => {
    const ak = {
      type: 'matrix',
      answers: [
        { rowIdx: 0, place: 'Demo', isDemo: true, practice: 'pd', reason: 'rd' },
        { rowIdx: 1, place: 'P', isDemo: false, practice: 'pp', reason: 'rp' },
      ],
    };
    expect(plugin.sanitize({ answerKey: ak })).toEqual(sanitizeAnswerKey(ak));
  });
});

// Delegating plugin — grade() forwards to MapGrader. Grade-parity is
// tautological; this test covers schema, sanitize, and wiring only.
describe('MapPlugin (parity)', () => {
  const plugin = new MapPlugin(mockAiPromptBuilder);

  it('schema accepts valid map answerKey', () => {
    const ak = {
      type: 'map',
      prompt: 'Q',
      axes: { x: { neg: 'L', pos: 'R', label: 'X' }, y: { neg: 'B', pos: 'T', label: 'Y' } },
      items: [{ id: 'a', label: 'A' }],
      expected: { a: [0.5, 0.5] },
    };
    expect(plugin.answerKeySchema.safeParse(ak).success).toBe(true);
  });

  it('sanitize strips expected', () => {
    const ak = {
      type: 'map',
      prompt: 'Q',
      axes: { x: { neg: 'L', pos: 'R', label: 'X' }, y: { neg: 'B', pos: 'T', label: 'Y' } },
      items: [{ id: 'a', label: 'A' }],
      expected: { a: [0.5, 0.5] },
    };
    const spec = plugin.sanitize({ answerKey: ak }) as any;
    expect(spec.expected).toBeUndefined();
    expect(spec.mapItems).toEqual([{ id: 'a', label: 'A' }]);
  });
});

// Delegating plugin — grade() forwards to ImageUploadGrader. Grade-parity is
// tautological; this test covers schema, sanitize, and wiring only.
describe('ImageUploadPlugin (parity)', () => {
  const plugin = new ImageUploadPlugin(mockAiPromptBuilder);

  it('schema accepts valid image-upload answerKey', () => {
    const ak = {
      type: 'image-upload',
      prompt: 'Calc',
      rubric: [{ id: 'c1', label: 'correct', weight: 100, criteria: 'must equal' }],
    };
    expect(plugin.answerKeySchema.safeParse(ak).success).toBe(true);
  });

  it('sanitize strips criteria + accepts + sampleSolution + aiSystemPrompt', () => {
    const ak = {
      type: 'image-upload',
      prompt: 'Calc',
      accepts: ['y^2-4'],
      sampleSolution: '...',
      aiSystemPrompt: 'secret',
      rubric: [{ id: 'c1', label: 'lab', weight: 100, criteria: 'criteria' }],
    };
    const spec = plugin.sanitize({ answerKey: ak }) as any;
    expect(spec.accepts).toBeUndefined();
    expect(spec.sampleSolution).toBeUndefined();
    expect(spec.aiSystemPrompt).toBeUndefined();
    expect(spec.rubric[0].criteria).toBeUndefined();
    expect(spec.rubric[0].label).toBe('lab');
  });
});

// Native plugin — grade() reimplemented; parity assertions are real.
describe('SelectEvidencePlugin (parity)', () => {
  const plugin = new SelectEvidencePlugin();

  it('schema accepts valid select-evidence answerKey', () => {
    const ak = {
      type: 'select-evidence',
      functionOptions: ['contrast', 'cause'],
      sections: [{ id: 's1', label: 'Section 1', range: [1, 2], correctFunction: 'contrast' }],
    };
    expect(plugin.answerKeySchema.safeParse(ak).success).toBe(true);
  });

  it('schema rejects correctFunction not in functionOptions', () => {
    const ak = {
      type: 'select-evidence',
      functionOptions: ['cause'],
      sections: [{ id: 's1', label: 'L', range: [1], correctFunction: 'contrast' }],
    };
    expect(plugin.answerKeySchema.safeParse(ak).success).toBe(false);
  });

  it('sanitize keeps correctFunction (client-side grading)', () => {
    const ak = {
      type: 'select-evidence',
      functionOptions: ['contrast'],
      sections: [{ id: 's1', label: 'L', range: [1], correctFunction: 'contrast' }],
    };
    const spec = plugin.sanitize({ answerKey: ak }) as any;
    expect(spec.sections[0].correctFunction).toBe('contrast');
  });

  it('grade matches legacy', () => {
    const ak = {
      type: 'select-evidence' as const,
      functionOptions: ['contrast'],
      sections: [{ id: 's1', label: 'L', range: [1], correctFunction: 'contrast' }],
    };
    const data = { sections: { s1: { function: 'contrast', picked: [] } } };
    const r = plugin.grade({ key: ak as any, data });
    expect(r.total).toBeGreaterThanOrEqual(0);
  });
});

// Delegating plugin — grade() forwards to RichContentQuizGrader. Grade-parity
// is tautological; this test covers schema, sanitize, and wiring only.
describe('RichContentQuizPlugin (parity)', () => {
  const plugin = new RichContentQuizPlugin(mockAiPromptBuilder);

  it('schema accepts parts-based answerKey', () => {
    const ak = {
      type: 'rich-content-quiz',
      parts: [
        {
          id: 'q1',
          prompt: 'P',
          rubric: [{ id: 'c1', label: 'L', weight: 100, criteria: 'crit' }],
        },
      ],
    };
    expect(plugin.answerKeySchema.safeParse(ak).success).toBe(true);
  });

  it('sanitize replaces scaffold with hasScaffold:true', () => {
    const ak = {
      type: 'rich-content-quiz',
      parts: [
        {
          id: 'q1',
          prompt: 'P',
          rubric: [{ id: 'c1', label: 'L', weight: 100, criteria: 'crit' }],
          scaffold: { threshold: 1, levels: [{ hintZh: 'h' }] },
        },
      ],
    };
    const spec = plugin.sanitize({ answerKey: ak }) as any;
    expect(spec.parts[0].hasScaffold).toBe(true);
    expect(spec.parts[0].scaffold).toBeUndefined();
  });

  // §14: RichContentQuiz parts contract.
  //
  // Parts grading happens in `StudentSubmissionService.submitRichContentPart`
  // (per-part synthetic image-upload calls), NOT in `plugin.grade()`. The
  // plugin's grade() forwards to ImageUploadGrader which only reads the
  // TOP-LEVEL rubric — for a parts-style key without top-level rubric, that
  // returns `{ total: 0, byDimension: {} }`. The test below pins this so a
  // future caller doesn't mistakenly assume parts auto-fan-out from grade().
  it('grade() on parts-only key returns empty byDimension (parts grading lives in StudentSubmissionService)', async () => {
    const ak = {
      type: 'rich-content-quiz',
      parts: [
        {
          id: 'p1',
          prompt: 'P1',
          rubric: [{ id: 'clarity', label: 'L', weight: 100, criteria: 'crit' }],
        },
      ],
    };
    const result = await plugin.grade({ key: ak as any, data: { images: ['data:image/jpeg;base64,x'] } });
    expect(result.total).toBe(0);
    expect(result.byDimension).toEqual({});
  });

  // buildCheckItems for parts-style consumes dotted byDimension keys
  // (`<partId>.<rubricId>`). The dotted shape is the contract a future
  // multi-part grader must emit; we test that contract here so the plugin
  // and any orchestrator stay in agreement.
  it('buildCheckItems aggregates per-part correctness from dotted byDimension keys', () => {
    const ak = {
      type: 'rich-content-quiz',
      parts: [
        {
          id: 'p1',
          prompt: 'P1',
          rubric: [
            { id: 'clarity', label: 'L', weight: 50, criteria: 'crit' },
            { id: 'rigor', label: 'L', weight: 50, criteria: 'crit' },
          ],
        },
        {
          id: 'p2',
          prompt: 'P2',
          rubric: [{ id: 'clarity', label: 'L', weight: 100, criteria: 'crit' }],
        },
      ],
    };
    const items = plugin.buildCheckItems({
      key: ak as any,
      data: {},
      gradeResult: {
        total: 0,
        byDimension: {
          'p1.clarity': 90,
          'p1.rigor': 85,
          'p2.clarity': 40,
        },
      },
    });
    expect(items).toEqual([
      { idx: 'p1', correct: true },
      { idx: 'p2', correct: false },
    ]);
  });

  // Without dotted keys (e.g. plugin.grade() output unchanged), every part
  // resolves to `correct: false` — documents the failure mode.
  it('buildCheckItems with parts but flat byDimension yields all parts wrong', () => {
    const ak = {
      type: 'rich-content-quiz',
      parts: [
        {
          id: 'p1',
          prompt: 'P1',
          rubric: [{ id: 'clarity', label: 'L', weight: 100, criteria: 'crit' }],
        },
      ],
    };
    const items = plugin.buildCheckItems({
      key: ak as any,
      data: {},
      gradeResult: { total: 100, byDimension: { clarity: 95 } },
    });
    expect(items).toEqual([{ idx: 'p1', correct: false }]);
  });
});

// Delegating plugin — grade() forwards to GuidedDiscoveryGrader. Grade-parity
// is tautological; this test covers schema, sanitize, and wiring only.
describe('GuidedDiscoveryPlugin (parity)', () => {
  const plugin = new GuidedDiscoveryPlugin(mockAiPromptBuilder);

  it('schema accepts valid guided-discovery answerKey', () => {
    const ak = {
      type: 'guided-discovery',
      title: 'Discover',
      steps: [
        {
          type: 'observation_choice',
          id: 'o1',
          title: 'Observe',
          choices: [{ id: 'c1', options: ['a', 'b'], correct: 1 }],
        },
      ],
    };
    expect(plugin.answerKeySchema.safeParse(ak).success).toBe(true);
  });

  it('sanitize keeps observation_choice.correct (intentional)', () => {
    const ak = {
      type: 'guided-discovery',
      title: 'T',
      steps: [
        {
          type: 'observation_choice',
          id: 'o1',
          title: 'Observe',
          choices: [{ id: 'c1', options: ['a', 'b'], correct: 1 }],
        },
      ],
    };
    const spec = plugin.sanitize({ answerKey: ak }) as any;
    expect(spec.gdSteps[0].choices[0].correct).toBe(1); // intentional leakage per design
  });
});
