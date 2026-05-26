/**
 * RestBinaryArtifactSource — HTTP-backed `BinaryArtifactSource` impl
 * for solutions that need to sync image/audio/PDF artifacts.
 *
 * Solutions expose four endpoints under a configurable base URL:
 *
 *   GET    {base}/projects/:projectId/binary-artifacts
 *     → 200 application/json: [{ path, type, sizeBytes, contentHash?, attributes? }]
 *     Metadata listing only — no bytes; lets the runtime walk the
 *     project quickly to decide which artifacts changed.
 *
 *   GET    {base}/projects/:projectId/binary-artifacts?path=<encoded>
 *     → 200 application/octet-stream + headers:
 *         Content-Type, Content-Length, X-Artifact-Type
 *     Streamed bytes. The adapter consumes via `node:stream/pipeline`
 *     into a Buffer — but `maxBytes` is enforced on Content-Length
 *     BEFORE the body is drained so an oversized payload doesn't
 *     occupy memory.
 *
 *   PUT    {base}/projects/:projectId/binary-artifacts?path=<encoded>&type=<encoded>
 *     body: application/octet-stream (bytes)
 *     → 200 (upsert; idempotent). May return JSON `{path}` for path
 *     canonicalization, same convention as the text variant.
 *
 *   DELETE {base}/projects/:projectId/binary-artifacts?path=<encoded>
 *     → 200 (idempotent; 404 treated as already-deleted)
 *
 * Why split listing from loading? Binary content can be MB-sized; full
 * reads every turn would be prohibitive. The runtime checks the
 * listing's `contentHash` against its snapshot to filter to just the
 * paths that need a fetch, then `loadBinaryArtifact` streams the bytes.
 *
 * Why a separate class (not a method on RestWorkspaceArtifactSource)?
 * MIME-type and content-stream handling diverge enough that one mixed
 * class would obscure both flows. Per the Phase 2b-4 plan.
 *
 * Failure behavior: network/HTTP errors throw; the syncer logs +
 * swallows so a flaky solution never corrupts a session's snapshot.
 * Solutions SHOULD make these endpoints idempotent so retries are safe.
 *
 * **Memory safety**: this adapter does NOT use `res.arrayBuffer()` on
 * uploads — outgoing bodies are passed through as `BodyInit` so fetch
 * can stream them. Downloads use `Readable.fromWeb(res.body)` piped
 * through a length-bounded collector. A 100MB binary should never
 * cause >~1MB chunked allocations.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Readable } from 'node:stream';

import type {
  BinaryArtifactListing,
  BinaryArtifactSnapshot,
  BinaryArtifactSource,
  SaveBinaryArtifactResult,
} from '@kedge-agentic/agent-runtime';

const MAX_LISTING_BODY_BYTES = 8 * 1024 * 1024; // 8 MB cap on JSON listing

@Injectable()
export class RestBinaryArtifactSource implements BinaryArtifactSource {
  private readonly logger = new Logger(RestBinaryArtifactSource.name);
  private readonly baseUrl: string;
  readonly maxBytes?: number;

  constructor(baseUrl: string, options?: { maxBytes?: number }) {
    if (!baseUrl) {
      throw new Error('RestBinaryArtifactSource requires baseUrl');
    }
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.maxBytes = options?.maxBytes;
  }

  async listBinaryArtifacts(
    projectId: string,
  ): Promise<ReadonlyArray<BinaryArtifactListing>> {
    const res = await fetch(
      `${this.baseUrl}/projects/${encodeURIComponent(projectId)}/binary-artifacts`,
      { method: 'GET', headers: { Accept: 'application/json' } },
    );
    if (!res.ok) {
      if (res.status === 404) return [];
      throw new Error(
        `listBinaryArtifacts(${projectId}) HTTP ${res.status}: ${await res.text()}`,
      );
    }
    // Reject pathologically-large listing bodies before parsing.
    const lenHeader = res.headers.get('content-length');
    if (lenHeader && Number(lenHeader) > MAX_LISTING_BODY_BYTES) {
      throw new Error(
        `listBinaryArtifacts(${projectId}) listing body too large: ${lenHeader} bytes`,
      );
    }
    const body = (await res.json()) as unknown;
    if (!Array.isArray(body)) {
      throw new Error(
        `listBinaryArtifacts(${projectId}) expected array, got ${typeof body}`,
      );
    }
    return body.map((row, i) => {
      if (
        !row ||
        typeof row !== 'object' ||
        typeof (row as any).path !== 'string' ||
        typeof (row as any).type !== 'string' ||
        typeof (row as any).sizeBytes !== 'number'
      ) {
        throw new Error(
          `listBinaryArtifacts(${projectId})[${i}] invalid shape: ${JSON.stringify(row)}`,
        );
      }
      const r = row as Record<string, unknown>;
      return {
        path: r.path as string,
        type: r.type as string,
        sizeBytes: r.sizeBytes as number,
        contentHash:
          typeof r.contentHash === 'string' ? (r.contentHash as string) : undefined,
        attributes:
          r.attributes && typeof r.attributes === 'object'
            ? (r.attributes as Record<string, unknown>)
            : undefined,
      };
    });
  }

  async loadBinaryArtifact(
    projectId: string,
    path: string,
  ): Promise<BinaryArtifactSnapshot> {
    const url = `${this.baseUrl}/projects/${encodeURIComponent(projectId)}/binary-artifacts?path=${encodeURIComponent(path)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/octet-stream' },
    });
    if (!res.ok) {
      throw new Error(
        `loadBinaryArtifact(${projectId}, ${path}) HTTP ${res.status}: ${await res.text()}`,
      );
    }
    // Size guard BEFORE we drain the body — protects against a
    // misconfigured solution serving a 10GB file. We rely on the
    // server's Content-Length; if missing we read but cap the buffer
    // at maxBytes (or a sensible default of 100MB if no maxBytes set).
    const lenHeader = res.headers.get('content-length');
    const declaredSize = lenHeader ? Number(lenHeader) : undefined;
    const cap = this.maxBytes ?? 100 * 1024 * 1024;
    if (declaredSize !== undefined && declaredSize > cap) {
      throw new Error(
        `loadBinaryArtifact(${projectId}, ${path}) declared size ${declaredSize} ` +
        `exceeds maxBytes ${cap}`,
      );
    }
    const type =
      res.headers.get('x-artifact-type') ??
      this.typeFromContentType(res.headers.get('content-type'));
    if (!res.body) {
      throw new Error(
        `loadBinaryArtifact(${projectId}, ${path}) response has no body`,
      );
    }
    const buffer = await this.streamToBufferBounded(res.body, cap);
    return {
      path,
      content: buffer,
      type,
      sizeBytes: buffer.length,
    };
  }

  async saveBinaryArtifact(
    projectId: string,
    artifact: BinaryArtifactSnapshot,
  ): Promise<void | SaveBinaryArtifactResult> {
    // Use ACTUAL byte length (not the caller-supplied `sizeBytes` field)
    // for both the cap check and the outbound Content-Length header. A
    // caller passing e.g. `sizeBytes: 0` with a 1GB content buffer would
    // otherwise bypass the cap entirely and upload the full payload
    // labeled as zero-length. `sizeBytes` stays in the type as a hint
    // for the engine layer, but the wire transport is authoritative.
    const bodyBytes: Uint8Array =
      artifact.content instanceof Uint8Array
        ? artifact.content
        : Buffer.from(artifact.content);
    const actualSize = bodyBytes.byteLength;
    if (this.maxBytes !== undefined && actualSize > this.maxBytes) {
      throw new Error(
        `saveBinaryArtifact(${projectId}, ${artifact.path}) actual size ` +
        `${actualSize} exceeds maxBytes ${this.maxBytes}`,
      );
    }
    const url =
      `${this.baseUrl}/projects/${encodeURIComponent(projectId)}/binary-artifacts` +
      `?path=${encodeURIComponent(artifact.path)}` +
      `&type=${encodeURIComponent(artifact.type)}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(actualSize),
      },
      // Cast through unknown: BodyInit accepts Blob, and BlobPart's
      // typed TypeScript signature is overly restrictive (`ArrayBuffer`
      // vs `ArrayBufferLike`) for Node's runtime which accepts any
      // ArrayBufferLike-backed view. Behavior is identical.
      body: new Blob([bodyBytes as unknown as ArrayBuffer]),
    });
    if (!res.ok) {
      throw new Error(
        `saveBinaryArtifact(${projectId}, ${artifact.path}) HTTP ${res.status}: ${await res.text()}`,
      );
    }
    // Path-canonicalization echo, same convention as the text variant.
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
      return { canonicalPath: (body as Record<string, unknown>).path as string };
    }
  }

  async deleteBinaryArtifact(projectId: string, path: string): Promise<void> {
    const url = `${this.baseUrl}/projects/${encodeURIComponent(projectId)}/binary-artifacts?path=${encodeURIComponent(path)}`;
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok && res.status !== 404) {
      throw new Error(
        `deleteBinaryArtifact(${projectId}, ${path}) HTTP ${res.status}: ${await res.text()}`,
      );
    }
  }

  /**
   * Drain a WHATWG `ReadableStream<Uint8Array>` into a Buffer, abort
   * if the total exceeds `cap`. Keeps memory bounded for misbehaving
   * solutions (no Content-Length OR Content-Length lied).
   *
   * **Memory caveat**: this implementation collects chunks into an array
   * then concats. Peak memory ≈ 2× `cap` transient (chunks list +
   * concat output buffer). For the default 100MB cap that's ~200MB per
   * concurrent download. Acceptable today (single-replica ccaas, small
   * tenant counts); if you start seeing memory pressure, either:
   *   - lower the per-source `maxBytes` (via `tenant.config.binaryMaxBytes`)
   *   - refactor to `Buffer.allocUnsafe(declaredSize)` + offset writes
   *     when Content-Length is known (avoids the concat copy)
   * Tracked as Phase 2c optimization.
   */
  private async streamToBufferBounded(
    body: ReadableStream<Uint8Array>,
    cap: number,
  ): Promise<Buffer> {
    const nodeStream = Readable.fromWeb(body as any);
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of nodeStream) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
      total += buf.length;
      if (total > cap) {
        // Best-effort destroy; the loop exits on the throw anyway.
        nodeStream.destroy();
        throw new Error(
          `loadBinaryArtifact body exceeded cap ${cap} bytes (stopped at ${total})`,
        );
      }
      chunks.push(buf);
    }
    return Buffer.concat(chunks, total);
  }

  /**
   * Best-effort `type` inference from Content-Type. Solutions are
   * encouraged to send `X-Artifact-Type` explicitly because the runtime
   * uses this string for snapshot equality (mismatched discriminators
   * don't trigger sync but DO show up in logs).
   */
  private typeFromContentType(ct: string | null): string {
    if (!ct) return 'application/octet-stream';
    return ct.split(';')[0].trim();
  }
}
