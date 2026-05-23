import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as url from 'node:url';
import { randomUUID } from 'node:crypto';
import { InMemoryState } from './in-memory-state';
import { runGrade } from './grade-runner';
import { createTracer, instrumentPlugin } from './instrument';
import type { LoadedBundle } from '../core/types';

export interface FixturesEntry {
  /** Bundle id that owns these fixtures (used as URL path segment) */
  bundleId: string;
  /** Filesystem directory containing the fixture files */
  dir: string;
}

export interface PreviewServerOptions {
  port: number;
  staticDir?: string; // path to PreviewApp built UI assets
  bundles: LoadedBundle[];
  /** Fixtures registries (§15 resource mock) — auto-detected from bundles when omitted */
  fixtures?: FixturesEntry[];
  /** Temporary directory for mock uploads (default: <os.tmpdir>/preview-uploads) */
  uploadDir?: string;
  /** Max upload size in bytes (default: 10 MB) */
  maxUploadBytes?: number;
}

export interface PreviewServer {
  start(): Promise<{ port: number; url: string }>;
  stop(): Promise<void>;
  state: InMemoryState;
}

/**
 * Lightweight HTTP server for previewing exercise type plugins.
 *
 * Routes:
 *   GET  /preview/health                       liveness check
 *   GET  /preview/bundles                      list registered bundles
 *   GET  /preview/bundles/:bundleId            bundle details (stories)
 *   POST /preview/sessions                     { bundleId, storyName } → { sessionId }
 *   GET  /preview/sessions/:id                 session state
 *   POST /preview/sessions/:id/ans             { ans } → updates working answer
 *   POST /preview/sessions/:id/check           { ans? } → grade
 *   GET  /preview/sessions/:id/inspector       grade history + prompt trace
 *   POST /preview/sessions/:id/reset           clear ans + history
 *   GET  /                                     PreviewApp UI (when staticDir is set)
 */
