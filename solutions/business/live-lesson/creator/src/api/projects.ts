import type { Project, ProjectFile, ProjectListStatus } from '../types';

/**
 * Typed HTTP error so callers can branch on `status` instead of
 * parsing error.message prefixes (which were fragile when bodies
 * happened to start with the status digits).
 */
export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new HttpError(res.status, `${res.status}: ${body || res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function listProjects(
  opts: { status?: ProjectListStatus } = {},
): Promise<Project[]> {
  const status = opts.status ?? 'active';
  return request<Project[]>(`/api/projects?status=${status}`);
}

export async function createProject(data: { title: string; description?: string }): Promise<Project> {
  return request<Project>('/api/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getProject(id: string): Promise<Project & { files: ProjectFile[] }> {
  return request<Project & { files: ProjectFile[] }>(`/api/projects/${id}`);
}

export async function deleteProject(id: string): Promise<void> {
  return request<void>(`/api/projects/${id}`, { method: 'DELETE' });
}

export async function restoreProject(id: string): Promise<Project> {
  return request<Project>(`/api/projects/${id}/restore`, { method: 'POST' });
}

export async function listFiles(projectId: string): Promise<ProjectFile[]> {
  return request<ProjectFile[]>(`/api/projects/${projectId}/files`);
}

export async function readFile(projectId: string, path: string): Promise<{ content: string; fileType: string }> {
  return request<{ content: string; fileType: string }>(
    `/api/projects/${projectId}/files?path=${encodeURIComponent(path)}`,
  );
}

export async function writeFile(projectId: string, path: string, content: string): Promise<void> {
  return request<void>(
    `/api/projects/${projectId}/files?path=${encodeURIComponent(path)}`,
    { method: 'PUT', body: JSON.stringify({ content }) },
  );
}

export async function createFile(
  projectId: string,
  data: { path: string; content: string; fileType: string },
): Promise<ProjectFile> {
  return request<ProjectFile>(`/api/projects/${projectId}/files`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteFile(projectId: string, path: string): Promise<void> {
  return request<void>(
    `/api/projects/${projectId}/files?path=${encodeURIComponent(path)}`,
    { method: 'DELETE' },
  );
}

export async function publishProject(projectId: string): Promise<{ lessonId: string }> {
  return request<{ lessonId: string }>(`/api/projects/${projectId}/publish`, {
    method: 'POST',
  });
}

/**
 * Build the URL for the ccaas agent-runtime SSE change feed.
 *
 * **Design rule**: the browser never holds a ccaas API key. The ccaas
 * key belongs to the solution backend (this project's tenant). The
 * browser hits a relative `/api/projects/:id/changes` endpoint on the
 * live-lesson backend (via the Vite proxy in dev or your reverse proxy
 * in prod); the live-lesson backend proxies the SSE stream to ccaas
 * using its env-var `CCAAS_API_KEY`. See
 * `solutions/business/live-lesson/backend/src/adapters/http/ccaas-proxy.controller.ts`.
 *
 * (Earlier iterations of this file built a direct
 * `http://ccaas:3001/projects/:id/changes?token=...` URL from a key
 * pasted into localStorage. That violated the platform's "browser is a
 * solution user, not a ccaas user" boundary and is no longer the path.)
 */
export function getChangesStreamUrl(projectId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/changes`;
}
