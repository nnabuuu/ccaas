import { z } from 'zod';

// ── Observe Dimension ──

export const ObserveDimensionSchema = z.object({
  key: z.string(),
  label: z.string(),
  labelTemplate: z.string().optional(),
  type: z.enum(['boolean', 'score', 'count']).default('boolean'),
  group: z.string().optional(),
});

// ── Issue Rule ──

export const ObserveIssueRuleSchema = z.object({
  dimension: z.string(),
  condition: z.enum(['wrong_pct_gte', 'count_lt', 'score_lt']),
  threshold: z.number(),
  template: z.string(),
});

// ── Surface ──

export const ObserveSurfaceSchema = z.object({
  type: z.enum(['reasoning', 'llmFeedback', 'llmItems', 'positions', 'raw']),
  source: z.string(),
  label: z.string(),
});

// ── Unified Observation Definition ──

export const ObservationDefSchema = z.object({
  id: z.string(),
  label: z.string(),

  // LLM-analysis fields → consumed by ObservationService/ObserverEngine
  type: z.enum(['knowledge', 'misconception']).optional(),
  description: z.string().optional(),

  // Structured-grading fields → consumed by MetricsAggregator
  dimensions: z.array(ObserveDimensionSchema).optional(),
  issueRules: z.array(ObserveIssueRuleSchema).optional(),
  surfaces: z.array(ObserveSurfaceSchema).optional(),
});

/** @deprecated Use ObservationDefSchema — kept for backward compat */
export const ObserveDefinitionSchema = ObservationDefSchema;

// ── Types ──

export type ObserveDimension = z.infer<typeof ObserveDimensionSchema>;
export type ObserveIssueRule = z.infer<typeof ObserveIssueRuleSchema>;
export type ObserveSurface = z.infer<typeof ObserveSurfaceSchema>;
export type ObservationDef = z.infer<typeof ObservationDefSchema>;
/** @deprecated Use ObservationDef */
export type ObserveDefinition = ObservationDef;
