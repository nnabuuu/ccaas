import type { DefineStoriesArgs, StoriesFile } from './types';

/**
 * Define a stories file for a plugin.
 *
 * Use as the default export of a `*.stories.ts` file:
 *
 * @example
 * ```ts
 * import { defineStories } from '@kedge-agentic/exercise-preview';
 * import { longDivisionPlugin } from './long-division.plugin';
 *
 * export default defineStories({
 *   plugin: longDivisionPlugin,
 *   meta: {
 *     title: 'Long Division',
 *     description: 'Polynomial long division for grade 8',
 *     tags: ['math', 'grade-8'],
 *   },
 * });
 *
 * export const Default: Story = { name: 'Default', answerKey: {...} };
 * export const WrongAnswer: Story = { name: 'Wrong answer', answerKey: {...} };
 * ```
 *
 * The StoryLoader will:
 *   1. Import the module
 *   2. Read `default` to get the plugin + meta
 *   3. Read all named exports matching the Story shape
 *
 * Stories with names starting with `_` are ignored (private helpers).
 */
export function defineStories(args: DefineStoriesArgs): StoriesFile {
  if (!args.plugin) {
    throw new Error('defineStories: `plugin` is required');
  }
  if (!args.plugin.type) {
    throw new Error('defineStories: `plugin.type` is required');
  }
  if (!args.meta) {
    throw new Error('defineStories: `meta` is required');
  }
  if (!args.meta.title) {
    throw new Error('defineStories: `meta.title` is required');
  }

  return {
    plugin: args.plugin,
    meta: args.meta,
    __brand: 'kedge-agentic-exercise-preview-stories',
  };
}

/**
 * Type guard for stories files (used by StoryLoader to validate default exports).
 */
export function isStoriesFile(value: unknown): value is StoriesFile {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as StoriesFile).__brand === 'kedge-agentic-exercise-preview-stories'
  );
}

/**
 * Type guard for Story objects (used by StoryLoader to filter named exports).
 * A valid Story has at minimum `name: string` and `answerKey: object`.
 */
export function isStory(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.name === 'string' &&
    typeof v.answerKey === 'object' &&
    v.answerKey !== null
  );
}
