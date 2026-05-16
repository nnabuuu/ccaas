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
