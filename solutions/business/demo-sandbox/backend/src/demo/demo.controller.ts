/**
 * DemoController — serves the single-page demo UI and proxies session
 * traffic to ccaas core (so the browser doesn't need to hold the admin
 * API key or worry about CORS).
 *
 *   GET  /              → index.html (the demo UI)
 *   POST /demo/run      → { message: string } → SSE stream from ccaas
 *
 * Reads `CCAAS_URL` + `CCAAS_API_KEY` from env (same vars the
 * SolutionRegisterService uses). The session id is generated server-side
 * per request; the tenant is hardcoded `demo-sandbox` + template
 * `explore` (per solution.json).
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Res,
  BadRequestException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { Response } from 'express';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';

const TENANT_SLUG = 'demo-sandbox';
const SESSION_TEMPLATE = 'explore';
const FRONTEND_INDEX = resolve(__dirname, '..', '..', '..', 'frontend', 'index.html');

@Controller()
export class DemoController {
  private readonly logger = new Logger(DemoController.name);

  @Get('/')
  serveIndex(@Res() res: Response) {
    if (!existsSync(FRONTEND_INDEX)) {
      throw new InternalServerErrorException(
        `demo frontend not found at ${FRONTEND_INDEX}`,
      );
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(readFileSync(FRONTEND_INDEX, 'utf8'));
  }

  /**
   * GET /demo/fs-diff/:sessionId — proxies ccaas's session FS diff
   * endpoint so the browser doesn't hold the admin key. Returns
   * whatever ccaas returns (200 + diff entries, 404 if session not
   * active, 400 if WORKSPACE_PROVIDER=local). Surfaced as a side
   * panel in the demo frontend.
   */
  @Get('demo/fs-diff/:sessionId')
  async fsDiff(@Res() res: Response): Promise<void> {
    // pull sessionId out of req params (no @Param() to keep the
    // controller signature minimal + map cleanly through res)
    const sessionId = (res.req.params as { sessionId: string }).sessionId;
    // Defense in depth: ccaas's own routing would reject odd values
    // (TenantGuard + SessionFsService), but constrain at the proxy
    // boundary too so a malicious value can't even reach the upstream URL.
    if (!/^[\w-]{1,128}$/.test(sessionId ?? '')) {
      res.status(400).json({ error: 'invalid sessionId (must match ^[\\w-]{1,128}$)' });
      return;
    }
    const ccaasUrl = process.env.CCAAS_URL ?? 'http://localhost:3001';
    const apiKey = process.env.CCAAS_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'CCAAS_API_KEY not set on demo backend' });
      return;
    }
    try {
      const r = await fetch(`${ccaasUrl}/api/v1/sessions/${sessionId}/fs/diff`, {
        headers: { 'x-api-key': apiKey, 'x-tenant-id': TENANT_SLUG },
      });
      const body = await r.text();
      res.status(r.status);
      const ct = r.headers.get('content-type');
      if (ct) res.setHeader('Content-Type', ct);
      res.send(body);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`fs-diff proxy error: ${msg}`);
      res.status(502).json({ error: msg });
    }
  }

  /**
   * POST /demo/run — pipe ccaas's SSE stream straight through to the
   * browser. The body's `message` is what claude sees as the user turn.
   * Optional `sessionId` lets the browser keep a multi-turn conversation
   * (if omitted, a fresh UUID is generated).
   */
  @Post('demo/run')
  async run(
    @Body() body: { message?: string; sessionId?: string },
    @Res() res: Response,
  ): Promise<void> {
    const ccaasUrl = process.env.CCAAS_URL ?? 'http://localhost:3001';
    const apiKey = process.env.CCAAS_API_KEY;
    if (!apiKey) {
      throw new InternalServerErrorException(
        'CCAAS_API_KEY not set on demo backend — cannot proxy session traffic',
      );
    }
    if (!body?.message || typeof body.message !== 'string') {
      throw new BadRequestException('`message` is required and must be a string');
    }
    const sessionId = body.sessionId ?? `demo-${randomUUID().slice(0, 8)}`;

    this.logger.log(
      `Proxying session ${sessionId} (${body.message.length} chars) → ${ccaasUrl}`,
    );

    // Hand back text/event-stream framing to the browser BEFORE awaiting
    // ccaas — so the connection stays open and the browser sees activity
    // even on slow upstream.
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable nginx-style buffering
    res.flushHeaders?.();

    // Send a session-id "meta" event up-front so the browser can render it.
    res.write(`event: session\ndata: ${JSON.stringify({ sessionId })}\n\n`);

    let upstream: Response | undefined;
    try {
      const r = await fetch(`${ccaasUrl}/api/v1/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'x-tenant-id': TENANT_SLUG,
        },
        body: JSON.stringify({
          solutionId: TENANT_SLUG,
          templateName: SESSION_TEMPLATE,
          message: body.message,
        }),
      });

      if (!r.ok || !r.body) {
        const text = await r.text().catch(() => '<no body>');
        res.write(
          `event: error\ndata: ${JSON.stringify({
            status: r.status,
            statusText: r.statusText,
            body: text.slice(0, 1000),
          })}\n\n`,
        );
        res.end();
        return;
      }

      // Stream upstream chunks to browser. fetch's body is a ReadableStream
      // of Uint8Array; pump it through to res.
      const reader = (r.body as any).getReader();
      const decoder = new TextDecoder();
      // Listen for client disconnect so we can stop reading upstream.
      const ac = new AbortController();
      res.on('close', () => ac.abort());

      while (!ac.signal.aborted) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) res.write(decoder.decode(value, { stream: true }));
      }
      try { await reader.cancel(); } catch { /* ignore */ }
      res.end();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Proxy error for session ${sessionId}: ${msg}`);
      try {
        res.write(`event: error\ndata: ${JSON.stringify({ message: msg })}\n\n`);
        res.end();
      } catch {
        // headers may already be sent; nothing more to do
      }
    }
  }
}
