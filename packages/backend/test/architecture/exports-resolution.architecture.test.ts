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
const HANDLER_PKG_ROOT = join(
  REPO_ROOT,
  'solutions/business/live-lesson/platform-handlers',
);
const HANDLER_SCAN_ROOTS = [
  join(HANDLER_PKG_ROOT, 'src'),
  // Pass-2 S1: also walk the handler's test/ tree — test-database.ts
  // imports 28 entity subpaths and a future refactor that collapses
  // an entity directory into a barrel re-export would silently break
  // those imports without this scan covering them.
  join(HANDLER_PKG_ROOT, 'test'),
];
const BACKEND_DIST = join(REPO_ROOT, 'packages/backend/dist/src');

function distExists(): boolean {
  return existsSync(BACKEND_DIST) && statSync(BACKEND_DIST).isDirectory();
}

function collectSubpaths(handlerScanRoots: readonly string[]): Set<string> {
  // Find every `@kedge-agentic/backend/<subpath>` mentioned in source
  // (.ts files, excluding compiled .d.ts under dist/).
  const out = new Set<string>();
  const pattern = /['"]@kedge-agentic\/backend\/([^'"]+)['"]/g;
  for (const root of handlerScanRoots) {
    if (!existsSync(root)) continue;
    const files = execSync(
      `find "${root}" -type f -name '*.ts' -not -name '*.d.ts'`,
      { encoding: 'utf8' },
    )
      .split('\n')
      .filter(Boolean);
    for (const file of files) {
      const body = readFileSync(file, 'utf8');
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(body)) !== null) {
        out.add(match[1]);
      }
    }
  }
  return out;
}

const HAS_DIST = distExists();
const SUBPATHS = HAS_DIST
  ? Array.from(collectSubpaths(HANDLER_SCAN_ROOTS)).sort()
  : [];

const describeOrSkip =
  HAS_DIST && SUBPATHS.length > 0 ? describe : describe.skip;

describeOrSkip('@kedge-agentic/backend npm exports map (handler scan roots)', () => {
  it.each(SUBPATHS)(
    'subpath "@kedge-agentic/backend/%s" resolves at runtime via require.resolve',
    (subpath) => {
      // Use Node's require.resolve from the handler package's directory so
      // node_modules walks find the workspace symlink + honor the exports
      // map. If a directory-shaped subpath (e.g. `workflow/types`) is
      // missing from exports, this throws MODULE_NOT_FOUND.
      const resolved = require.resolve(`@kedge-agentic/backend/${subpath}`, {
        paths: [HANDLER_PKG_ROOT],
      });
      expect(resolved).toMatch(/packages\/backend\/dist\/src\//);
    },
  );
});

// Surface the skip reason in jest output so a contributor sees the path
// rather than a silent absent suite.
if (!HAS_DIST) {
  describe('@kedge-agentic/backend npm exports map', () => {
    it.skip('SKIPPED — backend dist not built; run `npm run build:backend` first', () => {});
  });
} else if (SUBPATHS.length === 0) {
  describe('@kedge-agentic/backend npm exports map', () => {
    it.skip('SKIPPED — handler scan found 0 @kedge-agentic/backend imports (handler package empty?)', () => {});
  });
}
