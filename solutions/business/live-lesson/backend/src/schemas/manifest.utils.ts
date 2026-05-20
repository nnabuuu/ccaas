/**
 * Sanitize functions — strip answer data from answerKey/manifest for student consumption.
 * Migrated from classroom/exercise-sanitizer.ts to the shared schemas layer.
 */
import type { ExerciseSpec } from './exercise-spec.schema';

type AKInput = Record<string, unknown>;

/** Deterministic shuffle using a string seed (djb2 hash → Fisher-Yates) */
export function seededShuffle<T>(arr: T[], seed: string): T[] {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0;
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    h = ((h << 5) + h + i) >>> 0;
    const j = h % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function sanitizeAnswerKey(answerKey: unknown, exerciseLabel?: string, practiceItemIds?: string[]): ExerciseSpec | null {
  if (!answerKey || typeof answerKey !== 'object') return null;
  const ak = answerKey as AKInput;
  if (!ak.type || typeof ak.type !== 'string') return null;

  const sanitizer = sanitizers[ak.type];
  if (!sanitizer) return null;

  const spec = ak.type === 'map' ? sanitizeMap(ak, practiceItemIds) : sanitizer(ak);
  spec.label = exerciseLabel || (ak.label as string) || '';
  return spec;
}

const sanitizers: Record<string, (ak: AKInput) => ExerciseSpec> = {
  quiz: sanitizeQuiz,
  match: sanitizeMatch,
  matrix: sanitizeMatrix,
  stance: sanitizeStance,
  order: sanitizeOrder,
  'select-evidence': sanitizeSelectEvidence,
  map: sanitizeMap,
  'image-upload': sanitizeImageUpload,
  'rich-content-quiz': sanitizeRichContentQuiz,
  'fill-blank': sanitizeFillBlank,
  'guided-discovery': sanitizeGuidedDiscovery,
};

function sanitizeQuiz(ak: AKInput): ExerciseSpec {
  const answers = ak.answers as Array<AKInput> | undefined;
  return {
    type: 'quiz',
    label: '',
    questions: (answers || []).map((a) => ({
      idx: a.questionIdx as number,
      text: a.questionText as string,
      ...(a.questionTranslate && { translate: a.questionTranslate as string }),
      options: (a.options as string[]) || [],
      ...(a.paraRef && { paraRef: a.paraRef as number[] }),
    })),
  };
}

function sanitizeMatch(ak: AKInput): ExerciseSpec {
  const answers = ak.answers as Array<AKInput> | undefined;
  return {
    type: 'match',
    label: '',
    pairs: (answers || []).map((a) => ({
      idx: a.pairIdx as number,
      left: a.left as string,
      options: (a.options as string[]) || (ak.options as string[]) || [],
      ...(a.paraRef && { paraRef: a.paraRef as number[] }),
    })),
  };
}

function sanitizeMatrix(ak: AKInput): ExerciseSpec {
  const answers = ak.answers as Array<AKInput> | undefined;
  return {
    type: 'matrix',
    label: '',
    rows: (answers || []).map((a) => ({
      idx: a.rowIdx as number,
      place: a.place as string,
      isDemo: !!a.isDemo,
      ...(a.practice && { practice: a.practice as string }),
      ...(a.reason && { reason: a.reason as string }),
      ...(a.paraRef && { paraRef: a.paraRef as number[] }),
      ...(a.whatPrompt && { whatPrompt: a.whatPrompt as string }),
      ...(a.whyPrompt && { whyPrompt: a.whyPrompt as string }),
    })),
    ...(ak.practiceCount && { practiceCount: ak.practiceCount as number }),
  };
}

function sanitizeStance(ak: AKInput): ExerciseSpec {
  return {
    type: 'stance',
    label: '',
    stanceQ: ak.stanceQ as string,
    stanceQZh: ak.stanceQZh as string | undefined,
    stanceOpts: ak.stanceOpts as string[],
    evidence: ak.evidence as string[],
  };
}

function sanitizeOrder(ak: AKInput): ExerciseSpec {
  return {
    type: 'order',
    label: '',
    items: ak.items as string[],
  };
}

function sanitizeSelectEvidence(ak: AKInput): ExerciseSpec {
  // Select-evidence uses client-side grading — keep correctFunction, kind, why
  // so the frontend can grade function matching and evidence picking locally.
  const rawSections = ak.sections as Array<AKInput> | undefined;
  const sections = (rawSections || []).map((s) => ({
    id: s.id as string,
    label: s.label as string,
    range: s.range as number[],
    correctFunction: s.correctFunction as string,
    ...(s.minHits != null && { minHits: s.minHits as number }),
    ...(s.hint && { hint: s.hint as string }),
    ...(s.hintZh && { hintZh: s.hintZh as string }),
    ...(s.aiCorrect && { aiCorrect: s.aiCorrect as string }),
    ...(s.aiPartial && { aiPartial: s.aiPartial as string }),
  }));

  let paragraphTokens: ExerciseSpec['paragraphTokens'];
  if (ak.paragraphTokens && typeof ak.paragraphTokens === 'object') {
    paragraphTokens = {};
    const rawTokens = ak.paragraphTokens as Record<string, Array<Record<string, unknown>>>;
    for (const [paraNum, tokens] of Object.entries(rawTokens)) {
      paragraphTokens[paraNum] = tokens.map((tok) => ({
        t: tok.t as string,
        ...(tok.kind && { kind: tok.kind as string }),
        ...(tok.why && { why: tok.why as string }),
      }));
    }
  }

  return {
    type: 'select-evidence',
    label: '',
    functionOptions: ak.functionOptions as string[],
    sections,
    paragraphTokens,
  };
}

function sanitizeImageUpload(ak: AKInput): ExerciseSpec {
  const rubric = (ak.rubric as Array<AKInput>) || [];
  return {
    type: 'image-upload',
    label: '',
    prompt: ak.prompt as string,
    ...(ak.promptImages && { promptImages: ak.promptImages as Array<{ url: string; alt?: string }> }),
    rubric: rubric.map((r) => ({
      id: r.id as string,
      label: r.label as string,
      weight: r.weight as number,
    })),
    ...(ak.maxImages && { maxImages: ak.maxImages as number }),
  };
}

function sanitizeRichContentQuiz(ak: AKInput): ExerciseSpec {
  const parts = ak.parts as Array<AKInput> | undefined;
  if (parts && parts.length > 0) {
    return {
      type: 'rich-content-quiz',
      label: '',
      ...(ak.subType && { subType: ak.subType as string }),
      ...(ak.maxImages && { maxImages: ak.maxImages as number }),
      ...(ak.inputMethods && { inputMethods: ak.inputMethods as string[] }),
      parts: parts.map((p) => ({
        id: p.id as string,
        prompt: p.prompt as string,
        ...(p.expression && { expression: p.expression as string }),
        rubric: ((p.rubric as Array<AKInput>) || []).map((r) => ({
          id: r.id as string,
          label: r.label as string,
          weight: r.weight as number,
        })),
        ...(p.maxImages && { maxImages: p.maxImages as number }),
        ...(p.scaffold && { hasScaffold: true }),
        ...(p.inputMethods && { inputMethods: p.inputMethods as string[] }),
      })),
    };
  }
  // No parts — fall back to image-upload style sanitization
  return {
    ...sanitizeImageUpload(ak),
    type: 'rich-content-quiz',
    ...(ak.subType && { subType: ak.subType as string }),
    ...(ak.inputMethods && { inputMethods: ak.inputMethods as string[] }),
  };
}

function sanitizeFillBlank(ak: AKInput): ExerciseSpec {
  const sentences = (ak.sentences as Array<AKInput>) || [];
  return {
    type: 'fill-blank',
    label: '',
    sentences: sentences.map((s) => ({
      id: s.id as string,
      template: s.template as string,
    })),
  };
}

function sanitizeGuidedDiscovery(ak: AKInput): ExerciseSpec {
  const steps = (ak.steps || []) as Array<AKInput>;
  return {
    type: 'guided-discovery',
    label: '',
    gdTitle: ak.title as string,
    gdSteps: steps.map(step => {
      const stepType = step.type as 'observation_choice' | 'formula_blanks' | 'derivation_blank' | 'text_blanks';
      const base = { type: stepType, id: step.id as string, title: step.title as string };
      switch (stepType) {
        case 'observation_choice':
          // Intentionally preserve `correct` — binary 2-option choices have negligible
          // answer leakage, and this enables instant client-side feedback without a
          // server round-trip (same rationale as select-evidence keeping correctFunction).
          return {
            ...base,
            table: step.table as Array<{ expression: string; result: string }> | undefined,
            highlights: step.highlights,
            choices: ((step.choices || []) as Array<AKInput>).map(c => ({
              id: c.id as string,
              prompt: c.prompt as string,
              options: c.options as string[],
              correct: c.correct as number,
            })),
            ...(step.conclusion && { conclusion: step.conclusion as string }),
          };
        case 'formula_blanks':
          return {
            ...base,
            ...(step.prompt && { prompt: step.prompt as string }),
            blanks: ((step.blanks || []) as Array<AKInput>).map(b => ({
              id: b.id as string,
              label: b.label as string,
              ...(b.placeholder && { placeholder: b.placeholder as string }),
              ...(b.inputMethods && { inputMethods: b.inputMethods as string[] }),
            })),
            ...(step.inputMethods && { inputMethods: step.inputMethods as string[] }),
          };
        case 'derivation_blank':
          return {
            ...base,
            lines: ((step.lines || []) as Array<AKInput>).map(l => ({
              text: l.text as string,
              ...(l.blank && {
                blank: {
                  id: (l.blank as AKInput).id as string,
                  ...((l.blank as AKInput).placeholder && { placeholder: (l.blank as AKInput).placeholder as string }),
                  ...((l.blank as AKInput).inputMethods && { inputMethods: (l.blank as AKInput).inputMethods as string[] }),
                },
              }),
            })),
            ...(step.inputMethods && { inputMethods: step.inputMethods as string[] }),
          };
        case 'text_blanks':
          return {
            ...base,
            template: step.template as string,
            textBlanks: ((step.blanks || []) as Array<AKInput>).map(b => ({
              id: b.id as string,
              ...(b.inputMethods && { inputMethods: b.inputMethods as string[] }),
            })),
            ...(step.inputMethods && { inputMethods: step.inputMethods as string[] }),
          };
        default:
          return base;
      }
    }),
    ...(ak.summary && { gdSummary: ak.summary as { formula?: string; name?: string; description?: string } }),
  };
}

function sanitizeMap(ak: AKInput, practiceItemIds?: string[]): ExerciseSpec {
  const rawAxes = ak.axes as Record<string, Record<string, string>> | undefined;
  const items = (ak.items as Array<AKInput>) || [];
  const practiceCount = ak.practiceCount as number | undefined;
  const expected = ak.expected as Record<string, [number, number]> | undefined;

  let givenPlacements: Record<string, { x: number; y: number }> | undefined;

  if (practiceItemIds && expected) {
    // Random practice mode: practiceItemIds specifies which items are interactive
    const practiceSet = new Set(practiceItemIds);
    givenPlacements = {};
    for (const it of items) {
      const id = it.id as string;
      if (!practiceSet.has(id) && expected[id]) {
        givenPlacements[id] = { x: expected[id][0], y: expected[id][1] };
      }
    }
  } else if (practiceCount && practiceCount < items.length && expected) {
    // Sequential mode: first N items are practice, rest are given
    givenPlacements = {};
    for (let i = practiceCount; i < items.length; i++) {
      const id = items[i].id as string;
      if (expected[id]) {
        givenPlacements[id] = { x: expected[id][0], y: expected[id][1] };
      }
    }
  }

  return {
    type: 'map',
    label: '',
    prompt: ak.prompt as string,
    axes: rawAxes ? {
      x: { neg: rawAxes.x.neg, pos: rawAxes.x.pos, label: rawAxes.x.label },
      y: { neg: rawAxes.y.neg, pos: rawAxes.y.pos, label: rawAxes.y.label },
    } : undefined,
    mapItems: items.map(it => ({
      id: it.id as string,
      label: it.label as string,
      ...(it.hint && { hint: it.hint as string }),
      ...(it.refs && { refs: it.refs as number[] }),
    })),
    minReasonLength: (ak.minReasonLength as number) || 8,
    ...(practiceCount && { practiceCount }),
    ...(practiceItemIds && { practiceItemIds }),
    ...(givenPlacements && Object.keys(givenPlacements).length > 0 && { givenPlacements }),
  };
}

/**
 * Sanitize a full manifest — strip answerKey data from readingSteps.
 * Returns a deep clone with answers removed.
 */
export function sanitizeManifest(manifest: unknown): unknown {
  if (!manifest) return manifest;

  const clone = JSON.parse(JSON.stringify(manifest));
  const steps: Array<Record<string, unknown>> = clone.readingSteps || [];

  for (const step of steps) {
    if (step.answerKey) {
      const spec = sanitizeAnswerKey(step.answerKey, step.exerciseLabel as string | undefined);
      if (spec) {
        step.answerKey = spec;
      }
    }
    if (step.discoveryKey) {
      const spec = sanitizeAnswerKey(step.discoveryKey);
      if (spec) {
        step.discoveryKey = spec;
      }
    }
    if (step.discuss && typeof step.discuss === 'object') {
      const d = step.discuss as Record<string, unknown>;
      delete d.systemPrompt;
      delete d.goal;
    }
  }

  return clone;
}
