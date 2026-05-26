/**
 * Browser-side API client for L1 (library) + L2 (interpretation overlay)
 * teaching-requirements endpoints.
 *
 * The browser hits the live-lesson backend (same-origin via Vite proxy
 * in dev). live-lesson resolves the caller's userId from request
 * context (X-Caller-User-Id) and scopes L2 results accordingly. The
 * browser never holds the ccaas key — the live-lesson backend is the
 * only thing that does.
 */

export interface ReqItem {
  id: string;
  code: string;
  text: string;
  subject: string;
  categoryId: string;
  categoryLabel: string;
  categoryColor: string;
}

export interface ReqCategory {
  id: string;
  label: string;
  color: string;
  items: Array<{ id: string; code: string; text: string }>;
}

export interface ReqLibrary {
  subject: string;
  subjectLabel: string;
  version: string;
  categories: ReqCategory[];
}

export interface InterpretationOverlay {
  notes: string;
  updatedAt: string;
}

export interface ReqItemWithInterpretation extends ReqItem {
  myInterpretation: InterpretationOverlay | null;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status}: ${body || res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

/**
 * List libraries (hierarchical, with nested categories). Used by the
 * picker UI to render the category-grouped tree.
 */
export async function listLibraries(opts?: {
  subject?: string;
}): Promise<ReqLibrary[]> {
  const qs = opts?.subject ? `?subject=${encodeURIComponent(opts.subject)}` : '';
  return request<ReqLibrary[]>(`/api/teaching-requirements${qs}`);
}

/**
 * Search across libraries (flat result). Used by the picker's search
 * box and by the read-only Plan Tab when it wants to resolve all
 * referenced ids at once.
 */
export async function searchRequirements(opts: {
  subject?: string;
  q?: string;
}): Promise<ReqItem[]> {
  const params = new URLSearchParams();
  if (opts.subject) params.set('subject', opts.subject);
  if (opts.q) params.set('q', opts.q);
  const qs = params.toString();
  return request<ReqItem[]>(
    `/api/teaching-requirements${qs ? '?' + qs : ''}`,
  );
}

/**
 * Get one requirement by id — includes the caller's interpretation
 * (`myInterpretation`) if they have one.
 */
export async function getRequirement(
  id: string,
): Promise<ReqItemWithInterpretation> {
  return request<ReqItemWithInterpretation>(
    `/api/teaching-requirements/${encodeURIComponent(id)}`,
  );
}

/**
 * List all of the caller's interpretations (used by sidecar
 * materialization on the agent side; the browser can use this for a
 * "My notes" tab if we add one later).
 */
export async function listMyInterpretations(): Promise<
  Array<{ reqId: string; notes: string; updatedAt: string }>
> {
  return request<Array<{ reqId: string; notes: string; updatedAt: string }>>(
    '/api/teaching-requirements/_interpretations',
  );
}

/** Upsert this user's interpretation of one req. */
export async function putInterpretation(
  reqId: string,
  notes: string,
): Promise<InterpretationOverlay> {
  return request<InterpretationOverlay>(
    `/api/teaching-requirements/${encodeURIComponent(reqId)}/interpretation`,
    {
      method: 'PUT',
      body: JSON.stringify({ notes }),
    },
  );
}

/** Delete this user's interpretation. 404 if none exists. */
export async function deleteInterpretation(reqId: string): Promise<void> {
  return request<void>(
    `/api/teaching-requirements/${encodeURIComponent(reqId)}/interpretation`,
    { method: 'DELETE' },
  );
}
