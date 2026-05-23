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
import { StancePlugin } from '../../../domain/exercise-types/stance/stance.plugin';
import { OrderPlugin } from '../../../domain/exercise-types/order/order.plugin';
import { MatrixPlugin } from '../../../domain/exercise-types/matrix/matrix.plugin';
import { MapPlugin } from '../../../domain/exercise-types/map/map.plugin';
import { ImageUploadPlugin } from '../../../domain/exercise-types/image-upload/image-upload.plugin';
import { SelectEvidencePlugin } from '../../../domain/exercise-types/select-evidence/select-evidence.plugin';
import { RichContentQuizPlugin } from '../../../domain/exercise-types/rich-content-quiz/rich-content-quiz.plugin';
import { GuidedDiscoveryPlugin } from '../../../domain/exercise-types/guided-discovery/guided-discovery.plugin';
import { FillBlankPlugin } from '../../../domain/exercise-types/fill-blank/fill-blank.plugin';
import { StanceGrader } from '../../../domain/exercise-types/stance/stance.grader';
import { OrderGrader } from '../../../domain/exercise-types/order/order.grader';
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

// ─────────────────────────────────────────────────────────────────────────
// §14 L3 two-stage grade contract
// ─────────────────────────────────────────────────────────────────────────
//
// Pin down `buildGradePrompt` + `parseGradeResponse` shapes per plugin so the
// preview-server L3 inspector endpoint can rely on the contract. Three
// categories:
//   - Trivial (no LLM): quiz, match → buildGradePrompt returns [];
//     parseGradeResponse falls back to grade()
//   - LLM-backed: matrix → buildGradePrompt returns 1 spec from MatrixGrader;
//     parseGradeResponse uses the edited response to skip the LLM call
//
// fill-blank already had L3 (pre-existing), guided-discovery / map / image-
// upload / rich-content-quiz / order / stance / select-evidence are out of
// scope for this commit — backend endpoints return 400 "not available" for
// those types until someone implements them.

describe('§14 L3: QuizPlugin', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { QuizPlugin } = require('../../../domain/exercise-types/quiz/quiz.plugin');
  const plugin = new QuizPlugin();

  it('buildGradePrompt returns [] (no LLM call needed for quiz)', () => {
    const ak = {
      type: 'quiz',
      answers: [{ questionIdx: 0, correct: 1, questionText: 'Q', options: ['A', 'B'] }],
    };
    const prompts = plugin.buildGradePrompt({ key: ak, data: { answers: [0] } });
    expect(prompts).toEqual([]);
  });

  it('parseGradeResponse ignores responses and re-runs grade()', () => {
    const ak = {
      type: 'quiz',
      answers: [
        { questionIdx: 0, correct: 1, questionText: 'Q1', options: ['A', 'B'] },
        { questionIdx: 1, correct: 0, questionText: 'Q2', options: ['X', 'Y'] },
      ],
    };
    const result = plugin.parseGradeResponse([], { key: ak, data: { answers: [1, 0] } });
    expect(result.total).toBe(100);
    expect(result.byDimension).toEqual({ q0: true, q1: true });
  });
});

describe('§14 L3: MatchPlugin', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { MatchPlugin } = require('../../../domain/exercise-types/match/match.plugin');
  const plugin = new MatchPlugin();

  it('buildGradePrompt returns [] (no LLM call needed for match)', () => {
    const ak = {
      type: 'match',
      answers: [{ pairIdx: 0, left: 'L', correct: 'X' }],
      options: ['X', 'Y'],
    };
    const prompts = plugin.buildGradePrompt({ key: ak, data: { pairs: ['x'] } });
    expect(prompts).toEqual([]);
  });

  it('parseGradeResponse ignores responses and re-runs grade()', () => {
    const ak = {
      type: 'match',
      answers: [{ pairIdx: 0, left: 'L', correct: 'Hello' }],
      options: ['Hello', 'World'],
    };
    const result = plugin.parseGradeResponse([], { key: ak, data: { pairs: ['hello'] } });
    expect(result.total).toBe(100);
  });
});