export function createPreviewServer(options: PreviewServerOptions): PreviewServer {
  const state = new InMemoryState();
  for (const b of options.bundles) state.registerBundle(b);

  // Initialize upload dir
  const uploadDir = options.uploadDir ?? path.join(os.tmpdir(), 'preview-uploads');
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
  } catch {
    /* ignore */
  }

  // Initialize fixtures map (allow auto-detection from bundle filePath/<dir>/fixtures)
  const fixturesMap = new Map<string, string>(); // bundleId → absolute fixtures dir
  if (options.fixtures) {
    for (const f of options.fixtures) fixturesMap.set(f.bundleId, path.resolve(f.dir));
  }
  for (const b of options.bundles) {
    if (fixturesMap.has(b.plugin.type)) continue;
    const guess = path.resolve(path.dirname(b.filePath), '..', 'fixtures');
    if (fs.existsSync(guess) && fs.statSync(guess).isDirectory()) {
      fixturesMap.set(b.plugin.type, guess);
    }
  }

  const opts = {
    ...options,
    uploadDir,
    maxUploadBytes: options.maxUploadBytes ?? 10 * 1024 * 1024,
    fixturesMap,
  };

  const server = http.createServer(async (req, res) => {
    try {
      await handleRequest(req, res, state, opts);
    } catch (err) {
      console.error('[preview-server] request failed', err);
      sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
  });

  return {
    state,
    async start() {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(options.port, () => resolve());
      });
      return { port: options.port, url: `http://localhost:${options.port}` };
    },
    async stop() {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

interface FullOptions extends PreviewServerOptions {
  uploadDir: string;
  maxUploadBytes: number;
  fixturesMap: Map<string, string>;
}

async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  state: InMemoryState,
  options: FullOptions,
): Promise<void> {
  const parsed = url.parse(req.url ?? '/', true);
  const pathname = parsed.pathname ?? '/';
  const method = req.method ?? 'GET';

  // CORS for local Vite dev server scenarios
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ── Fixtures (§15 resource mock) ──
  const fixturesMatch = pathname.match(/^\/preview\/fixtures\/([^/]+)\/(.+)$/);
  if (fixturesMatch && method === 'GET') {
    const [, bundleId, rel] = fixturesMatch;
    const baseDir = options.fixturesMap.get(bundleId);
    if (!baseDir) return sendJson(res, 404, { error: 'No fixtures for bundle' });
    const full = path.resolve(baseDir, rel);
    if (!full.startsWith(baseDir)) return sendJson(res, 403, { error: 'forbidden' });
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
      return sendJson(res, 404, { error: 'fixture not found' });
    }
    const mime = mimeFromExt(path.extname(full));
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
    fs.createReadStream(full).pipe(res);
    return;
  }

  // ── Upload (mock) ──
  if (pathname === '/preview/upload' && method === 'POST') {
    return handleUpload(req, res, options);
  }

  // Serve previously uploaded files
  const uploadGetMatch = pathname.match(/^\/preview\/uploads\/([\w.\-]+)$/);
  if (uploadGetMatch && method === 'GET') {
    const filename = uploadGetMatch[1];
    const full = path.resolve(options.uploadDir, filename);
    if (!full.startsWith(options.uploadDir)) return sendJson(res, 403, { error: 'forbidden' });
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
      return sendJson(res, 404, { error: 'upload not found' });
    }
    res.writeHead(200, { 'Content-Type': mimeFromExt(path.extname(full)) });
    fs.createReadStream(full).pipe(res);
    return;
  }

  // ── API routes ──
  if (pathname === '/preview/health') {
    return sendJson(res, 200, { ok: true, bundles: state.listBundles().length });
  }

  if (pathname === '/preview/bundles' && method === 'GET') {
    return sendJson(
      res,
      200,
      state.listBundles().map((b) => ({
        bundleId: state.bundleId(b),
        plugin: { type: b.plugin.type, displayName: b.plugin.displayName },
        meta: b.meta,
        stories: Object.entries(b.stories).map(([name, s]) => ({
          name,
          displayName: s.name,
          locale: s.locale,
          initialRole: s.initialRole,
        })),
      })),
    );
  }

  const bundleMatch = pathname.match(/^\/preview\/bundles\/([^/]+)$/);
  if (bundleMatch && method === 'GET') {
    const bundle = state.getBundle(bundleMatch[1]);
    if (!bundle) return sendJson(res, 404, { error: 'Bundle not found' });
    return sendJson(res, 200, {
      bundleId: state.bundleId(bundle),
      plugin: { type: bundle.plugin.type, displayName: bundle.plugin.displayName },
      meta: bundle.meta,
      stories: bundle.stories,
    });
  }

  if (pathname === '/preview/sessions' && method === 'POST') {
    const body = await readJson(req);
    const bundleId = String(body.bundleId ?? '');
    const storyName = String(body.storyName ?? '');
    const bundle = state.getBundle(bundleId);
    if (!bundle) return sendJson(res, 404, { error: 'Bundle not found' });
    const session = state.createSession(bundle, storyName);
    return sendJson(res, 200, { sessionId: session.sessionId, story: session.story });
  }

  const sessMatch = pathname.match(/^\/preview\/sessions\/([^/]+)(?:\/(.+))?$/);
  if (sessMatch) {
    const sessionId = sessMatch[1];
    const sub = sessMatch[2];
    const session = state.getSession(sessionId);
    if (!session) return sendJson(res, 404, { error: 'Session not found' });

    if (!sub && method === 'GET') {
      return sendJson(res, 200, {
        sessionId,
        storyName: session.storyName,
        ans: session.ans,
        gradeHistory: session.gradeHistory,
      });
    }

    if (sub === 'ans' && method === 'POST') {
      const body = await readJson(req);
      session.ans = (body.ans as Record<string, unknown>) ?? {};
      return sendJson(res, 200, { ok: true, ans: session.ans });
    }

    if (sub === 'check' && method === 'POST') {
      const body = await readJson(req);
      const ans = (body.ans ?? session.ans) as Record<string, unknown>;
      const bundle = state.getBundle(session.story.answerKey.type as string);
      if (!bundle) return sendJson(res, 500, { error: 'Bundle missing for session' });

      // Wrap the plugin in a tracer so we record lifecycle events (grade calls
      // + timings + any thrown errors). The instrumented bundle is used for
      // this single request — original bundle stays untouched.
      const tracer = createTracer();
      const instrumentedPlugin = instrumentPlugin(
        bundle.plugin as Record<string, unknown> & { type: string },
        tracer,
      );
      const instrumentedBundle: LoadedBundle = { ...bundle, plugin: instrumentedPlugin };

      const result = await runGrade(instrumentedBundle, session.story, ans);
      state.recordGrade(sessionId, { ans }, result, result.durationMs);
      for (const ev of tracer.events()) state.recordLifecycle(sessionId, ev);
      return sendJson(res, 200, result);
    }

    if (sub === 'inspector' && method === 'GET') {
      const lifecycle = state.getLifecycle(sessionId);
      const counts: Record<string, number> = {};
      for (const e of lifecycle) counts[e.method] = (counts[e.method] ?? 0) + 1;
      const bundle = state.getBundle(session.story.answerKey.type as string);
      return sendJson(res, 200, {
        sessionId,
        gradeHistory: session.gradeHistory,
        prompts: state.getPromptTrace(sessionId),
        lifecycle,
        lifecycleCounts: counts,
        // AnswerKey sanitize diff: full raw vs (placeholder for plugin-side
        // sanitize). Plugins that ship a runtime sanitize() can expose it here
        // in a future revision.
        answerKey: {
          raw: session.story.answerKey,
          // Stories may attach `sanitizedAnswerKey` directly so the preview can
          // display the diff. When absent we leave it null.
          sanitized:
            ((session.story as unknown as { sanitizedAnswerKey?: unknown }).sanitizedAnswerKey) ??
            null,
        },
        bundle: bundle
          ? { type: bundle.plugin.type, meta: bundle.meta }
          : null,
      });
    }

    if (sub === 'reset' && method === 'POST') {
      const updated = state.resetSession(sessionId);
      return sendJson(res, 200, { ok: true, session: updated });
    }

    // ── §14 L3: build-prompt — return the prompt specs without firing LLM ──
    if (sub === 'build-prompt' && method === 'POST') {
      const bundle = state.getBundle(session.story.answerKey.type as string);
      if (!bundle) return sendJson(res, 500, { error: 'Bundle missing for session' });
      const pluginRef = bundle.plugin as unknown as Record<string, unknown> & {
        buildGradePrompt?: (ctx: { key: unknown; data: unknown }) => unknown;
      };
      if (typeof pluginRef.buildGradePrompt !== 'function') {
        return sendJson(res, 400, {
          error: `Plugin "${bundle.plugin.type}" does not implement buildGradePrompt — L3 not available`,
        });
      }
      const specs = pluginRef.buildGradePrompt({
        key: session.story.answerKey,
        data: session.ans,
      });
      return sendJson(res, 200, { specs });
    }

    // ── §14 L3: rerun-parse — re-grade with (possibly edited) LLM responses ──
    if (sub === 'rerun-parse' && method === 'POST') {
      const body = await readJson(req);
      const editedResponses = Array.isArray(body.editedResponses)
        ? (body.editedResponses as string[])
        : [];
      const bundle = state.getBundle(session.story.answerKey.type as string);
      if (!bundle) return sendJson(res, 500, { error: 'Bundle missing for session' });
      const pluginRef = bundle.plugin as unknown as Record<string, unknown> & {
        parseGradeResponse?: (responses: string[], ctx: { key: unknown; data: unknown }) => unknown;
      };
      if (typeof pluginRef.parseGradeResponse !== 'function') {
        return sendJson(res, 400, {
          error: `Plugin "${bundle.plugin.type}" does not implement parseGradeResponse — L3 not available`,
        });
      }
      try {
        const parsed = pluginRef.parseGradeResponse(editedResponses, {
          key: session.story.answerKey,
          data: session.ans,
        });
        return sendJson(res, 200, { ok: true, result: parsed });
      } catch (e) {
        return sendJson(res, 500, {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  // ── Static UI ──
  if (options.staticDir) {
    const filePath = pathname === '/' ? '/index.html' : pathname;
    const full = path.join(options.staticDir, filePath);
    if (full.startsWith(options.staticDir) && fs.existsSync(full) && fs.statSync(full).isFile()) {
      const ext = path.extname(full).slice(1);
      const mime =
        ext === 'html'
          ? 'text/html; charset=utf-8'
          : ext === 'js'
            ? 'application/javascript'
            : ext === 'css'
              ? 'text/css'
              : ext === 'json'
                ? 'application/json'
                : 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime });
      fs.createReadStream(full).pipe(res);
      return;
    }
  }

  sendJson(res, 404, { error: 'Not found', pathname });
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function mimeFromExt(ext: string): string {
  const e = ext.toLowerCase().replace(/^\./, '');
  switch (e) {
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    case 'svg': return 'image/svg+xml';
    case 'json': return 'application/json';
    case 'txt': return 'text/plain';
    case 'mp3': return 'audio/mpeg';
    case 'mp4': return 'video/mp4';
    case 'html': return 'text/html; charset=utf-8';
    case 'js': return 'application/javascript';
    case 'css': return 'text/css';
    default: return 'application/octet-stream';
  }
}

/**
 * Minimal multipart/form-data parser — just enough for single-file uploads
 * via fetch + FormData. Returns the first file's buffer + filename.
 */
async function readMultipartFile(
  req: http.IncomingMessage,
  maxBytes: number,
): Promise<{ buffer: Buffer; filename: string } | null> {
  const ct = req.headers['content-type'] ?? '';
  const m = /boundary=([^;]+)/i.exec(String(ct));
  if (!m) return null;
  const boundary = m[1];

  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    total += chunk.length;
    if (total > maxBytes) throw new Error('upload too large');
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks);
  const sep = Buffer.from(`--${boundary}`);
  const parts: Buffer[] = [];
  let idx = 0;
  while (true) {
    const start = body.indexOf(sep, idx);
    if (start === -1) break;
    const next = body.indexOf(sep, start + sep.length);
    if (next === -1) break;
    parts.push(body.slice(start + sep.length, next));
    idx = next;
  }
  for (const part of parts) {
    // Skip the CRLF after boundary
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;
    const header = part.slice(0, headerEnd).toString('utf-8');
    const dispMatch = /filename="([^"]+)"/.exec(header);
    if (!dispMatch) continue;
    const filename = path.basename(dispMatch[1]);
    // Strip leading \r\n + trailing \r\n--
    let content = part.slice(headerEnd + 4);
    if (content.length >= 2 && content[content.length - 2] === 13 && content[content.length - 1] === 10) {
      content = content.slice(0, -2);
    }
    return { buffer: content, filename };
  }
  return null;
}

async function handleUpload(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  options: FullOptions,
): Promise<void> {
  try {
    const file = await readMultipartFile(req, options.maxUploadBytes);
    if (!file) return sendJson(res, 400, { error: 'no file in upload' });
    const ext = path.extname(file.filename);
    const id = randomUUID();
    const filename = `${id}${ext}`;
    fs.writeFileSync(path.join(options.uploadDir, filename), file.buffer);
    return sendJson(res, 200, {
      url: `/preview/uploads/${filename}`,
      filename,
      size: file.buffer.length,
    });
  } catch (e) {
    return sendJson(res, 400, { error: e instanceof Error ? e.message : String(e) });
  }
}

async function readJson(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf-8');
      if (!text) return resolve({});
      try {
        resolve(JSON.parse(text));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}
