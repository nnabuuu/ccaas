/**
 * §13 multi-step plugin preview: verify that Story.reviewData flows
 * through the preview server intact, so plugins like guided-discovery /
 * rich-content-quiz can render "start at step N" scenarios.
 */
import { describe, it, expect } from 'vitest';
import { InMemoryState } from '../backend/in-memory-state';
import { defineStories } from '../core/define-stories';
import { extractBundleFromModule } from '../core/story-loader';
import type { Story } from '../core/types';

function makeBundleWithReview() {
  const defaultExport = defineStories({
    plugin: { type: 'guided-discovery' },
    meta: { title: 'GD' },
  });
  const StartAtStep3: Story = {
    name: 'StartAtStep3',
    answerKey: { type: 'guided-discovery', steps: [] },
    reviewData: {
      data: {
        stepAnswers: {
          observation_1: { choices: { c1: 0 } },
          formula_1: { blanks: { b1: 'a^2' } },
        },
        completedStepIds: ['observation_1', 'formula_1'],
      },
      checkItems: [
        { idx: 'observation_1', correct: true },
        { idx: 'formula_1', correct: true },
      ],
    },
    initialPhase: 'idle',
  };
  return extractBundleFromModule('/fake/gd.stories.ts', { default: defaultExport, StartAtStep3 });
}

describe('§13 reviewData propagation', () => {
  it('createSession preserves reviewData on session.story', () => {
    const state = new InMemoryState();
    const bundle = makeBundleWithReview();
    state.registerBundle(bundle);
    const session = state.createSession(bundle, 'StartAtStep3');
    expect(session.story.reviewData).toBeDefined();
    expect(session.story.reviewData?.data.completedStepIds).toEqual(['observation_1', 'formula_1']);
    expect(session.story.reviewData?.checkItems).toHaveLength(2);
  });

  it('reviewData with initialPhase=idle allows continued answering (semantics check)', () => {
    const state = new InMemoryState();
    const bundle = makeBundleWithReview();
    state.registerBundle(bundle);
    const session = state.createSession(bundle, 'StartAtStep3');
    // initialPhase: 'idle' means student can continue, not view-only
    expect(session.story.initialPhase).toBe('idle');
    // ans is empty (student hasn't actively answered yet beyond what review provides)
    expect(session.ans).toEqual({});
  });

  it('story without reviewData works unchanged', () => {
    const defaultExport = defineStories({
      plugin: { type: 'quiz' },
      meta: { title: 'Quiz' },
    });
    const Default: Story = {
      name: 'Default',
      answerKey: { type: 'quiz' },
      initialAns: { answers: [0] },
    };
    const bundle = extractBundleFromModule('/fake/q.stories.ts', { default: defaultExport, Default });
    const state = new InMemoryState();
    state.registerBundle(bundle);
    const session = state.createSession(bundle, 'Default');
    expect(session.story.reviewData).toBeUndefined();
    expect(session.ans).toEqual({ answers: [0] });
  });
});
