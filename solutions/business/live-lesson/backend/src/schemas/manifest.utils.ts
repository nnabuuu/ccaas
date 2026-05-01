/**
 * Sanitize functions — strip answer data from answerKey/manifest for student consumption.
 * Migrated from classroom/exercise-sanitizer.ts to the shared schemas layer.
 */
import type { ExerciseSpec } from './exercise-spec.schema';

type AKInput = Record<string, unknown>;

export function sanitizeAnswerKey(answerKey: unknown, exerciseLabel?: string): ExerciseSpec | null {
  if (!answerKey || typeof answerKey !== 'object') return null;
  const ak = answerKey as AKInput;
  if (!ak.type || typeof ak.type !== 'string') return null;

  const sanitizer = sanitizers[ak.type];
  if (!sanitizer) return null;

  const spec = sanitizer(ak);
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
      ...(a.isDemo && a.practice && { practice: a.practice as string }),
      ...(a.isDemo && a.reason && { reason: a.reason as string }),
    })),
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

function sanitizeMap(ak: AKInput): ExerciseSpec {
  const rawAxes = ak.axes as Record<string, Record<string, string>> | undefined;
  return {
    type: 'map',
    label: '',
    prompt: ak.prompt as string,
    axes: rawAxes ? {
      x: { neg: rawAxes.x.neg, pos: rawAxes.x.pos, label: rawAxes.x.label },
      y: { neg: rawAxes.y.neg, pos: rawAxes.y.pos, label: rawAxes.y.label },
    } : undefined,
    mapItems: ((ak.items as Array<AKInput>) || []).map(it => ({
      id: it.id as string,
      label: it.label as string,
      ...(it.hint && { hint: it.hint as string }),
      ...(it.refs && { refs: it.refs as number[] }),
    })),
    minReasonLength: (ak.minReasonLength as number) || 8,
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
    if (step.discuss && typeof step.discuss === 'object') {
      const d = step.discuss as Record<string, unknown>;
      delete d.systemPrompt;
      delete d.goal;
    }
  }

  return clone;
}
