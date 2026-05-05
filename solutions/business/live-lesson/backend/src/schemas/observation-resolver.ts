import { ObservationDefSchema, type ObserveDimension, type ObserveIssueRule, type ObserveSurface, type ObservationDef } from './observation.schema';

export interface ResolvedObserve {
  dimensions: ObserveDimension[];
  issueRules: ObserveIssueRule[];
  surfaces: ObserveSurface[];
  dimensionNameMap: Record<string, string>;
}

/** Minimal manifest shape accepted by buildRegistry */
interface ManifestLike {
  observations?: Record<string, unknown>;
  observeDefinitions?: Record<string, unknown>;
  observationIndicators?: Array<{ id: string; type: string; label: string; description: string }>;
}

/**
 * Build a unified registry from any manifest format.
 * Priority: observations > observeDefinitions > observationIndicators
 */
export function buildRegistry(manifest: ManifestLike | null | undefined): Record<string, ObservationDef> {
  const registry: Record<string, ObservationDef> = {};
  if (!manifest) return registry;

  // Highest priority: new unified `observations`
  for (const [id, raw] of Object.entries(manifest.observations || {})) {
    const parsed = ObservationDefSchema.safeParse(raw);
    if (parsed.success) registry[id] = parsed.data;
  }

  // Legacy: observeDefinitions → inject if not already in registry
  for (const [id, raw] of Object.entries(manifest.observeDefinitions || {})) {
    if (registry[id]) continue;
    const parsed = ObservationDefSchema.safeParse(raw);
    if (parsed.success) registry[id] = parsed.data;
  }

  // Legacy: observationIndicators → convert to ObservationDef shape
  for (const ind of manifest.observationIndicators || []) {
    if (registry[ind.id]) continue;
    const parsed = ObservationDefSchema.safeParse({
      id: ind.id, type: ind.type, label: ind.label, description: ind.description,
    });
    if (parsed.success) registry[ind.id] = parsed.data;
  }

  return registry;
}

/**
 * Extract global observations for the LLM pipeline (those with a `type` field).
 */
export function resolveGlobalObservations(manifest: ManifestLike | null | undefined): ObservationDef[] {
  return Object.values(buildRegistry(manifest)).filter(d => d.type);
}

/**
 * Resolve observe definitions for a reading step.
 *
 * Priority:
 * 1. stepDef.observe exists → resolve $ref / inline definitions, merge
 * 2. stepDef.observe absent → auto-generate from answerKey
 */
export function resolveObserve(
  stepDef: { answerKey?: Record<string, unknown>; observe?: unknown } | undefined,
  registry?: Record<string, ObservationDef>,
): ResolvedObserve {
  const empty: ResolvedObserve = { dimensions: [], issueRules: [], surfaces: [], dimensionNameMap: {} };
  if (!stepDef) return empty;

  if (stepDef.observe) {
    return resolveExplicit(stepDef.observe, registry || {});
  }

  if (stepDef.answerKey) {
    return autoGenerate(stepDef.answerKey);
  }

  return empty;
}

// ── Explicit resolution ($ref + inline) ──

function resolveExplicit(
  observe: unknown,
  registry: Record<string, ObservationDef>,
): ResolvedObserve {
  // Single inline definition
  if (!Array.isArray(observe) && typeof observe === 'object' && observe !== null && 'dimensions' in observe) {
    return toResolved(observe as Partial<ObservationDef>);
  }

  // Array of $ref strings and/or inline definitions
  if (!Array.isArray(observe)) return { dimensions: [], issueRules: [], surfaces: [], dimensionNameMap: {} };

  const merged: ResolvedObserve = { dimensions: [], issueRules: [], surfaces: [], dimensionNameMap: {} };

  for (const entry of observe as Array<string | Partial<ObservationDef>>) {
    if (typeof entry === 'string' && entry.startsWith('$ref:')) {
      const refId = entry.slice(5);
      const def = registry[refId];
      if (def) {
        mergeInto(merged, toResolved(def));
      }
    } else if (typeof entry === 'object' && entry !== null && 'dimensions' in entry) {
      mergeInto(merged, toResolved(entry));
    }
  }

  return merged;
}

function toResolved(def: Partial<ObservationDef>): ResolvedObserve {
  const dimensions: ObserveDimension[] = (def.dimensions || []).map(d => ({
    key: d.key,
    label: d.label,
    labelTemplate: d.labelTemplate,
    type: d.type || 'boolean',
    group: d.group,
  }));
  const issueRules: ObserveIssueRule[] = (def.issueRules || []).map(r => ({
    dimension: r.dimension,
    condition: r.condition,
    threshold: r.threshold,
    template: r.template,
  }));
  const surfaces: ObserveSurface[] = (def.surfaces || []).map(s => ({
    type: s.type,
    source: s.source,
    label: s.label,
  }));
  return { dimensions, issueRules, surfaces, dimensionNameMap: buildNameMap(dimensions) };
}

function mergeInto(target: ResolvedObserve, source: ResolvedObserve): void {
  const existingKeys = new Set(target.dimensions.map(d => d.key));
  for (const d of source.dimensions) {
    if (!existingKeys.has(d.key)) {
      target.dimensions.push(d);
      target.dimensionNameMap[d.key] = d.label;
      existingKeys.add(d.key);
    }
  }
  target.issueRules.push(...source.issueRules);
  target.surfaces.push(...source.surfaces);
}

