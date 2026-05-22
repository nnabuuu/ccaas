import { isStoriesFile, isStory } from './define-stories';
import type { LoadedBundle, Story, StoriesFile } from './types';

/**
 * Extract a LoadedBundle from a stories module's exports.
 *
 * Module shape expected:
 *   - default export: StoriesFile (from defineStories())
 *   - named exports: Story objects (skipped if name starts with `_`)
 *
 * @param filePath Absolute file path of the stories file (for error reporting)
 * @param moduleExports The object returned by `import(file)` or `require(file)`
 */
export function extractBundleFromModule(
  filePath: string,
  moduleExports: Record<string, unknown>,
): LoadedBundle {
  const defaultExport = moduleExports.default;
  if (!isStoriesFile(defaultExport)) {
    throw new Error(
      `[StoryLoader] ${filePath}: default export is not a StoriesFile. ` +
        `Did you forget \`export default defineStories({...})\`?`,
    );
  }
  const storiesFile = defaultExport as StoriesFile;

  const stories: Record<string, Story> = {};
  for (const [exportName, exportValue] of Object.entries(moduleExports)) {
    if (exportName === 'default') continue;
    if (exportName.startsWith('_')) continue;
    if (!isStory(exportValue)) continue;
    stories[exportName] = exportValue as Story;
  }

  return {
    filePath,
    plugin: storiesFile.plugin,
    meta: storiesFile.meta,
    stories,
  };
}

/**
 * StoryLoader — scans a directory tree for *.stories.ts files and loads them.
 *
 * Phase P0 (this file): only provides the pure extraction logic
 * (extractBundleFromModule). Actual filesystem scanning + dynamic import
 * happens in cli/dev-server.ts (Phase P1) which depends on Node fs/import APIs.
 *
 * This separation keeps the core library tree-shakeable and Node-free.
 */
export const StoryLoader = {
  extractBundleFromModule,
};

/**
 * Validate that a LoadedBundle is well-formed (e.g. before serving via API).
 * Returns null if valid, or an error message if invalid.
 */
export function validateBundle(bundle: LoadedBundle): string | null {
  if (!bundle.plugin || !bundle.plugin.type) {
    return `Bundle ${bundle.filePath} has no plugin.type`;
  }
  if (!bundle.meta || !bundle.meta.title) {
    return `Bundle ${bundle.filePath} has no meta.title`;
  }
  if (Object.keys(bundle.stories).length === 0) {
    return `Bundle ${bundle.filePath} has no stories — add at least one named export`;
  }
  for (const [name, story] of Object.entries(bundle.stories)) {
    if (!story.name) return `Story "${name}" in ${bundle.filePath} has no name`;
    if (!story.answerKey || typeof story.answerKey !== 'object') {
      return `Story "${name}" in ${bundle.filePath} has invalid answerKey`;
    }
  }
  return null;
}
