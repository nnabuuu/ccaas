/**
 * RestBinaryArtifactSource tests.
 *
 * Mocks global `fetch` and asserts: URL shape, request method/body/headers,
 * response parsing, error mapping, size-limit enforcement (pre + post-stream),
 * path-canonicalization echo, idempotent delete.
 */

import { Readable } from 'node:stream';

import { RestBinaryArtifactSource } from './rest-binary-artifact-source';

const BASE = 'http://solution.local/api';

function mockFetch(handler: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  (globalThis as any).fetch = jest.fn(handler);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function octetResponse(
  body: Buffer | ReadableStream<Uint8Array>,
  opts: { status?: number; sizeBytes?: number; type?: string } = {},
): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'application/octet-stream',
  };
  if (opts.sizeBytes !== undefined) {
    headers['Content-Length'] = String(opts.sizeBytes);
  }
  if (opts.type) {
    headers['X-Artifact-Type'] = opts.type;
  }
  return new Response(body as any, { status: opts.status ?? 200, headers });
}

describe('RestBinaryArtifactSource', () => {
  let source: RestBinaryArtifactSource;

  beforeEach(() => {
    source = new RestBinaryArtifactSource(BASE);
  });

  afterEach(() => {
    delete (globalThis as any).fetch;
  });

  describe('constructor', () => {
    it('throws on empty baseUrl', () => {
      expect(() => new RestBinaryArtifactSource('')).toThrow(/baseUrl/);
    });
    it('honors maxBytes option', () => {
      const s = new RestBinaryArtifactSource(BASE, { maxBytes: 1024 });
      expect(s.maxBytes).toBe(1024);
    });
  });

  describe('listBinaryArtifacts', () => {
    it('GETs the listing endpoint and parses metadata array', async () => {
      mockFetch((url, init) => {
        expect(url).toBe(`${BASE}/projects/p1/binary-artifacts`);
        expect(init?.method).toBe('GET');
        return jsonResponse([
          { path: 'hero.png', type: 'png', sizeBytes: 4096, contentHash: 'abc' },
          { path: 'audio.mp3', type: 'mp3', sizeBytes: 99999 },
        ]);
      });
      const out = await source.listBinaryArtifacts('p1');
      expect(out).toHaveLength(2);
      expect(out[0]).toEqual({
        path: 'hero.png',
        type: 'png',
        sizeBytes: 4096,
        contentHash: 'abc',
        attributes: undefined,
      });
      expect(out[1].contentHash).toBeUndefined();
    });

    it('returns [] on 404 (project not yet created)', async () => {
      mockFetch(() => jsonResponse('not found', 404));
      const out = await source.listBinaryArtifacts('p-new');
      expect(out).toEqual([]);
    });

    it('throws on non-array body', async () => {
      mockFetch(() => jsonResponse({ wrong: 'shape' }));
      await expect(source.listBinaryArtifacts('p1')).rejects.toThrow(/expected array/);
    });

    it('throws on invalid row shape', async () => {
      mockFetch(() => jsonResponse([{ path: 'x', type: 'y' /* missing sizeBytes */ }]));
      await expect(source.listBinaryArtifacts('p1')).rejects.toThrow(/invalid shape/);
    });
  });

  describe('loadBinaryArtifact', () => {
    it('streams bytes from the GET-with-path endpoint and returns a Buffer', async () => {
      const payload = Buffer.from('binary-content-bytes');
      mockFetch((url) => {
        expect(url).toBe(
          `${BASE}/projects/p1/binary-artifacts?path=hero.png`,
        );
        return octetResponse(payload, { sizeBytes: payload.length, type: 'png' });
      });
      const out = await source.loadBinaryArtifact('p1', 'hero.png');
      expect(out.path).toBe('hero.png');
      expect(out.type).toBe('png');
      expect(out.sizeBytes).toBe(payload.length);
      expect(Buffer.compare(out.content as Buffer, payload)).toBe(0);
    });

    it('rejects pre-stream when Content-Length exceeds maxBytes', async () => {
      const limited = new RestBinaryArtifactSource(BASE, { maxBytes: 100 });
      mockFetch(() =>
        octetResponse(Buffer.alloc(0), { sizeBytes: 1024 * 1024 /* 1MB */ }),
      );
      await expect(
        limited.loadBinaryArtifact('p1', 'big.png'),
      ).rejects.toThrow(/exceeds maxBytes 100/);
    });

    it('rejects mid-stream when actual bytes exceed cap (Content-Length lied or absent)', async () => {
      const limited = new RestBinaryArtifactSource(BASE, { maxBytes: 16 });
      // Build a Web ReadableStream that emits 32 bytes in 2 chunks.
      const chunks = [Buffer.alloc(16, 1), Buffer.alloc(16, 2)];
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          for (const c of chunks) controller.enqueue(c);
          controller.close();
        },
      });
      mockFetch(() => octetResponse(stream /* no Content-Length */, {}));
      await expect(
        limited.loadBinaryArtifact('p1', 'mislabelled.png'),
      ).rejects.toThrow(/exceeded cap 16/);
    });

    it('throws on !ok HTTP status', async () => {
      mockFetch(() => new Response('boom', { status: 500 }));
      await expect(
        source.loadBinaryArtifact('p1', 'hero.png'),
      ).rejects.toThrow(/HTTP 500/);
    });
  });

  describe('saveBinaryArtifact', () => {
    it('PUTs the bytes with octet-stream + size/type headers; honors path/type query params', async () => {
      const payload = Buffer.from('agent-edited-bytes');
      let observedBody: Blob | undefined;
      mockFetch((url, init) => {
        expect(url).toBe(
          `${BASE}/projects/p1/binary-artifacts?path=icons%2Fnew.png&type=png`,
        );
        expect(init?.method).toBe('PUT');
        const headers = init?.headers as Record<string, string>;
        expect(headers['Content-Type']).toBe('application/octet-stream');
        expect(headers['Content-Length']).toBe(String(payload.length));
        // The adapter wraps bytes in a Blob to satisfy TS's BodyInit
        // typing; assert size + bytes round-trip through the Blob.
        observedBody = init?.body as Blob;
        expect(observedBody).toBeInstanceOf(Blob);
        expect(observedBody!.size).toBe(payload.length);
        return new Response(null, { status: 200 });
      });
      await source.saveBinaryArtifact('p1', {
        path: 'icons/new.png',
        content: payload,
        type: 'png',
        sizeBytes: payload.length,
      });
      const roundTripped = Buffer.from(await observedBody!.arrayBuffer());
      expect(Buffer.compare(roundTripped, payload)).toBe(0);
    });

    it('rejects pre-flight when actual content size exceeds maxBytes (no fetch issued)', async () => {
      const limited = new RestBinaryArtifactSource(BASE, { maxBytes: 8 });
      const fetchMock = jest.fn();
      (globalThis as any).fetch = fetchMock;
      await expect(
        limited.saveBinaryArtifact('p1', {
          path: 'big.png',
          content: Buffer.alloc(32),
          type: 'png',
          sizeBytes: 32,
        }),
      ).rejects.toThrow(/actual size 32 exceeds maxBytes 8/);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('uses ACTUAL byte length, not caller-supplied sizeBytes, for the cap check', async () => {
      // A caller passing sizeBytes:0 with a 32-byte buffer must NOT
      // bypass the cap. Real bytes drive the check.
      const limited = new RestBinaryArtifactSource(BASE, { maxBytes: 8 });
      const fetchMock = jest.fn();
      (globalThis as any).fetch = fetchMock;
      await expect(
        limited.saveBinaryArtifact('p1', {
          path: 'sneaky.png',
          content: Buffer.alloc(32),
          type: 'png',
          sizeBytes: 0, // lying!
        }),
      ).rejects.toThrow(/actual size 32 exceeds maxBytes 8/);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sends Content-Length based on actual content bytes (ignores caller-supplied sizeBytes)', async () => {
      const real = Buffer.from('actual-12345');
      mockFetch((_url, init) => {
        const headers = init?.headers as Record<string, string>;
        expect(headers['Content-Length']).toBe(String(real.length));
        return new Response(null, { status: 200 });
      });
      await source.saveBinaryArtifact('p1', {
        path: 'x.png',
        content: real,
        type: 'png',
        sizeBytes: 999999, // lying!
      });
    });

    it('returns canonical path when server echoes JSON {path}', async () => {
      mockFetch(() =>
        new Response(JSON.stringify({ path: 'icons/normalized.png' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      const out = await source.saveBinaryArtifact('p1', {
        path: 'icons/MIXED-case.png',
        content: Buffer.from('x'),
        type: 'png',
        sizeBytes: 1,
      });
      expect(out).toEqual({ canonicalPath: 'icons/normalized.png' });
    });

    it('returns void when server replies non-JSON (no canonicalization needed)', async () => {
      mockFetch(() => new Response(null, { status: 200 }));
      const out = await source.saveBinaryArtifact('p1', {
        path: 'x.png',
        content: Buffer.from('y'),
        type: 'png',
        sizeBytes: 1,
      });
      expect(out).toBeUndefined();
    });

    it('throws on !ok HTTP status', async () => {
      mockFetch(() => new Response('413 payload too large', { status: 413 }));
      await expect(
        source.saveBinaryArtifact('p1', {
          path: 'x.png',
          content: Buffer.from('y'),
          type: 'png',
          sizeBytes: 1,
        }),
      ).rejects.toThrow(/HTTP 413/);
    });
  });

  describe('deleteBinaryArtifact', () => {
    it('DELETEs the path endpoint; treats 404 as already-deleted', async () => {
      const seen: string[] = [];
      mockFetch((url) => {
        seen.push(url);
        return new Response(null, { status: 404 });
      });
      await source.deleteBinaryArtifact('p1', 'hero.png');
      expect(seen[0]).toBe(
        `${BASE}/projects/p1/binary-artifacts?path=hero.png`,
      );
    });

    it('throws on non-404 error status', async () => {
      mockFetch(() => new Response('nope', { status: 500 }));
      await expect(
        source.deleteBinaryArtifact('p1', 'x.png'),
      ).rejects.toThrow(/HTTP 500/);
    });
  });
});