// ── Auto-generation from answerKey ──

interface AnswerKeyLike extends Record<string, unknown> {
  type: string;
}

function autoGenerate(answerKey: Record<string, unknown>): ResolvedObserve {
  const key = answerKey as AnswerKeyLike;
  switch (key.type) {
    case 'quiz': return autoGenerateQuiz(key);
    case 'match': return autoGenerateMatch(key);
    case 'matrix': return autoGenerateMatrix();
    case 'stance': return autoGenerateStance();
    case 'order': return autoGenerateOrder();
    case 'select-evidence': return autoGenerateSelectEvidence(key);
    case 'map': return autoGenerateMap(key);
    default: return { dimensions: [], issueRules: [], surfaces: [], dimensionNameMap: {} };
  }
}

function autoGenerateQuiz(key: AnswerKeyLike): ResolvedObserve {
  const answers = (key.answers || []) as Array<{ questionIdx: number; label?: string }>;
  const dimensions: ObserveDimension[] = answers.map(a => ({
    key: `q${a.questionIdx}`,
    label: a.label || `Q${a.questionIdx + 1}`,
    type: 'boolean' as const,
  }));
  return { dimensions, issueRules: [], surfaces: [], dimensionNameMap: buildNameMap(dimensions) };
}

function autoGenerateMatch(key: AnswerKeyLike): ResolvedObserve {
  const answers = (key.answers || []) as Array<{ pairIdx: number; left?: string; correct?: string }>;
  const dimensions: ObserveDimension[] = answers.map(a => ({
    key: `p${a.pairIdx}`,
    label: a.left ? `${a.left}\u2192${a.correct}` : `P${a.pairIdx + 1}`,
    type: 'boolean' as const,
  }));
  return { dimensions, issueRules: [], surfaces: [], dimensionNameMap: buildNameMap(dimensions) };
}

function autoGenerateMatrix(): ResolvedObserve {
  const dimensions: ObserveDimension[] = [
    { key: 'place', label: 'Where', type: 'boolean' },
    { key: 'practice', label: 'What', type: 'boolean' },
    { key: 'reason', label: 'Why', type: 'boolean' },
  ];
  return { dimensions, issueRules: [], surfaces: [], dimensionNameMap: buildNameMap(dimensions) };
}

function autoGenerateStance(): ResolvedObserve {
  const dimensions: ObserveDimension[] = [
    { key: 'position', label: 'Position', type: 'boolean' },
    { key: 'evidence', label: 'Evidence', type: 'boolean' },
  ];
  return { dimensions, issueRules: [], surfaces: [], dimensionNameMap: buildNameMap(dimensions) };
}

function autoGenerateOrder(): ResolvedObserve {
  const dimensions: ObserveDimension[] = [
    { key: 'correct', label: 'Correct', type: 'boolean' },
  ];
  return { dimensions, issueRules: [], surfaces: [], dimensionNameMap: buildNameMap(dimensions) };
}

function autoGenerateSelectEvidence(key: AnswerKeyLike): ResolvedObserve {
  const sections = (key.sections || []) as Array<{ id: string; label: string }>;
  const dimensions: ObserveDimension[] = sections.map(s => ({
    key: `${s.id}_func`,
    label: `${s.label} Function`,
    type: 'boolean' as const,
    group: s.id,
  }));
  const issueRules: ObserveIssueRule[] = [
    { dimension: '*_func', condition: 'wrong_pct_gte', threshold: 30, template: '{count} 人 {label} 功能判断错误' },
  ];
  return { dimensions, issueRules, surfaces: [], dimensionNameMap: buildNameMap(dimensions) };
}

function autoGenerateMap(key: AnswerKeyLike): ResolvedObserve {
  const items = (key.items || []) as Array<{ id: string; label: string }>;
  const dimensions: ObserveDimension[] = items.flatMap(item => [
    { key: `${item.id}_placed`, label: `${item.label} \u2014 Placed`, type: 'boolean' as const, group: item.id },
    { key: `${item.id}_reasoned`, label: `${item.label} \u2014 Reasoning`, type: 'boolean' as const, group: item.id },
    { key: `${item.id}_positionScore`, label: `${item.label} \u2014 Position`, type: 'score' as const, group: item.id },
  ]);
  const issueRules: ObserveIssueRule[] = [
    { dimension: '*_placed', condition: 'wrong_pct_gte', threshold: 30, template: '{count} 人 {label} 未放置' },
    { dimension: '*_reasoned', condition: 'wrong_pct_gte', threshold: 30, template: '{count} 人 {label} 缺少理由' },
    { dimension: '*_positionScore', condition: 'score_lt', threshold: 30, template: '{count} 人 {label} 位置偏差较大' },
  ];
  const surfaces: ObserveSurface[] = [
    { type: 'reasoning', source: 'data.reasons', label: 'Student Reasoning' },
    { type: 'llmFeedback', source: 'score.llmFeedback', label: 'AI 整体评语' },
    { type: 'llmItems', source: 'score.llmItems', label: 'AI 逐项评语' },
    { type: 'positions', source: 'data.placements', label: 'Placement Distribution' },
  ];
  return { dimensions, issueRules, surfaces, dimensionNameMap: buildNameMap(dimensions) };
}

// ── Helpers ──

function buildNameMap(dimensions: ObserveDimension[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const d of dimensions) {
    map[d.key] = d.label;
  }
  return map;
}
