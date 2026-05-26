/**
 * ccaas backend client for e2e specs.
 *
 * Covers the agent-runtime endpoints that creator-v7 will eventually
 * drive from the UI:
 *   - POST /api/v1/sessions/:id/messages       (first-turn; spawns engine)
 *   - POST /api/v1/sessions/:id/bind-project   (binds session → project)
 *   - GET  /projects/:id/changes               (SSE change stream)
 *
 * Cross-references:
 *   - poc-smoke.sh  — the wire-level smoke this mirrors
 *   - docs/creator-v7-architecture.md  — full flow diagram
 */

import { CCAAS_URL, CREATOR_TENANT_SLUG, CREATOR_TEMPLATE } from './constants';
import { getCcaasApiKeyCached } from './api-key';

// ── DB lookup for tenant id ──────────────────────────────────────────
// The /api/v1/tenants endpoint is auth-gated even under
// AUTH_ALLOW_ANONYMOUS=true, so we read sqlite directly when no
// override is provided. Same trick poc-smoke.sh uses.

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

function repoRoot(): string {
  return path.resolve(__dirname, '../../../../..');
}

let cachedTenantId: string | undefined;

/** Resolve the live-lesson-creator tenant uuid. */
export function getCreatorTenantId(slug = CREATOR_TENANT_SLUG): string {
  if (cachedTenantId) return cachedTenantId;
  if (process.env.CREATOR_TENANT_ID) {
    cachedTenantId = process.env.CREATOR_TENANT_ID.trim();
    return cachedTenantId;
  }
  const dbPath =
    process.env.CCAAS_DB_PATH ||
    path.join(repoRoot(), 'packages/backend/.agent-workspace/data.db');
  if (!fs.existsSync(dbPath)) {
    throw new Error(
      `cannot resolve tenant id for "${slug}" — ${dbPath} missing.\n` +
        `set CREATOR_TENANT_ID=<uuid> in the environment`,
    );
  }
  const id = execFileSync(
    'sqlite3',
    [dbPath, `SELECT id FROM tenants WHERE slug='${slug.replace(/'/g, "''")}';`],
    { encoding: 'utf8' },
  ).trim();
  if (!id) {
    throw new Error(`tenant slug "${slug}" not found in ${dbPath}`);
  }
  cachedTenantId = id;
  return id;
}

// ── HTTP helpers ─────────────────────────────────────────────────────

export interface BindBody { projectId: string; solutionId: string }
export interface BindResponse { success: true; sessionId: string; projectId: string }

/** Generate a UUID for a fresh session id. Crypto-random; safe in tests. */
export function newSessionId(): string {
  return globalThis.crypto.randomUUID();
}

