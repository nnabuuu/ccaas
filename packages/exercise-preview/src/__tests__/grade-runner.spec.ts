import { describe, it, expect } from 'vitest';
import { runGrade } from '../backend/grade-runner';
import { extractBundleFromModule } from '../core/story-loader';
import { defineStories } from '../core/define-stories';
import type { Story } from '../core/types';

function buildBundle(grade?: (...args: unknown[]) => unknown) {
  const defaultExport = defineStories({
    plugin: { type: 'quiz', displayName: 'Quiz', ...(grade ? { grade } : {}) } as Record<
      string,
      unknown
    > as { type: string; displayName?: string },
    meta: { title: 'Quiz Bundle' },
  });
  // Re-attach grade after defineStories since the API doesn't include it
  if (grade) (defaultExport.plugin as Record<string, unknown>).grade = grade;
  const Default: Story = {
    name: 'Default',
    answerKey: {
      type: 'quiz',
      answers: [{ questionIdx: 0, options: ['A', 'B'], correct: 1 }],
    },
  };
  return extractBundleFromModule('/fake/quiz.stories.ts', { default: defaultExport, Default });
}

describe('runGrade', () => {
  it('returns ok=false when plugin has no grade fn', async () => {
    const bundle = buildBundle();
    const result = await runGrade(bundle, bundle.stories.Default, { answers: [1] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no-grade-fn');
  });

  it('returns ok=true with grader result', async () => {
    const grade = ({ data }: { data: Record<string, unknown> }) => {
      const a = (data.answers as number[]) ?? [];
      return { total: a[0] === 1 ? 100 : 0, byDimension: { q0: a[0] === 1 } };
    };
    const bundle = buildBundle(grade);
    const result = await runGrade(bundle, bundle.stories.Default, { answers: [1] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.total).toBe(100);
      expect(result.byDimension).toEqual({ q0: true });
    }
  });

  it('handles async grader', async () => {
    const grade = async () => ({ total: 50 });
    const bundle = buildBundle(grade);
    const result = await runGrade(bundle, bundle.stories.Default, {});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.total).toBe(50);
  });

  it('returns ok=false when grader throws', async () => {
    const grade = () => {
      throw new Error('boom');
    };
    const bundle = buildBundle(grade);
    const result = await runGrade(bundle, bundle.stories.Default, {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('threw');
      expect(result.message).toBe('boom');
    }
  });

  it('records durationMs', async () => {
    const grade = async () => {
      await new Promise((r) => setTimeout(r, 5));
      return { total: 100 };
    };
    const bundle = buildBundle(grade);
    const result = await runGrade(bundle, bundle.stories.Default, {});
    expect(result.durationMs).toBeGreaterThanOrEqual(5);
  });
});
