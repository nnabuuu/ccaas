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
});
