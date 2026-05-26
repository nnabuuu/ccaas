/**
 * RestWorkspaceArtifactSource — HTTP-backed `ProjectArtifactSource` impl
 * for solutions that run in a separate process from ccaas (the common
 * case: live-lesson on :3007, ccaas on :3001). Renamed from
 * `RestProjectArtifactSource` in β-3 — the deprecated class name is
 * still re-exported at the bottom of this file for one release.
 *
 * Solutions expose three endpoints under a configurable base URL. The
 * URL **template** still uses `/projects/:id/artifacts` because that's
 * what solutions implement today — ccaas-core stops calling its own
 * abstraction "project" but the wire contract solutions promise is
 * still expressed in solution-domain vocabulary. A future phase may
 * make the URL template configurable per-tenant.
 *
 *   GET    {base}/projects/:identity/artifacts
 *     → 200: [{ path, content, type, attributes? }]
 *
 *   PUT    {base}/projects/:identity/artifacts?path=<encoded>
 *     body: { content: string, type: string, attributes?: object }
 *     → 200 (upsert; idempotent)
 *
 *   DELETE {base}/projects/:identity/artifacts?path=<encoded>
 *     → 200 (idempotent — 404 is treated as already-deleted)
 *
 * Solutions don't have to know about ccaas-internal types; the
 * `ArtifactSnapshot` shape is intentionally a plain JSON object.
 *
 * Configuration: set `tenant.config.artifactUrl` (via `solution.json`
 * auto-discovery or `PUT /solutions/:id`). The `ProjectArtifactSourceRegistry`
 * lazily constructs a `RestWorkspaceArtifactSource(url)` per tenant on
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
  SaveArtifactResult,
} from '@kedge-agentic/agent-runtime';

@Injectable()
export class RestWorkspaceArtifactSource implements ProjectArtifactSource {
  private readonly logger = new Logger(RestWorkspaceArtifactSource.name);
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    if (!baseUrl) {
      throw new Error('RestWorkspaceArtifactSource requires baseUrl');
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
  ): Promise<void | SaveArtifactResult> {
    const url = `${this.baseUrl}/projects/${encodeURIComponent(projectId)}/artifacts?path=${encodeURIComponent(artifact.path)}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
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
    // If the solution returned a JSON body with `path`, expose it as
    // the canonical path so the syncer's snapshot uses the persisted
    // key rather than the sent key. Phase 1 review M1. Tolerates:
    //   - empty body (no content-type)
    //   - non-JSON body
    //   - JSON without `path`
    // — any of those skip the result + caller falls back to sent path.
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) return;
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return;
    }
    if (
      body &&
      typeof body === 'object' &&
      typeof (body as Record<string, unknown>).path === 'string'
    ) {
      const canonical = (body as Record<string, unknown>).path as string;
      return { canonicalPath: canonical };
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

/**
 * @deprecated since β-3 (2026-05-26) — use `RestWorkspaceArtifactSource`.
 * Kept as a re-export so any out-of-tree consumer importing the old
 * name from this file (file path itself moved via `git mv`) gets a
 * clear deprecation notice instead of a silent ImportError.
 */
export { RestWorkspaceArtifactSource as RestProjectArtifactSource };

