import type { LoadedBundle, Story } from '../core/types';

/**
 * Optional grader hook attached to a plugin reference.
 *
 * Plugins can extend `PreviewPluginRef` with a `grade` function for the preview
 * runtime to call. If not provided, the preview returns a stub result and the
 * grading is considered "not implemented" for that story.
 *
 * In production / live-lesson the real grade happens server-side via NestJS DI.
 * In preview we don't ship NestJS — plugin authors pass in a thin grade function.
 */
export interface PluginGradeFn {
  (input: {
    answerKey: Record<string, unknown>;
    data: Record<string, unknown>;
  }): unknown | Promise<unknown>;
}

interface GradeablePlugin {
  type: string;
  grade?: PluginGradeFn;
}

export interface GradeResult {
  ok: true;
  total?: number;
  byDimension?: Record<string, unknown>;
  raw: unknown;
  durationMs: number;
}

export interface GradeError {
  ok: false;
  reason: 'no-grade-fn' | 'threw';
  message?: string;
  durationMs: number;
}

/**
 * Run a story's plugin.grade against the supplied student data.
 * Returns a uniform result shape with timing.
 */
export async function runGrade(
  bundle: LoadedBundle,
  story: Story,
  data: Record<string, unknown>,
): Promise<GradeResult | GradeError> {
  const plugin = bundle.plugin as GradeablePlugin;
  const t0 = Date.now();
  if (typeof plugin.grade !== 'function') {
    return {
      ok: false,
      reason: 'no-grade-fn',
      message: `Plugin "${plugin.type}" does not export a grade function`,
      durationMs: Date.now() - t0,
    };
  }
  try {
    const raw = await plugin.grade({ answerKey: story.answerKey, data });
    const r = (raw as { total?: number; byDimension?: Record<string, unknown> }) || {};
    return {
      ok: true,
      total: typeof r.total === 'number' ? r.total : undefined,
      byDimension: r.byDimension,
      raw,
      durationMs: Date.now() - t0,
    };
  } catch (err) {
    return {
      ok: false,
      reason: 'threw',
      message: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - t0,
    };
  }
}
