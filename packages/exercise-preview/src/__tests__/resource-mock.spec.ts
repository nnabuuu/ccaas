import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { createPreviewServer } from '../backend/preview-server';
import { defineStories } from '../core/define-stories';
import { extractBundleFromModule } from '../core/story-loader';
import type { Story } from '../core/types';

function buildBundle() {
  const defaultExport = defineStories({
    plugin: { type: 'quiz', displayName: 'Quiz' },
    meta: { title: 'Quiz' },
  });
  const Default: Story = { name: 'Default', answerKey: { type: 'quiz' } };
  return extractBundleFromModule('/fake/quiz.stories.ts', { default: defaultExport, Default });
}

function request(
  port: number,
  method: string,
  pathname: string,
  body?: Buffer,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: Buffer; contentType?: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: 'localhost', port, method, path: pathname, headers },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks),
            contentType: res.headers['content-type'] as string | undefined,
          }),
        );
      },
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

describe('Resource mock: fixtures + uploads', () => {
  const port = 43219;
  let server: ReturnType<typeof createPreviewServer>;
  let tmpFixturesDir: string;
  let tmpUploadDir: string;

  beforeAll(async () => {
    tmpFixturesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-fix-'));
    tmpUploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-up-'));
    fs.writeFileSync(path.join(tmpFixturesDir, 'sample.png'), Buffer.from('PNGDATA'));
    fs.writeFileSync(path.join(tmpFixturesDir, 'note.txt'), 'hello fixture');

    server = createPreviewServer({
      port,
      bundles: [buildBundle()],
      fixtures: [{ bundleId: 'quiz', dir: tmpFixturesDir }],
      uploadDir: tmpUploadDir,
    });
    await server.start();
  });
  afterAll(async () => {
    await server.stop();
    fs.rmSync(tmpFixturesDir, { recursive: true, force: true });
    fs.rmSync(tmpUploadDir, { recursive: true, force: true });
  });

  it('serves PNG fixture with correct mime', async () => {
    const res = await request(port, 'GET', '/preview/fixtures/quiz/sample.png');
    expect(res.status).toBe(200);
    expect(res.contentType).toContain('image/png');
    expect(res.body.toString('utf-8')).toBe('PNGDATA');
  });

  it('serves text fixture', async () => {
    const res = await request(port, 'GET', '/preview/fixtures/quiz/note.txt');
    expect(res.status).toBe(200);
    expect(res.body.toString('utf-8')).toBe('hello fixture');
  });

  it('404 for unknown bundle in fixtures', async () => {
    const res = await request(port, 'GET', '/preview/fixtures/nonexistent/sample.png');
    expect(res.status).toBe(404);
  });

  it('404 for missing fixture file', async () => {
    const res = await request(port, 'GET', '/preview/fixtures/quiz/missing.png');
    expect(res.status).toBe(404);
  });

  it('rejects path traversal in fixture', async () => {
    const res = await request(port, 'GET', '/preview/fixtures/quiz/..%2F..%2Fetc%2Fpasswd');
    // %2F isn't decoded by the matcher (relies on raw pathname), so this hits 404.
    // Either 403 or 404 is acceptable as long as we don't expose host files.
    expect([403, 404]).toContain(res.status);
  });

  it('uploads + serves a file via multipart', async () => {
    const boundary = '----testboundary123';
    const fileContent = Buffer.from('uploaded-image-bytes');
    const parts = [
      `--${boundary}\r\n`,
      `Content-Disposition: form-data; name="file"; filename="hand.png"\r\n`,
      `Content-Type: image/png\r\n\r\n`,
    ].join('');
    const body = Buffer.concat([
      Buffer.from(parts, 'utf-8'),
      fileContent,
      Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8'),
    ]);
    const upRes = await request(port, 'POST', '/preview/upload', body, {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length.toString(),
    });
    expect(upRes.status).toBe(200);
    const result = JSON.parse(upRes.body.toString('utf-8'));
    expect(result.url).toMatch(/^\/preview\/uploads\//);
    expect(result.size).toBe(fileContent.length);

    // Fetch the uploaded file back
    const getRes = await request(port, 'GET', result.url);
    expect(getRes.status).toBe(200);
    expect(getRes.body.toString('utf-8')).toBe('uploaded-image-bytes');
  });

  it('upload with missing file returns 400', async () => {
    const boundary = '----empty';
    const body = Buffer.from(`--${boundary}--\r\n`, 'utf-8');
    const res = await request(port, 'POST', '/preview/upload', body, {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length.toString(),
    });
    expect(res.status).toBe(400);
  });

  it('rejects upload with text/html MIME (XSS guard)', async () => {
    const boundary = '----xss';
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="evil.html"\r\nContent-Type: text/html\r\n\r\n`,
        'utf-8',
      ),
      Buffer.from('<script>alert(1)</script>', 'utf-8'),
      Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8'),
    ]);
    const res = await request(port, 'POST', '/preview/upload', body, {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length.toString(),
    });
    expect(res.status).toBe(415);
  });

  it('uploads with image/jpeg MIME succeed (positive control for the allowlist)', async () => {
    const boundary = '----jpeg-ok';
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="ok.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`,
        'utf-8',
      ),
      Buffer.from('\xff\xd8\xff\xe0', 'binary'),
      Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8'),
    ]);
    const res = await request(port, 'POST', '/preview/upload', body, {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length.toString(),
    });
    expect(res.status).toBe(200);
    const json = JSON.parse(res.body.toString('utf-8'));
    // Server-issued extension must come from the canonical MIME map — even if
    // the upload claimed .jpg, served URL ends in .jpg/.jpeg (allowlist ext).
    expect(json.url).toMatch(/\.jpe?g$/);
  });

  it('returned upload URL is served back with X-Content-Type-Options: nosniff', async () => {
    const boundary = '----nosniff';
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="x.png"\r\nContent-Type: image/png\r\n\r\n`,
        'utf-8',
      ),
      Buffer.from('PNGBYTES', 'utf-8'),
      Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8'),
    ]);
    const upRes = await request(port, 'POST', '/preview/upload', body, {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length.toString(),
    });
    expect(upRes.status).toBe(200);
    const json = JSON.parse(upRes.body.toString('utf-8'));

    // Fetch and inspect the upload response headers.
    const getResHeaders = await new Promise<Record<string, string>>((resolve, reject) => {
      const req = http.request(
        { host: 'localhost', port, method: 'GET', path: json.url },
        (res) => {
          const h: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            if (typeof v === 'string') h[k] = v;
          }
          res.resume();
          res.on('end', () => resolve(h));
        },
      );
      req.on('error', reject);
      req.end();
    });
    expect(getResHeaders['x-content-type-options']).toBe('nosniff');
  });

  it('rejects upload with image/svg+xml MIME (XSS guard)', async () => {
    const boundary = '----svg';
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="evil.svg"\r\nContent-Type: image/svg+xml\r\n\r\n`,
        'utf-8',
      ),
      Buffer.from('<svg><script>alert(1)</script></svg>', 'utf-8'),
      Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8'),
    ]);
    const res = await request(port, 'POST', '/preview/upload', body, {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length.toString(),
    });
    expect(res.status).toBe(415);
  });
});

