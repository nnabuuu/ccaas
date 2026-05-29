/**
 * Architecture tests for `@kedge-agentic/ontology`.
 *
 * Enforces the layering convention from
 * `docs/architecture/package-layering.md`:
 *
 *   "A workspace package's main entry point (`src/index.ts`) MUST be
 *    framework-free, OR the package name MUST carry a framework suffix
 *    (`-react`, `-vue`, `-nest`)."
 *
 * This package has no framework suffix, so every file under `src/`
 * must be free of NestJS, React, Vue, and solution-domain imports.
 *
 * Subsequent commits in Phase 1 expand this file with the full
 * checks once the package has more than a stub `src/index.ts`. For
 * now, this is a smoke test asserting the package loads at all.
 */

import { describe, expect, it } from 'vitest';
import { ONTOLOGY_VERSION } from '../index.js';

describe('package skeleton', () => {
  it('loads and exports a version constant', () => {
    expect(ONTOLOGY_VERSION).toBe('0.1.0');
  });
});
