import { describe, it, expect } from 'vitest';
import { defineStories } from '../core/define-stories';
import {
  extractBundleFromModule,
  validateBundle,
  StoryLoader,
} from '../core/story-loader';
import type { Story } from '../core/types';

const validStoryDefault = defineStories({
  plugin: { type: 'quiz', displayName: 'Quiz' },
  meta: { title: 'Quiz Bundle', tags: ['test'] },
});

const validStory: Story = {
  name: 'Default',
  answerKey: {
    type: 'quiz',
    answers: [
      { questionIdx: 0, questionText: 'Q?', options: ['A', 'B'], correct: 0 },
    ],
  },
};

const wrongAnswerStory: Story = {
  name: 'Wrong Answer',
  answerKey: { type: 'quiz', answers: [] },
  initialAns: { answers: [1] },
};

describe('extractBundleFromModule', () => {
  it('extracts plugin + meta + stories from a valid module', () => {
    const moduleExports = {
      default: validStoryDefault,
      Default: validStory,
      WrongAnswer: wrongAnswerStory,
    };
    const bundle = extractBundleFromModule('/fake/path/quiz.stories.ts', moduleExports);
    expect(bundle.filePath).toBe('/fake/path/quiz.stories.ts');
    expect(bundle.plugin.type).toBe('quiz');
    expect(bundle.meta.title).toBe('Quiz Bundle');
    expect(Object.keys(bundle.stories)).toEqual(['Default', 'WrongAnswer']);
  });

  it('skips named exports starting with underscore', () => {
    const moduleExports = {
      default: validStoryDefault,
      Default: validStory,
      _helper: validStory,
      _internalScenario: validStory,
    };
    const bundle = extractBundleFromModule('/fake/path/quiz.stories.ts', moduleExports);
    expect(Object.keys(bundle.stories)).toEqual(['Default']);
  });

  it('skips named exports that are not Story-shaped', () => {
    const moduleExports = {
      default: validStoryDefault,
      Default: validStory,
      helperFunction: () => null,
      someConst: 'string',
      WrongShape: { name: 'name only' },
    };
    const bundle = extractBundleFromModule('/fake/path/quiz.stories.ts', moduleExports);
    expect(Object.keys(bundle.stories)).toEqual(['Default']);
  });

  it('throws when default export is not a StoriesFile', () => {
    const moduleExports = {
      default: { plugin: { type: 'quiz' }, meta: { title: 'Quiz' } },
      Default: validStory,
    };
    expect(() =>
      extractBundleFromModule('/fake/path/quiz.stories.ts', moduleExports),
    ).toThrow(/default export is not a StoriesFile/);
  });

  it('throws when default export is missing entirely', () => {
    const moduleExports = { Default: validStory };
    expect(() =>
      extractBundleFromModule('/fake/path/quiz.stories.ts', moduleExports),
    ).toThrow(/default export is not a StoriesFile/);
  });

  it('returns empty stories object when no stories exported (still allowed)', () => {
    const moduleExports = { default: validStoryDefault };
    const bundle = extractBundleFromModule('/fake/path/empty.stories.ts', moduleExports);
    expect(bundle.stories).toEqual({});
  });
});

describe('validateBundle', () => {
  it('returns null for a valid bundle', () => {
    const moduleExports = {
      default: validStoryDefault,
      Default: validStory,
    };
    const bundle = extractBundleFromModule('/fake/path/quiz.stories.ts', moduleExports);
    expect(validateBundle(bundle)).toBeNull();
  });

  it('returns error when no stories present', () => {
    const moduleExports = { default: validStoryDefault };
    const bundle = extractBundleFromModule('/fake/path/empty.stories.ts', moduleExports);
    expect(validateBundle(bundle)).toMatch(/no stories/);
  });

  it('returns error when story.answerKey is invalid', () => {
    const moduleExports = {
      default: validStoryDefault,
      Bad: validStory,
    };
    const bundle = extractBundleFromModule('/fake/path/quiz.stories.ts', moduleExports);
    // Inject invalid answerKey post-extraction
    bundle.stories.Bad.answerKey = null as unknown as Record<string, unknown>;
    expect(validateBundle(bundle)).toMatch(/invalid answerKey/);
  });
});

describe('StoryLoader namespace', () => {
  it('exposes extractBundleFromModule', () => {
    expect(typeof StoryLoader.extractBundleFromModule).toBe('function');
  });
});
