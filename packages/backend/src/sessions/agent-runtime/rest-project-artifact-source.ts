/**
 * RestProjectArtifactSource — HTTP-backed `ProjectArtifactSource` impl
 * for solutions that run in a separate process from ccaas (the common
 * case: live-lesson on :3007, ccaas on :3001).
 *
 * Solutions expose three endpoints under a configurable base URL:
 *
 *   GET    {base}/projects/:projectId/artifacts
 *     → 200: [{ path, content, type, attributes? }]
 *
 *   PUT    {base}/projects/:projectId/artifacts?path=<encoded>
 *     body: { content: string, type: string, attributes?: object }
 *     → 200 (upsert; idempotent)
 *
 *   DELETE {base}/projects/:projectId/artifacts?path=<encoded>
 *     → 200 (idempotent — 404 is treated as already-deleted)
 *
 * Solutions don't have to know about ccaas-internal types; the
 * `ArtifactSnapshot` shape is intentionally a plain JSON object.
 *
 * Configuration: set `tenant.config.artifactUrl` (via `solution.json`
 * auto-discovery or `PUT /tenants/:id`). The `ProjectArtifactSourceRegistry`
 * lazily constructs a `RestProjectArtifactSource(url)` per tenant on
 * first use and caches it, invalidating on `tenant.config.changed` events.
 *
 * Failure behavior: network errors throw; the syncer logs + swallows
 * so a flaky solution never corrupts a session's snapshot. Solutions
 * SHOULD make these endpoints idempotent so retries are safe.
 */

import { Injectable, Logger } from '@nestjs/common';

import type {
  ArtifactSnapshot,
  ProjectArtifactSource,
} from '@kedge-agentic/agent-runtime';

@Injectable()
export class RestProjectArtifactSource implements ProjectArtifactSource {
  private readonly logger = new Logger(RestProjectArtifactSource.name);
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    if (!baseUrl) {
      throw new Error('RestProjectArtifactSource requires baseUrl');
    }
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async loadArtifacts(projectId: string): Promise<ReadonlyArray<ArtifactSnapshot>> {
    const res = await fetch(
      `${this.baseUrl}/projects/${encodeURIComponent(projectId)}/artifacts`,
      { method: 'GET', headers: { Accept: 'application/json' } },
    );
    if (!res.ok) {
      // 404 = project doesn't exist yet → empty set is the right answer
      if (res.status === 404) return [];
      throw new Error(
        `loadArtifacts(${projectId}) HTTP ${res.status}: ${await res.text()}`,
      );
    }
    const body = (await res.json()) as unknown;
    if (!Array.isArray(body)) {
      throw new Error(
        `loadArtifacts(${projectId}) expected array, got ${typeof body}`,
      );
    }
    // Validate each entry has the required shape.
    return body.map((row, i) => {
      if (
        !row ||
        typeof row !== 'object' ||
        typeof (row as any).path !== 'string' ||
        typeof (row as any).content !== 'string' ||
        typeof (row as any).type !== 'string'
      ) {
        throw new Error(
          `loadArtifacts(${projectId})[${i}] invalid shape: ${JSON.stringify(row)}`,
        );
      }
      const r = row as Record<string, unknown>;
      return {
        path: r.path as string,
        content: r.content as string,
        type: r.type as string,
        attributes:
          r.attributes && typeof r.attributes === 'object'
            ? (r.attributes as Record<string, unknown>)
            : undefined,
      };
    });
  }

  async saveArtifact(
    projectId: string,
    artifact: ArtifactSnapshot,
  ): Promise<void> {
    const url = `${this.baseUrl}/projects/${encodeURIComponent(projectId)}/artifacts?path=${encodeURIComponent(artifact.path)}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: artifact.content,
        type: artifact.type,
        ...(artifact.attributes ? { attributes: artifact.attributes } : {}),
      }),
    });
    if (!res.ok) {
      throw new Error(
        `saveArtifact(${projectId}, ${artifact.path}) HTTP ${res.status}: ${await res.text()}`,
      );
    }
  }

  async deleteArtifact(projectId: string, path: string): Promise<void> {
    const url = `${this.baseUrl}/projects/${encodeURIComponent(projectId)}/artifacts?path=${encodeURIComponent(path)}`;
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok && res.status !== 404) {
      throw new Error(
        `deleteArtifact(${projectId}, ${path}) HTTP ${res.status}: ${await res.text()}`,
      );
    }
  }
}
