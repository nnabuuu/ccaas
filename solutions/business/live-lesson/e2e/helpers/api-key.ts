/**
 * API-key resolution for ccaas e2e specs.
 *
 * Phase 2b-2 of the agent-runtime work made `/projects/:id/changes`
 * SSE require `?token=<apiKey>`, so any spec that subscribes needs a
 * tenant-scoped key. Two sources, tried in order:
 *
 *   1. process.env.CCAAS_API_KEY        — preferred for CI / shared boxes
 *   2. mint via create-dev-api-key.ts   — fallback for fresh local dev DB
 *
 * Why not sqlite-read: `api_keys` stores only the SHA-256 hash, not
 * the raw key, so we can't recover an existing one. Set CCAAS_API_KEY
 * if you want to skip the ~5s mint subprocess overhead.
 *
 * Mirrors the resolution flow in
 * solutions/business/live-lesson-creator/scripts/poc-smoke.sh so the
 * Playwright path stays compatible with the bash smoke runbook.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CREATOR_TENANT_SLUG } from './constants';

/** Locate the repo root by climbing from this file. */
function repoRoot(): string {
  // helpers/api-key.ts -> helpers -> e2e -> live-lesson -> business -> solutions -> repo
  return path.resolve(__dirname, '../../../../..');
}

/** Resolve a tenant-scoped ccaas API key. Throws if neither source works. */
export function getCcaasApiKey(tenantSlug = CREATOR_TENANT_SLUG): string {
  if (process.env.CCAAS_API_KEY) {
    return process.env.CCAAS_API_KEY.trim();
  }

  const backendDir = path.join(repoRoot(), 'packages/backend');
  if (!fs.existsSync(path.join(backendDir, 'scripts/create-dev-api-key.ts'))) {
    throw new Error(
      `cannot mint ccaas api key — scripts/create-dev-api-key.ts not found at ${backendDir}\n` +
        `set CCAAS_API_KEY in the environment instead`,
    );
  }
  try {
    const raw = execFileSync(
      'npx',
      ['ts-node', '--transpile-only', 'scripts/create-dev-api-key.ts', tenantSlug, '--raw-only'],
      { cwd: backendDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    ).trim();
    if (!raw) {
      throw new Error('mint produced empty key');
    }
    return raw;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `failed to mint ccaas api key for tenant "${tenantSlug}": ${msg}\n` +
        `workarounds: (1) export CCAAS_API_KEY=<key>; (2) bootstrap the dev DB first`,
    );
  }
}

/** Cached key — minted once per spec process. */
let cachedKey: string | undefined;
export function getCcaasApiKeyCached(tenantSlug = CREATOR_TENANT_SLUG): string {
  if (!cachedKey) cachedKey = getCcaasApiKey(tenantSlug);
  return cachedKey;
}
