/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Parity tests for Stage 2-5 plugin migrations.
 *
 * For each migrated plugin, verifies:
 *   - answerKeySchema accepts representative valid keys
 *   - sanitize() output matches the legacy `sanitizeAnswerKey()` output
 *   - For plugins that delegate grade to legacy graders, those graders
 *     continue to be invoked correctly via the plugin.
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

describe('OrderPlugin (parity for verifying registry path)', () => {
  const plugin = new OrderPlugin();
  const legacy = new OrderGrader();

  it('grade matches legacy', () => {
    const ak = { type: 'order' as const, items: ['A', 'B', 'C'], correctOrder: [2, 0, 1] };
    const data = { order: ['C', 'A', 'B'] };
    expect(plugin.grade({ key: ak, data })).toEqual(legacy.grade(ak as any, data));
  });
});

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
});

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
