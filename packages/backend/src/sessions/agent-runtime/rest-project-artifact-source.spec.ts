/**
 * RestProjectArtifactSource tests.
 *
 * Mocks global `fetch` and asserts: URL shape, request method/body, response
 * parsing, error mapping (404→empty, !ok→throw), validation of malformed
 * server responses.
 */

import { RestProjectArtifactSource } from './rest-project-artifact-source';

const BASE = 'http://solution.local/api';

function mockFetch(handler: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  (globalThis as any).fetch = jest.fn(handler);
}

function makeResponse(body: unknown, status = 200): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('RestProjectArtifactSource', () => {
  let source: RestProjectArtifactSource;

  beforeEach(() => {
    source = new RestProjectArtifactSource(BASE);
  });

  afterEach(() => {
    delete (globalThis as any).fetch;
  });

  describe('constructor', () => {
    it('throws on empty baseUrl', () => {
      expect(() => new RestProjectArtifactSource('')).toThrow(/baseUrl/);
    });

    it('strips trailing slashes from baseUrl', () => {
      const s = new RestProjectArtifactSource(`${BASE}///`);
      mockFetch((url) => {
        expect(url).toBe(`${BASE}/projects/p1/artifacts`);
        return makeResponse([]);
      });
      return s.loadArtifacts('p1');
    });
  });

  describe('loadArtifacts', () => {
    it('GETs the project artifacts endpoint and parses the array', async () => {
      mockFetch((url, init) => {
        expect(url).toBe(`${BASE}/projects/p1/artifacts`);
        expect(init?.method).toBe('GET');
        return makeResponse([
          { path: 'lesson.md', content: '# Hi', type: 'md' },
          { path: 'plan.json', content: '{}', type: 'json', attributes: { version: 1 } },
        ]);
      });
      const out = await source.loadArtifacts('p1');
      expect(out).toEqual([
        { path: 'lesson.md', content: '# Hi', type: 'md', attributes: undefined },
        { path: 'plan.json', content: '{}', type: 'json', attributes: { version: 1 } },
      ]);
    });

    it('treats 404 as empty (project doesnt exist yet)', async () => {
      mockFetch(() => makeResponse({ error: 'not found' }, 404));
      const out = await source.loadArtifacts('p1');
      expect(out).toEqual([]);
    });

    it('throws on 500', async () => {
      mockFetch(() => makeResponse('oops', 500));
      await expect(source.loadArtifacts('p1')).rejects.toThrow(/HTTP 500/);
    });

    it('throws on malformed entry shape', async () => {
      mockFetch(() => makeResponse([{ path: 'x' /* missing content & type */ }]));
      await expect(source.loadArtifacts('p1')).rejects.toThrow(/invalid shape/);
    });

    it('throws when body is not an array', async () => {
      mockFetch(() => makeResponse({ not: 'array' }));
      await expect(source.loadArtifacts('p1')).rejects.toThrow(/expected array/);
    });

    it('URL-encodes projectId', async () => {
      mockFetch((url) => {
        expect(url).toBe(`${BASE}/projects/p%2Fweird%20id/artifacts`);
        return makeResponse([]);
      });
      await source.loadArtifacts('p/weird id');
    });
  });

  describe('saveArtifact', () => {
    it('PUTs to /artifacts?path=encoded with JSON body', async () => {
      mockFetch((url, init) => {
        expect(url).toBe(`${BASE}/projects/p1/artifacts?path=lesson.md`);
        expect(init?.method).toBe('PUT');
        expect((init?.headers as any)['Content-Type']).toBe('application/json');
        const body = JSON.parse(init?.body as string);
        expect(body).toEqual({ content: '# Updated', type: 'md' });
        return makeResponse({ ok: true });
      });
      await source.saveArtifact('p1', { path: 'lesson.md', content: '# Updated', type: 'md' });
    });

    it('includes attributes in body when provided', async () => {
      mockFetch((_url, init) => {
        const body = JSON.parse(init?.body as string);
        expect(body.attributes).toEqual({ schemaVersion: 2 });
        return makeResponse({});
      });
      await source.saveArtifact('p1', {
        path: 'x.json',
        content: '{}',
        type: 'json',
        attributes: { schemaVersion: 2 },
      });
    });

    it('throws on non-2xx', async () => {
      mockFetch(() => makeResponse('boom', 400));
      await expect(
        source.saveArtifact('p1', { path: 'x', content: 'y', type: 'md' }),
      ).rejects.toThrow(/HTTP 400/);
    });

    it('URL-encodes nested paths', async () => {
      mockFetch((url) => {
        expect(url).toBe(`${BASE}/projects/p1/artifacts?path=plans%2Fq2%2Froadmap.md`);
        return makeResponse({});
      });
      await source.saveArtifact('p1', {
        path: 'plans/q2/roadmap.md',
        content: 'x',
        type: 'md',
      });
    });
  });

  describe('deleteArtifact', () => {
    it('DELETEs the path-encoded endpoint', async () => {
      mockFetch((url, init) => {
        expect(url).toBe(`${BASE}/projects/p1/artifacts?path=stale.md`);
        expect(init?.method).toBe('DELETE');
        return makeResponse('');
      });
      await source.deleteArtifact!('p1', 'stale.md');
    });

    it('treats 404 as already-deleted (idempotent)', async () => {
      mockFetch(() => makeResponse('not found', 404));
      await expect(source.deleteArtifact!('p1', 'gone.md')).resolves.toBeUndefined();
    });

    it('throws on non-404 error', async () => {
      mockFetch(() => makeResponse('boom', 500));
      await expect(source.deleteArtifact!('p1', 'x.md')).rejects.toThrow(/HTTP 500/);
    });
  });
});