/** POST /api/v1/sessions/:sid/messages — spawns the engine + triggers a turn. */
export async function postFirstMessage(opts: {
  sessionId: string;
  solutionId: string;
  message?: string;
  templateName?: string;
  /** Timeout in ms. The SSE response stays open for the whole turn (~5-15s). */
  timeoutMs?: number;
}): Promise<{ status: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30_000);
  try {
    const res = await fetch(`${CCAAS_URL}/api/v1/sessions/${opts.sessionId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: opts.message ?? 'hi',
        solutionId: opts.solutionId,
        templateName: opts.templateName ?? CREATOR_TEMPLATE,
      }),
      signal: controller.signal,
    });
    // We don't care about the SSE body — just that the connection
    // opened successfully (status 201 = session created).
    return { status: res.status };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * POST /api/v1/sessions/:sid/bind-project.
 *
 * TODO(β-2): swap to `attach-workspace-source` once β-2 lands. Today
 * this helper deliberately exercises the legacy alias route so that
 * the deprecation grace period is actually covered by an e2e — flipping
 * this to the new route too early would leave the alias path untested.
 */
export async function bindProject(
  sessionId: string,
  body: BindBody,
): Promise<{ status: number; data: BindResponse | { message: string } }> {
  const res = await fetch(`${CCAAS_URL}/api/v1/sessions/${sessionId}/bind-project`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { message: text }; }
  return { status: res.status, data: data as BindResponse | { message: string } };
}

/**
 * Bind, retrying on 404 until the session lands in the in-memory map.
 *
 * Why this is necessary: `POST /api/v1/sessions/:sid/messages` returns
 * 201 as soon as the message is queued, but session creation happens
 * inside `MessageWorkerService` on the next tick. The bash smoke gets
 * away with a 1-second `sleep` because curl holds the SSE stream open
 * for the whole turn, which gives plenty of time. Playwright's
 * fetch resolves on headers, so we'd race past the worker.
 *
 * Polls every 250ms for up to `timeoutMs`. Returns the first non-404
 * response (success or otherwise — we don't want to mask real errors
 * like 403 forbidden behind retries).
 */
export async function bindProjectAfterCreate(
  sessionId: string,
  body: BindBody,
  timeoutMs = 10_000,
): Promise<{ status: number; data: BindResponse | { message: string } }> {
  const deadline = Date.now() + timeoutMs;
  let last = await bindProject(sessionId, body);
  while (last.status === 404 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 250));
    last = await bindProject(sessionId, body);
  }
  return last;
}

// ── SSE consumer (Node fetch streaming) ──────────────────────────────

export interface ChangeEvent {
  projectId: string;
  path?: string;
  kind: 'subscribed' | 'created' | 'updated' | 'deleted' | string;
  source?: 'agent' | 'gui' | 'system' | string;
  at: string;
  actor?: string;
}

/**
 * Subscribe to the SSE change stream for a project. Returns a handle
 * with the collected events + a stop() function. Auto-aborts after
 * `timeoutMs`.
 *
 * Uses ?token=<apiKey> for the Phase 2b-2 auth gate. The token's
 * tenant must match the project's tenant once a session has been bound.
 */
export function subscribeChanges(opts: {
  projectId: string;
  apiKey?: string;
  timeoutMs?: number;
}): {
  events: ChangeEvent[];
  /** Promise that resolves when the stream ends (timeout or stop). */
  done: Promise<void>;
  stop: () => void;
} {
  const apiKey = opts.apiKey ?? getCcaasApiKeyCached();
  const events: ChangeEvent[] = [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15_000);

  const done = (async () => {
    try {
      const res = await fetch(
        `${CCAAS_URL}/projects/${opts.projectId}/changes?token=${encodeURIComponent(apiKey)}`,
        { signal: controller.signal },
      );
      if (!res.ok || !res.body) {
        throw new Error(`SSE subscribe failed: ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      // Read line-by-line; SSE events are blank-line-separated frames
      // with `data: <json>` lines. We only care about the data lines.
      while (true) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        buf += decoder.decode(value, { stream: true });
        let nl = buf.indexOf('\n');
        while (nl !== -1) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (line.startsWith('data:')) {
            const json = line.slice(5).trim();
            if (json) {
              try { events.push(JSON.parse(json) as ChangeEvent); } catch { /* skip */ }
            }
          }
          nl = buf.indexOf('\n');
        }
      }
    } catch (err) {
      // AbortError is expected on stop()/timeout — ignore.
      if ((err as Error).name !== 'AbortError') throw err;
    } finally {
      clearTimeout(timer);
    }
  })();

  return {
    events,
    done,
    stop: () => controller.abort(),
  };
}

// ── live-lesson side: create a project (for binding) ─────────────────

import { BACKEND_URL } from './constants';

export interface CreatedProject { id: string }

/** Create a CourseProject on live-lesson. Auto-scaffolds plan/ + execution/. */
export async function createCourseProject(opts: {
  title?: string;
  description?: string;
} = {}): Promise<CreatedProject> {
  const res = await fetch(`${BACKEND_URL}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: opts.title ?? `e2e-${Date.now()}`,
      description: opts.description ?? 'creator-v7 e2e fixture',
    }),
  });
  if (!res.ok) {
    throw new Error(`createCourseProject failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<CreatedProject>;
}

/** List artifacts on a project (used to assert bootstrap state). */
export async function listArtifacts(projectId: string): Promise<unknown[]> {
  const res = await fetch(`${BACKEND_URL}/api/projects/${projectId}/artifacts`);
  if (!res.ok) throw new Error(`listArtifacts failed: ${res.status}`);
  return res.json() as Promise<unknown[]>;
}

/**
 * Overwrite a single artifact on live-lesson. Simulates a GUI-side
 * edit on the project — the agent-runtime sync layer should see this
 * as a diff once `/invalidate` triggers a re-sync (Phase 2b-2 flow).
 */
export async function putArtifact(opts: {
  projectId: string;
  path: string;
  content: string;
  type?: 'json' | 'markdown' | 'text';
}): Promise<void> {
  const url = `${BACKEND_URL}/api/projects/${opts.projectId}/artifacts?path=${encodeURIComponent(opts.path)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: opts.content, type: opts.type ?? 'json' }),
  });
  if (!res.ok) {
    throw new Error(`putArtifact failed: ${res.status} ${await res.text()}`);
  }
}

/**
 * Tell ccaas to re-sync any sessions bound to a project. Triggers diff
 * walk + emits ChangeEvents for paths that drifted from the snapshot.
 * Uses the same `?token=` auth as the SSE feed.
 */
export async function invalidateProject(opts: {
  projectId: string;
  apiKey?: string;
}): Promise<{ accepted: number }> {
  const apiKey = opts.apiKey ?? getCcaasApiKeyCached();
  const res = await fetch(
    `${CCAAS_URL}/projects/${opts.projectId}/invalidate?token=${encodeURIComponent(apiKey)}`,
    { method: 'POST' },
  );
  if (!res.ok) {
    throw new Error(`invalidateProject failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<{ accepted: number }>;
}
