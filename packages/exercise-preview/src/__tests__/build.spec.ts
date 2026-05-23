import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { buildStaticDemo } from '../cli/build';

describe('buildStaticDemo', () => {
  let tmpCwd: string;
  let tmpOut: string;

  beforeEach(() => {
    tmpCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-build-cwd-'));
    tmpOut = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-build-out-'));
  });

  afterEach(() => {
    fs.rmSync(tmpCwd, { recursive: true, force: true });
    fs.rmSync(tmpOut, { recursive: true, force: true });
  });

  it('writes catalog.json, shortcodes.json, index.html, and per-story pages', async () => {
    // Write a minimal stories.mjs (so we don't need TS transform in the test process)
    const storiesPath = path.join(tmpCwd, 'quiz.stories.mjs');
    fs.writeFileSync(
      storiesPath,
      `
import { defineStories } from '${path.resolve(__dirname, '..', '..', 'dist', 'index.js')}';
const plugin = { type: 'quiz', displayName: 'Quiz' };
const meta = { title: 'Quiz Bundle', description: 'Test bundle' };
export default defineStories({ plugin, meta });
export const Default = { name: 'Default', answerKey: { type: 'quiz', correct: 1 }, initialAns: { answers: [0] } };
export const Wrong = { name: 'Wrong Answer', answerKey: { type: 'quiz', correct: 1 }, initialAns: { answers: [0] } };
`,
    );

    const result = await buildStaticDemo({ cwd: tmpCwd, outDir: tmpOut });
    expect(result.bundleCount).toBe(1);
    expect(result.storyCount).toBe(2);
    expect(fs.existsSync(path.join(tmpOut, 'index.html'))).toBe(true);
    expect(fs.existsSync(path.join(tmpOut, 'catalog.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpOut, 'shortcodes.json'))).toBe(true);

    const catalog = JSON.parse(fs.readFileSync(path.join(tmpOut, 'catalog.json'), 'utf-8'));
    expect(catalog).toHaveLength(1);
    expect(catalog[0].bundleId).toBe('quiz');
    expect(catalog[0].stories).toHaveLength(2);

    const shortCodes = JSON.parse(fs.readFileSync(path.join(tmpOut, 'shortcodes.json'), 'utf-8'));
    const codes = Object.keys(shortCodes);
    expect(codes).toHaveLength(2);
    for (const code of codes) {
      expect(fs.existsSync(path.join(tmpOut, 'p', code, 'index.html'))).toBe(true);
    }

    // Short codes are deterministic — running again yields same codes
    const result2 = await buildStaticDemo({ cwd: tmpCwd, outDir: tmpOut });
    expect(Object.keys(result2.shortCodes).sort()).toEqual(codes.sort());
  });

  it('skips stories with skipInDemo: true', async () => {
    fs.writeFileSync(
      path.join(tmpCwd, 'quiz.stories.mjs'),
      `
import { defineStories } from '${path.resolve(__dirname, '..', '..', 'dist', 'index.js')}';
export default defineStories({ plugin: { type: 'quiz' }, meta: { title: 'Quiz' } });
export const Shown = { name: 'Shown', answerKey: { type: 'quiz' } };
export const Hidden = { name: 'Hidden', answerKey: { type: 'quiz' }, skipInDemo: true };
`,
    );
    const result = await buildStaticDemo({ cwd: tmpCwd, outDir: tmpOut });
    expect(result.storyCount).toBe(1);
    expect(Object.keys(result.shortCodes)).toHaveLength(1);
  });

  it('throws when no bundles found', async () => {
    await expect(buildStaticDemo({ cwd: tmpCwd, outDir: tmpOut })).rejects.toThrow(/No bundles/);
  });
});
