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
 * must be free of NestJS, framework, and solution-domain imports.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ONTOLOGY_VERSION } from '../index.js';

const SRC = join(__dirname, '..');
const REPO_PKG_PREFIX = '@kedge-agentic/';

/** Recursively collect every `.ts` file under `src/`, excluding tests. */
function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      collectSourceFiles(full, out);
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

const sourceFiles = collectSourceFiles(SRC);

/** Permitted runtime + dev imports for this package. Anything else is suspect. */
const ALLOWED_PACKAGES = new Set<string>([
  'zod',
  'zod-to-json-schema',
  // Node builtins
  'node:crypto',
  'node:fs',
  'node:path',
]);

/** Find every real `import ... from '<spec>'` / `export ... from '<spec>'` in a source file. */
function importSpecs(file: string): string[] {
  let text = readFileSync(file, 'utf8');
  // Strip /* ... */ blocks (including JSDoc) so example imports in
  // comments don't trip the scanner.
  text = text.replace(/\/\*[\s\S]*?\*\//g, '');
  // Real import/export statements only — must start the line (or
  // follow only whitespace), preventing matches inside string
  // literals or trailing prose.
  const re = /^\s*(?:import|export)\b[^'"]*?\bfrom\s+['"]([^'"]+)['"]/gm;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push(m[1]);
  return out;
}

describe('package skeleton', () => {
  it('loads and exports a version constant', () => {
    expect(ONTOLOGY_VERSION).toBe('0.1.0');
  });

  it('collects a non-empty set of source files (sanity)', () => {
    expect(sourceFiles.length).toBeGreaterThan(10);
  });
});

describe('framework-free contract', () => {
  it('no source file imports @nestjs/*', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles) {
      for (const spec of importSpecs(file)) {
        if (spec.startsWith('@nestjs/')) {
          offenders.push(`${relative(SRC, file)} → ${spec}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no source file imports React, Vue, or other UI frameworks', () => {
    const banned = ['react', 'react-dom', 'vue', '@vue/', 'svelte'];
    const offenders: string[] = [];
    for (const file of sourceFiles) {
      for (const spec of importSpecs(file)) {
        if (banned.some((b) => spec === b || spec.startsWith(b + '/'))) {
          offenders.push(`${relative(SRC, file)} → ${spec}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('no cross-package coupling', () => {
  it('does not import any other @kedge-agentic/* package', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles) {
      for (const spec of importSpecs(file)) {
        if (spec.startsWith(REPO_PKG_PREFIX)) {
          offenders.push(`${relative(SRC, file)} → ${spec}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('does not reference solutions/ paths', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles) {
      for (const spec of importSpecs(file)) {
        if (spec.includes('solutions/')) {
          offenders.push(`${relative(SRC, file)} → ${spec}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('runtime dependency allowlist', () => {
  it('every non-relative import is in the allowlist', () => {
    const offenders: { file: string; spec: string }[] = [];
    for (const file of sourceFiles) {
      for (const spec of importSpecs(file)) {
        if (spec.startsWith('.') || spec.startsWith('/')) continue;
        if (!ALLOWED_PACKAGES.has(spec)) {
          offenders.push({ file: relative(SRC, file), spec });
        }
      }
    }
    // If this fires, either add the dep to ALLOWED_PACKAGES intentionally
    // (after asking yourself "should an ontology really depend on this?")
    // or remove the import.
    expect(offenders).toEqual([]);
  });
});
