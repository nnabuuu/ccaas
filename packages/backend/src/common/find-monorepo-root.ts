/**
 * Monorepo Root Finder
 *
 * Walks up the directory tree to locate the monorepo root, identified by
 * a package.json containing a "workspaces" field.
 *
 * This avoids hardcoded `path.resolve(__dirname, '..', '..', ...)` chains
 * that break when the build output structure or file location changes.
 */

import { existsSync, readFileSync } from 'fs';
import * as path from 'path';

/**
 * Walk up directory tree from `startDir` to find the monorepo root.
 * The root is identified by a package.json containing a "workspaces" field.
 * Stops at the filesystem root to avoid infinite loops.
 *
 * @param startDir - Directory to start searching from (typically __dirname).
 * @returns Absolute path to the monorepo root, or null if not found.
 */
export function findMonorepoRoot(startDir: string): string | null {
  let current = path.resolve(startDir);
  const root = path.parse(current).root;

  while (current !== root) {
    const pkgPath = path.join(current, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        if (pkg.workspaces) {
          return current;
        }
      } catch {
        // Malformed package.json -- keep walking
      }
    }
    current = path.dirname(current);
  }

  return null;
}

/**
 * Resolve the solutions directory path.
 *
 * Resolution order:
 *   1. SOLUTIONS_DIR environment variable (absolute path)
 *   2. Walk up from startDir to find monorepo root, then append /solutions
 *   3. Fallback: path.resolve('solutions') (relative to cwd)
 *
 * @param startDir - Directory to start the monorepo root search from (typically __dirname).
 * @returns Absolute path to the solutions directory.
 */
export function resolveSolutionsDir(startDir: string): string {
  // 1. Explicit environment variable takes precedence
  if (process.env.SOLUTIONS_DIR) {
    return path.resolve(process.env.SOLUTIONS_DIR);
  }

  // 2. Walk up from startDir to find monorepo root
  const root = findMonorepoRoot(startDir);
  if (root) {
    return path.join(root, 'solutions');
  }

  // 3. Fallback: assume cwd is the monorepo root
  return path.resolve('solutions');
}