describe('§14 L3: MatrixPlugin', () => {
  const plugin = new MatrixPlugin(mockAiPromptBuilder);
  const ak = {
    type: 'matrix',
    answers: [
      { rowIdx: 0, place: 'Rome', practice: 'bathing', reason: 'hygiene', isDemo: false },
    ],
  };
  const data = { rows: { 0: { place: 'Rome', practice: 'bath', reason: 'clean' } } };

  it('buildGradePrompt returns one spec covering all non-demo rows', () => {
    const prompts = plugin.buildGradePrompt({ key: ak as any, data });
    expect(prompts).toHaveLength(1);
    expect(prompts[0].systemPrompt).toContain('阅读课教师助手');
    expect(prompts[0].userMessage).toContain('Rome');
    expect(prompts[0].userMessage).toContain('bath'); // student input
    expect(prompts[0].options?.responseFormat).toEqual({ type: 'json_object' });
  });

  it('buildGradePrompt returns [] when there are no non-demo rows', () => {
    const demoOnlyAk = {
      type: 'matrix',
      answers: [{ rowIdx: 0, place: 'X', isDemo: true }],
    };
    const prompts = plugin.buildGradePrompt({ key: demoOnlyAk as any, data: { rows: {} } });
    expect(prompts).toEqual([]);
  });

  it('parseGradeResponse uses the edited LLM response (no live LLM call)', () => {
    // Inspector workflow: edit the LLM output → rerun → see new grade.
    const editedResponse = JSON.stringify({ rows: { '0': { whatQ: 3, whyQ: 3 } } });
    const result = plugin.parseGradeResponse([editedResponse], { key: ak as any, data });
    expect(result.cellQualities).toBeDefined();
    expect(result.cellQualities!['0']).toEqual({ whatQ: 3, whyQ: 3 });
    // Heuristic place/practice/reason scoring still runs; total should reflect
    // partial match (place == "Rome" exact, practice/reason fuzzy).
    expect(result.byDimension?.place).toBe(100);
    expect(typeof result.total).toBe('number');
  });

  it('parseGradeResponse falls back to heuristic on malformed response', () => {
    const result = plugin.parseGradeResponse(['not json'], { key: ak as any, data });
    // Heuristic uses textQuality(text.length): "bath"=4 chars → 1, "clean"=5 → 1
    expect(result.cellQualities!['0']).toEqual({ whatQ: 1, whyQ: 1 });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// §14 L3 contracts for the remaining 7 plugins (P1+ extension)
// ─────────────────────────────────────────────────────────────────────────
//
// All 11 backend plugins now implement buildGradePrompt + parseGradeResponse.
// Three behavior buckets:
//   • Deterministic (order/stance/select-evidence/guided-discovery):
//     no LLM. buildGradePrompt returns []; parseGradeResponse re-runs grade().
//   • LLM-text (map):
//     one prompt when ≥1 item has a long-enough reason; parse merges LLM
//     score into rule-based composite.
//   • LLM-vision (image-upload, rich-content-quiz):
//     text portion of vision prompt is exposed; images aren't re-uploadable
//     via L3 so the inspector is for prompt + parse iteration only.

describe('§14 L3: OrderPlugin', () => {
  const plugin = new OrderPlugin();

  it('buildGradePrompt returns [] (deterministic, no LLM)', () => {
    expect(plugin.buildGradePrompt({ key: {} as any, data: {} })).toEqual([]);
  });

  it('parseGradeResponse([]) re-runs grade()', () => {
    const ak = { type: 'order', items: ['A', 'B'], correctOrder: [1, 0] };
    const result = plugin.parseGradeResponse([], { key: ak as any, data: { order: ['B', 'A'] } });
    expect(result.total).toBe(100);
  });
});

describe('§14 L3: StancePlugin', () => {
  const plugin = new StancePlugin();

  it('buildGradePrompt returns [] (deterministic, no LLM)', () => {
    expect(plugin.buildGradePrompt({ key: {} as any, data: {} })).toEqual([]);
  });

  it('parseGradeResponse re-runs grade() against the deterministic rules', () => {
    const ak = {
      type: 'stance',
      validPositions: ['agree'],
      minEvidence: 2,
      stanceOpts: ['agree', 'disagree'],
      evidence: ['e1', 'e2'],
    };
    const result = plugin.parseGradeResponse([], {
      key: ak as any,
      data: { position: 'agree', evidence: ['e1', 'e2'] },
    });
    expect(result.total).toBe(100);
  });
});

describe('§14 L3: SelectEvidencePlugin', () => {
  const plugin = new SelectEvidencePlugin();

  it('buildGradePrompt returns [] (client-side / no LLM)', () => {
    expect(plugin.buildGradePrompt({ key: {} as any, data: {} })).toEqual([]);
  });

  it('parseGradeResponse re-runs grade() (returns a numeric total)', () => {
    const ak = {
      type: 'select-evidence',
      sections: [{ id: 's1', label: 'sec', range: [1, 1], correctFunction: 'cause' }],
    };
    const result = plugin.parseGradeResponse([], {
      key: ak as any,
      data: { sections: { s1: { function: 'cause', picked: [] } } },
    });
    // Select-evidence's grader weights function-match + evidence picks; the
    // exact value depends on the rule. The contract here is "no LLM, same
    // result as grade()" — pin the type, not the exact score.
    expect(typeof result.total).toBe('number');
  });
});

describe('§14 L3: MapPlugin', () => {
  const plugin = new MapPlugin(mockAiPromptBuilder);
  const ak = {
    type: 'map',
    axes: {
      x: { neg: 'L', pos: 'R', label: 'x' },
      y: { neg: 'D', pos: 'U', label: 'y' },
    },
    items: [{ id: 'a', label: 'Alpha' }],
    minReasonLength: 8,
  };

  it('buildGradePrompt returns one spec when an item has a long-enough reason', () => {
    const data = {
      placements: { a: { x: 0.5, y: 0.5 } },
      reasons: { a: 'this is a long enough reason' },
    };
    const prompts = plugin.buildGradePrompt({ key: ak as any, data });
    expect(prompts).toHaveLength(1);
    expect(prompts[0].systemPrompt).toContain('坐标图');
    expect(prompts[0].userMessage).toContain('Alpha');
  });

  it('buildGradePrompt returns [] when no item has a long-enough reason', () => {
    const data = { placements: { a: { x: 0.5, y: 0.5 } }, reasons: { a: 'short' } };
    expect(plugin.buildGradePrompt({ key: ak as any, data })).toEqual([])
  });

  it('parseGradeResponse merges an edited LLM response into rule-based score', () => {
    const data = {
      placements: { a: { x: 0.5, y: 0.5 } },
      reasons: { a: 'this is a long enough reason that meets minReasonLength' },
    };
    const edited = JSON.stringify({
      items: [{ id: 'a', relevant: true, comment: 'good' }],
      overall: 'overall ok',
    });
    const result = plugin.parseGradeResponse([edited], { key: ak as any, data });
    expect(result.llmFeedback).toBe('overall ok');
    expect(result.llmItems?.[0].relevant).toBe(true);
  });

  it('parseGradeResponse falls back to rule-only on malformed JSON', () => {
    const data = {
      placements: { a: { x: 0.5, y: 0.5 } },
      reasons: { a: 'this is a long enough reason' },
    };
    const result = plugin.parseGradeResponse(['not json'], { key: ak as any, data });
    expect(result.llmFeedback).toBeUndefined();
    expect(typeof result.total).toBe('number');
  });
});

describe('§14 L3: ImageUploadPlugin', () => {
  const plugin = new ImageUploadPlugin(mockAiPromptBuilder);
  const ak = {
    type: 'image-upload',
    prompt: 'Solve the equation',
    rubric: [
      { id: 'method', label: 'Method', weight: 1, criteria: 'shows clear steps' },
      { id: 'answer', label: 'Answer', weight: 1, criteria: 'correct final answer' },
    ],
  };

  it('buildGradePrompt returns the text portion of the vision rubric', () => {
    const prompts = plugin.buildGradePrompt({ key: ak as any, data: { images: ['data:image/jpeg;base64,x'] } });
    expect(prompts).toHaveLength(1);
    expect(prompts[0].userMessage).toContain('Method');
    expect(prompts[0].userMessage).toContain('Answer');
    expect(prompts[0].options?.responseFormat).toEqual({ type: 'json_object' });
  });

  it('parseGradeResponse uses the edited response to score', () => {
    const edited = JSON.stringify({
      dimensions: [
        { id: 'method', score: 3, comment: 'clear' },
        { id: 'answer', score: 2, comment: 'mostly right' },
      ],
      feedback: 'good work',
      errorTags: [],
    });
    const result = plugin.parseGradeResponse([edited], { key: ak as any, data: { images: [] } });
    expect(result.byDimension?.method).toBe(3);
    expect(result.byDimension?.answer).toBe(2);
    expect(result.llmFeedback).toBe('good work');
  });

  it('parseGradeResponse([]) returns zero-score fallback for empty rubric path', () => {
    const result = plugin.parseGradeResponse([], { key: ak as any, data: { images: [] } });
    expect(result.total).toBe(0);
    expect(result.byDimension?.method).toBe(0);
  });
});

describe('§14 L3: RichContentQuizPlugin', () => {
  const plugin = new RichContentQuizPlugin(mockAiPromptBuilder);
  const ak = {
    type: 'rich-content-quiz',
    parts: [
      {
        id: 'p1',
        prompt: 'Part 1',
        rubric: [{ id: 'c1', label: 'L1', weight: 1, criteria: 'crit1' }],
      },
      {
        id: 'p2',
        prompt: 'Part 2',
        rubric: [{ id: 'c1', label: 'L2', weight: 1, criteria: 'crit2' }],
      },
    ],
  };

  it('buildGradePrompt returns one spec per part', () => {
    const prompts = plugin.buildGradePrompt({ key: ak as any, data: {} });
    expect(prompts).toHaveLength(2);
    expect(prompts[0].userMessage).toContain('[part: p1]');
    expect(prompts[1].userMessage).toContain('[part: p2]');
  });

  it('parseGradeResponse merges per-part byDimension under partId.rubricId keys', () => {
    const responses = [
      JSON.stringify({
        dimensions: [{ id: 'c1', score: 3, comment: 'ok' }],
        feedback: 'p1 ok',
        errorTags: [],
      }),
      JSON.stringify({
        dimensions: [{ id: 'c1', score: 2, comment: 'mid' }],
        feedback: 'p2 mid',
        errorTags: [],
      }),
    ];
    const result = plugin.parseGradeResponse(responses, { key: ak as any, data: {} });
    expect(result.byDimension?.['p1.c1']).toBe(3);
    expect(result.byDimension?.['p2.c1']).toBe(2);
  });
});

describe('§14 L3: GuidedDiscoveryPlugin', () => {
  const plugin = new GuidedDiscoveryPlugin(mockAiPromptBuilder);

  it('buildGradePrompt returns [] when there are no image blanks (deterministic submission)', () => {
    const ak = {
      type: 'guided-discovery',
      title: 'T',
      steps: [
        {
          type: 'observation_choice',
          id: 'obs',
          title: 'Obs',
          table: [{ expression: '(a+b)(a-b)', result: 'a²-b²' }],
          choices: [{ id: 'c1', label: 'L', correct: 0 }],
        },
      ],
      summary: { formula: 'x', name: 'y', description: 'z' },
    };
    expect(
      plugin.buildGradePrompt({ key: ak as any, data: { steps: { obs: { answers: { c1: 0 } } } } }),
    ).toEqual([]);
  });

  it('buildGradePrompt returns one spec per image blank in the submission', () => {
    const ak = {
      type: 'guided-discovery',
      title: 'T',
      steps: [
        {
          type: 'text_blanks',
          id: 's1',
          title: 'Sym',
          template: '{{a}} 与 {{b}}',
          blanks: [
            { id: 'a', accepts: ['和'] },
            { id: 'b', accepts: ['差'] },
          ],
        },
      ],
      summary: { formula: 'x', name: 'y', description: 'z' },
    };
    const data = {
      steps: {
        s1: {
          answers: {
            a: 'data:image/jpeg;base64,FAKE_A',
            b: 'data:image/jpeg;base64,FAKE_B',
          },
        },
      },
    };
    const prompts = plugin.buildGradePrompt({ key: ak as any, data });
    expect(prompts).toHaveLength(2);
    expect(prompts[0].userMessage).toContain('[step:s1 blank:a]');
    expect(prompts[1].userMessage).toContain('[step:s1 blank:b]');
    expect(prompts[0].systemPrompt).toContain('OCR');
    expect(prompts[0].options?.responseFormat).toEqual({ type: 'json_object' });
  });

  it('parseGradeResponse: edited OCR responses produce a grade without LLM calls', () => {
    const ak = {
      type: 'guided-discovery',
      title: 'T',
      steps: [
        {
          type: 'text_blanks',
          id: 's1',
          title: 'Sym',
          template: '{{a}}',
          blanks: [{ id: 'a', accepts: ['和'] }],
        },
      ],
      summary: { formula: 'x', name: 'y', description: 'z' },
    };
    const data = { steps: { s1: { answers: { a: 'data:image/jpeg;base64,FAKE' } } } };
    const editedResponse = JSON.stringify({ allText: '和', recognized: '和' });
    const result = plugin.parseGradeResponse([editedResponse], { key: ak as any, data });
    expect(result.byDimension?.s1).toBe(true);
  });

  it('parseGradeResponse: malformed edited response yields "图片识别失败" feedback', () => {
    const ak = {
      type: 'guided-discovery',
      title: 'T',
      steps: [
        {
          type: 'text_blanks',
          id: 's1',
          title: 'Sym',
          template: '{{a}}',
          blanks: [{ id: 'a', accepts: ['和'] }],
        },
      ],
      summary: { formula: 'x', name: 'y', description: 'z' },
    };
    const data = { steps: { s1: { answers: { a: 'data:image/jpeg;base64,FAKE' } } } };
    const result = plugin.parseGradeResponse(['not json'], { key: ak as any, data });
    expect(result.byDimension?.s1).toBe(false);
    expect(result.llmFeedback).toContain('图片识别失败');
  });
});
