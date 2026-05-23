import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';
import { InMemoryState } from './in-memory-state';
import { runGrade } from './grade-runner';
import type { LoadedBundle } from '../core/types';

export interface PreviewServerOptions {
  port: number;
  staticDir?: string; // path to PreviewApp built UI assets
  bundles: LoadedBundle[];
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

  const server = http.createServer(async (req, res) => {
    try {
      await handleRequest(req, res, state, options);
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

async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  state: InMemoryState,
  options: PreviewServerOptions,
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
      const result = await runGrade(bundle, session.story, ans);
      state.recordGrade(sessionId, { ans }, result, result.durationMs);
      return sendJson(res, 200, result);
    }

    if (sub === 'inspector' && method === 'GET') {
      return sendJson(res, 200, {
        sessionId,
        gradeHistory: session.gradeHistory,
        prompts: state.getPromptTrace(sessionId),
      });
    }

    if (sub === 'reset' && method === 'POST') {
      const updated = state.resetSession(sessionId);
      return sendJson(res, 200, { ok: true, session: updated });
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
