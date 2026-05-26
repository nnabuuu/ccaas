import type { Project, ProjectFile } from '../types';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status}: ${body || res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function listProjects(): Promise<Project[]> {
  return request<Project[]>('/api/projects');
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
 * Build the URL for the ccaas agent-runtime SSE change feed. Unlike
 * the rest of this file (which uses the Vite proxy to live-lesson
 * backend on :3007), this endpoint lives on ccaas itself (:3001) and
 * needs the full URL.
 *
 * Source: `import.meta.env.VITE_CCAAS_URL` (matches the classroom
 * frontend's `useLiveLesson.ts` SDK pattern). Defaults to
 * `http://localhost:3001` for dev convenience when the env var is
 * unset.
 *
 * **Phase 2b-2**: the endpoint now requires `?token=<apiKey>`. Caller
 * must pass a ccaas API key; without one the URL still builds (token
 * omitted) but the server will respond 401. `EventSource` can't set
 * `Authorization` headers, hence the query-param convention.
 */
export function getChangesStreamUrl(
  projectId: string,
  apiKey?: string | null,
): string {
  const envUrl = import.meta.env.VITE_CCAAS_URL as string | undefined;
  if (!envUrl && import.meta.env.PROD) {
    // eslint-disable-next-line no-console
    console.warn(
      '[creator] VITE_CCAAS_URL is not set in a production build; ' +
      'falling back to http://localhost:3001. The agent-runtime SSE feed will ' +
      'only work if the user accesses the app from the same machine as ccaas. ' +
      'Set VITE_CCAAS_URL at build time to your deployed ccaas origin.',
    );
  }
  const base = (envUrl ?? 'http://localhost:3001').replace(/\/+$/, '');
  // ccaas mounts project-routes at the bare namespace (no /api/v1 prefix)
  // — see `packages/backend/src/sessions/agent-runtime/project-changes.controller.ts`.
  const path = `${base}/projects/${encodeURIComponent(projectId)}/changes`;
  return apiKey
    ? `${path}?token=${encodeURIComponent(apiKey)}`
    : path;
}
