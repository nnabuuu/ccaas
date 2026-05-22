import { describe, it, expect } from 'vitest';
import { defineStories, isStoriesFile, isStory } from '../core/define-stories';

describe('defineStories', () => {
  const fakePlugin = { type: 'quiz', displayName: 'Quiz' };

  it('returns a branded StoriesFile object', () => {
    const result = defineStories({
      plugin: fakePlugin,
      meta: { title: 'Quiz Bundle' },
    });
    expect(result.plugin).toEqual(fakePlugin);
    expect(result.meta.title).toBe('Quiz Bundle');
    expect(result.__brand).toBe('kedge-agentic-exercise-preview-stories');
  });

  it('throws when plugin is missing', () => {
    expect(() =>
      // @ts-expect-error testing runtime guard
      defineStories({ meta: { title: 'X' } }),
    ).toThrow(/plugin.*required/);
  });

  it('throws when plugin.type is missing', () => {
    expect(() =>
      defineStories({
        // @ts-expect-error testing runtime guard
        plugin: { displayName: 'no type' },
        meta: { title: 'X' },
      }),
    ).toThrow(/plugin\.type.*required/);
  });

  it('throws when meta.title is missing', () => {
    expect(() =>
      defineStories({
        plugin: fakePlugin,
        // @ts-expect-error testing runtime guard
        meta: {},
      }),
    ).toThrow(/meta\.title.*required/);
  });
});

describe('isStoriesFile', () => {
  it('returns true for valid stories file', () => {
    const file = defineStories({
      plugin: { type: 'quiz' },
      meta: { title: 'Quiz' },
    });
    expect(isStoriesFile(file)).toBe(true);
  });

  it('returns false for plain objects', () => {
    expect(isStoriesFile({})).toBe(false);
    expect(isStoriesFile({ plugin: {}, meta: {} })).toBe(false);
  });

  it('returns false for null/undefined/primitives', () => {
    expect(isStoriesFile(null)).toBe(false);
    expect(isStoriesFile(undefined)).toBe(false);
    expect(isStoriesFile('story')).toBe(false);
    expect(isStoriesFile(42)).toBe(false);
  });
});

describe('isStory', () => {
  it('returns true for a minimal valid Story', () => {
    expect(isStory({ name: 'Default', answerKey: { type: 'quiz' } })).toBe(true);
  });

  it('returns true for Story with optional fields', () => {
    expect(
      isStory({
        name: 'Default',
        answerKey: { type: 'quiz' },
        initialAns: { answers: [0, 1] },
        initialPhase: 'idle',
        initialRole: 'student',
        notes: 'A note',
      }),
    ).toBe(true);
  });

  it('returns false when name is missing', () => {
    expect(isStory({ answerKey: { type: 'quiz' } })).toBe(false);
  });

  it('returns false when answerKey is missing', () => {
    expect(isStory({ name: 'Default' })).toBe(false);
  });

  it('returns false when answerKey is not an object', () => {
    expect(isStory({ name: 'Default', answerKey: 'not-object' })).toBe(false);
    expect(isStory({ name: 'Default', answerKey: null })).toBe(false);
  });

  it('returns false for null/non-objects', () => {
    expect(isStory(null)).toBe(false);
    expect(isStory(undefined)).toBe(false);
    expect(isStory('foo')).toBe(false);
  });
});
