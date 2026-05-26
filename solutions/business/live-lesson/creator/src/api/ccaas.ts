/**
 * ccaas (the agent-runtime backend) HTTP helpers.
 *
 * Distinct from `./projects.ts` (which targets live-lesson on a Vite
 * proxy) because ccaas lives on a different origin (`VITE_CCAAS_URL`,
 * default `http://localhost:3001`) and uses bearer-token auth instead
 * of session cookies.
 */

/**
 * Resolve the ccaas origin. `VITE_CCAAS_URL` is set at build time per
 * environment; defaults to local dev. Matches the resolution rule in
 * `useProjectChanges.ts` so the chat panel + change-stream subscriber
 * agree on which backend they talk to.
 */
export function ccaasBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_CCAAS_URL as string | undefined) ?? '';
  const cleaned = envUrl.trim().replace(/\/+$/, '');
  return cleaned || 'http://localhost:3001';
}

/** Read the operator-set API key from localStorage. Same key as `useProjectChanges`. */
export function getApiKey(): string | null {
  try {
    return localStorage.getItem('ccaas:apiKey');
  } catch {
    // localStorage can throw in private-mode Safari; treat as "no key".
    return null;
  }
}

/** Tenant identity facts returned by `GET /api/v1/auth/me`. */
export interface CcaasMe {
  tenantId: string;
  tenantSlug: string;
  apiKeyId?: string;
  scopes: string[];
  isAnonymous: boolean;
}

/**
 * Fetch caller identity. Returns null when no key is set OR the key
 * was rejected (the UI treats both as "show paste-key banner").
 *
 * Does NOT throw on 401 — that's an expected branch on first load
 * before the operator has set the key. Throws only on transport
 * errors (network down, etc.).
 */
export async function fetchMe(): Promise<CcaasMe | null> {
  const key = getApiKey();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (key) headers['Authorization'] = `Bearer ${key}`;

  const res = await fetch(`${ccaasBaseUrl()}/api/v1/auth/me`, { headers });
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) {
    throw new Error(`fetchMe failed: ${res.status}`);
  }
  return res.json() as Promise<CcaasMe>;
}

/** POST /api/v1/sessions/:sid/bind-project — wires session to the project. */
export async function bindSessionToProject(opts: {
  sessionId: string;
  projectId: string;
  tenantId: string;
}): Promise<void> {
  const key = getApiKey();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (key) headers['Authorization'] = `Bearer ${key}`;

  const res = await fetch(
    `${ccaasBaseUrl()}/api/v1/sessions/${encodeURIComponent(opts.sessionId)}/bind-project`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ projectId: opts.projectId, tenantId: opts.tenantId }),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`bind-project failed (${res.status}): ${body}`);
  }
}