/**
 * Rate-limit spec runs on a dedicated server with a tight cap so we don't
 * have to fire 30 uploads to exercise the limiter (production default).
 */
describe('Upload rate limiting', () => {
  const port = 43221;
  let rlServer: ReturnType<typeof createPreviewServer>;
  let rlUploadDir: string;

  beforeAll(async () => {
    rlUploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-rl-'));
    rlServer = createPreviewServer({
      port,
      bundles: [buildBundle()],
      uploadDir: rlUploadDir,
      uploadRateLimit: { max: 2, windowMs: 60_000 },
    });
    await rlServer.start();
  });
  afterAll(async () => {
    await rlServer.stop();
    fs.rmSync(rlUploadDir, { recursive: true, force: true });
  });

  function makePngUpload(): { body: Buffer; headers: Record<string, string> } {
    const boundary = '----rl' + Math.random().toString(36).slice(2);
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="x.png"\r\nContent-Type: image/png\r\n\r\n`,
        'utf-8',
      ),
      Buffer.from('PNGDATA', 'utf-8'),
      Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8'),
    ]);
    return {
      body,
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length.toString(),
        // Pin all calls to the same simulated client IP so they hit the same bucket.
        'X-Forwarded-For': '203.0.113.42',
      },
    };
  }

  it('returns 429 after the third upload from the same client (max=2)', async () => {
    const u1 = makePngUpload();
    const r1 = await request(port, 'POST', '/preview/upload', u1.body, u1.headers);
    expect(r1.status).toBe(200);

    const u2 = makePngUpload();
    const r2 = await request(port, 'POST', '/preview/upload', u2.body, u2.headers);
    expect(r2.status).toBe(200);

    const u3 = makePngUpload();
    const r3 = await request(port, 'POST', '/preview/upload', u3.body, u3.headers);
    expect(r3.status).toBe(429);
    const errJson = JSON.parse(r3.body.toString('utf-8'));
    expect(errJson.error).toMatch(/rate limit/i);
  });

  it('distinct client IPs each get their own bucket', async () => {
    const fresh = createPreviewServer({
      port: 43222,
      bundles: [buildBundle()],
      uploadDir: rlUploadDir,
      uploadRateLimit: { max: 1, windowMs: 60_000 },
    });
    await fresh.start();
    try {
      const a = makePngUpload();
      a.headers['X-Forwarded-For'] = '10.0.0.1';
      const ra = await request(43222, 'POST', '/preview/upload', a.body, a.headers);
      expect(ra.status).toBe(200);

      const b = makePngUpload();
      b.headers['X-Forwarded-For'] = '10.0.0.2';
      const rb = await request(43222, 'POST', '/preview/upload', b.body, b.headers);
      expect(rb.status).toBe(200);

      // Repeat from client A — its bucket is full, B's is not.
      const a2 = makePngUpload();
      a2.headers['X-Forwarded-For'] = '10.0.0.1';
      const ra2 = await request(43222, 'POST', '/preview/upload', a2.body, a2.headers);
      expect(ra2.status).toBe(429);
    } finally {
      await fresh.stop();
    }
  });
});
