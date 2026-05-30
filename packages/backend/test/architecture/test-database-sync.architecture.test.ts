/**
 * Architecture spec — guards the TEST_ENTITIES list duplication
 * between backend's test/setup/test-database.ts and the handler
 * package's test/setup/test-database.ts.
 *
 * Phase 5.5 pass-1 review N2: when phase 5.5 carved the live-lesson
 * handler bundle into its own workspace package, the handler's jest
 * specs needed an equivalent in-memory TypeORM helper. Rather than
 * making the handler depend on backend's test/ tree (which lives
 * outside the npm `exports` surface), we duplicated the entity list
 * with a docstring sync warning. This spec turns the warning into
 * a hard failure: if backend adds a new entity to TEST_ENTITIES
 * without mirroring it in the handler's list, this test catches it
 * before the PR lands.
 *
 * Implementation note: the handler's test-database.ts isn't included
 * in handler's npm-exported dist (it lives under `test/`, not `src/`),
 * AND ts-jest evaluating its TypeScript fails because backend's
 * tsconfig has no `@kedge-agentic/backend/*` path mapping. So we
 * parse the entity names out of BOTH files as text — no compilation.
 *
 * If you intentionally diverge the lists, adjust BOTH files + update
 * the expected diff list below.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..');
const BACKEND_FILE = resolve(REPO_ROOT, 'packages/backend/test/setup/test-database.ts');
const HANDLER_FILE = resolve(
  REPO_ROOT,
  'solutions/business/live-lesson/platform-handlers/test/setup/test-database.ts',
);

function extractEntityNames(absPath: string): string[] {
  if (!existsSync(absPath)) return [];
  const body = readFileSync(absPath, 'utf8');
  // Capture the `TEST_ENTITIES = [ ... ];` array body, then split on commas.
  const match = body.match(/TEST_ENTITIES\s*=\s*\[([^\]]+)\]/);
  if (!match) return [];
  return match[1]
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && /^[A-Z][A-Za-z0-9_]*$/.test(s))
    .sort();
}

describe('test-database TEST_ENTITIES — backend vs handler package sync', () => {
  const backendEntities = extractEntityNames(BACKEND_FILE);
  const handlerEntities = extractEntityNames(HANDLER_FILE);

  it('backend file parses to a non-empty entity list', () => {
    expect(backendEntities.length).toBeGreaterThan(0);
  });

  it('handler file parses to a non-empty entity list', () => {
    expect(handlerEntities.length).toBeGreaterThan(0);
  });

  it('counts match — divergence means one side forgot to mirror a new entity', () => {
    expect(handlerEntities.length).toBe(backendEntities.length);
  });

  it('every entity on backend\'s list is on handler\'s list (and vice versa)', () => {
    const backendSet = new Set(backendEntities);
    const handlerSet = new Set(handlerEntities);
    const missingFromHandler = backendEntities.filter((n) => !handlerSet.has(n));
    const missingFromBackend = handlerEntities.filter((n) => !backendSet.has(n));
    expect({ missingFromHandler, missingFromBackend }).toEqual({
      missingFromHandler: [],
      missingFromBackend: [],
    });
  });
});
