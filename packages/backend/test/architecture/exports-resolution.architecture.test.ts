/**
 * Architecture spec — guards the NPM `exports` map on
 * `@kedge-agentic/backend/package.json`.
 *
 * Phase 5.5 review (pass-1 M1) discovered that `workflow/types` was
 * NOT in the exports map even though handler services import from it
 * (with `import type`, which TS erases — so typecheck + jest were
 * green while a future value-import would explode at runtime with
 * `MODULE_NOT_FOUND`). This spec extracts every distinct
 * `@kedge-agentic/backend/<subpath>` import from the live-lesson
 * handler package's TypeScript source and asserts each resolves
 * via Node's `require.resolve()` against the BUILT backend dist.
 *
 * What this catches:
 *   - directory-shaped subpaths whose `index.js` is masked by the
 *     wildcard `./*` rule (which maps them to a non-existent file)
 *   - subpaths whose dist file vanished after a backend refactor
 *
 * What this does NOT catch:
 *   - handler-source imports that are entirely new and only used as
 *     `import type` (TypeScript erases them, so no runtime resolution
 *     happens). This is fine — those don't break boot. Tests at the
 *     consuming jest run still catch the breakage when a value-import
 *     is added.
 *
 * Skipped on a fresh checkout when backend dist isn't built yet; the
 * jest output prints the reason so a contributor sees the skip path.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execSync } from 'node:child_process';

const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..');
const HANDLER_SRC = join(
  REPO_ROOT,
  'solutions/business/live-lesson/platform-handlers/src',
);
const BACKEND_DIST = join(REPO_ROOT, 'packages/backend/dist/src');

function distExists(): boolean {
  return existsSync(BACKEND_DIST) && statSync(BACKEND_DIST).isDirectory();
}

function collectSubpaths(handlerSrcRoot: string): Set<string> {
  // Find every `@kedge-agentic/backend/<subpath>` mentioned in source
  // (.ts files, excluding compiled .d.ts under dist/).
  const out = new Set<string>();
  const files = execSync(
    `find "${handlerSrcRoot}" -type f -name '*.ts' -not -name '*.d.ts'`,
    { encoding: 'utf8' },
  )
    .split('\n')
    .filter(Boolean);
  const pattern = /['"]@kedge-agentic\/backend\/([^'"]+)['"]/g;
  for (const file of files) {
    const body = readFileSync(file, 'utf8');
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(body)) !== null) {
      out.add(match[1]);
    }
  }
  return out;
}

describe('@kedge-agentic/backend npm exports map', () => {
  const subpaths = distExists()
    ? Array.from(collectSubpaths(HANDLER_SRC)).sort()
    : [];

  if (!distExists()) {
    it.skip('SKIPPED — backend dist not built; run `npm run build:backend` first', () => {
      // Skipped via it.skip
    });
    return;
  }

  if (subpaths.length === 0) {
    it.skip('SKIPPED — no @kedge-agentic/backend subpath imports found in handler src (handler package likely empty or deleted)', () => {
      // Skipped via it.skip
    });
    return;
  }

  it.each(subpaths)(
    'subpath "@kedge-agentic/backend/%s" resolves at runtime via require.resolve',
    (subpath) => {
      // Use Node's require.resolve from the handler package's directory so
      // node_modules walks find the workspace symlink + honor the exports
      // map. If a directory-shaped subpath (e.g. `workflow/types`) is
      // missing from exports, this throws MODULE_NOT_FOUND.
      const handlerPkgDir = join(REPO_ROOT, 'solutions/business/live-lesson/platform-handlers');
      const resolved = require.resolve(`@kedge-agentic/backend/${subpath}`, {
        paths: [handlerPkgDir],
      });
      expect(resolved).toMatch(/packages\/backend\/dist\/src\//);
    },
  );
});
