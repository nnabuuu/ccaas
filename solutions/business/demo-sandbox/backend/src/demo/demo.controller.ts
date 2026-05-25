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
          tenantId: TENANT_SLUG,
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
