import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { extractBundleFromModule, validateBundle } from '../core/story-loader';
import type { LoadedBundle } from '../core/types';

/**
 * Recursively scan a directory for `*.stories.ts` / `*.stories.js` files
 * and import them as modules.
 *
 * Returns LoadedBundle[] — one per stories file with a valid default export.
 * Invalid files are logged to stderr and skipped.
 */
export async function loadBundlesFromDir(cwd: string): Promise<LoadedBundle[]> {
  const candidates: string[] = [];
  scan(cwd, candidates);

  const loaded: LoadedBundle[] = [];
  for (const file of candidates) {
    try {
      // Dynamic import — works for both ts (when tsx/ts-node is hooked) and compiled js
      const mod = await import(pathToFileURL(file).href);
      const bundle = extractBundleFromModule(file, mod as Record<string, unknown>);
      const err = validateBundle(bundle);
      if (err) {
        console.warn(`[preview] skipping ${file}: ${err}`);
        continue;
      }
      loaded.push(bundle);
    } catch (e) {
      console.warn(`[preview] failed to load ${file}: ${e instanceof Error ? e.message : e}`);
    }
  }
  return loaded;
}

function scan(dir: string, out: string[]): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.') || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scan(full, out);
    } else if (
      entry.isFile() &&
      (entry.name.endsWith('.stories.ts') ||
        entry.name.endsWith('.stories.tsx') ||
        entry.name.endsWith('.stories.js') ||
        entry.name.endsWith('.stories.mjs'))
    ) {
      out.push(full);
    }
  }
}
