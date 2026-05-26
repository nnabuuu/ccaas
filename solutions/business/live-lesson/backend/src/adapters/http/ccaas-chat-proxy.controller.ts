/**
 * CcaasChatProxyController — proxies session-scoped ccaas endpoints
 * (chat history / send / bind-project) from the browser to ccaas.
 *
 * Same architectural rationale as `CcaasProxyController`: the browser
 * must never see the ccaas master key. The solution backend holds
 * `CCAAS_API_KEY` in env, injects it (and the resolved tenantId) on
 * upstream requests, and pipes the response back.
 *
 * Split from CcaasProxyController because the URL prefix differs
 * (`sessions/:sessionId` vs `projects/:projectId`); shared helpers
 * live in `CcaasUpstream`.
 *
 * Routes:
 *   GET  /api/sessions/:sid/messages         → history proxy
 *   POST /api/sessions/:sid/messages         → chat SSE proxy (raw Express)
 *   POST /api/sessions/:sid/bind-project     → bind proxy w/ injected tenantId
 *
 * **Why no /auth/me proxy**: the only thing the browser used /auth/me
 * for was tenant resolution, and that's now server-side via
 * `CcaasUpstream.resolveTenantId()`. The browser never needs to know
 * its tenant — proxy injects it on every upstream call that needs it.
 */

import {
  BadGatewayException,
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CcaasUpstream, scrubToken } from './ccaas-upstream.service';

@ApiTags('ccaas-proxy')
@Controller('sessions/:sessionId')
export class CcaasChatProxyController {
  private readonly logger = new Logger(CcaasChatProxyController.name);

  constructor(private readonly upstream: CcaasUpstream) {}

  /**
   * Proxy ccaas's `GET /api/v1/sessions/:sid/messages`. Used by the
   * creator chat UI to load conversation history on mount / session
   * switch. 404 from upstream is mapped to `{ messages: [] }` because
   * a freshly-created session legitimately has no rows yet and the
   * frontend treats history-empty as the normal initial state.
   */
  @Get('messages')
  @ApiOperation({
    summary: 'Proxy ccaas chat history (no browser-side ccaas key needed)',
  })
  @ApiParam({ name: 'sessionId', type: String })
  async listMessages(
    @Param('sessionId') sessionId: string,
    @Query('limit') limit?: string,
  ): Promise<unknown> {
    const { url, key } = this.upstream.resolveCcaas();
    const qs = limit ? `?limit=${encodeURIComponent(limit)}` : '';
    let res: Response | globalThis.Response;
    try {
      res = await fetch(
        `${url}/api/v1/sessions/${encodeURIComponent(sessionId)}/messages${qs}`,
        { headers: { Authorization: `Bearer ${key}` } },
      );
    } catch (err) {
      throw this.upstream.wrapUpstreamError('connect', err);
    }
    const upstreamRes = res as globalThis.Response;
    if (upstreamRes.status === 404) {
      // Fresh session — no history yet. ccaas returns 404 because the
      // session row hasn't been created; the UI shouldn't surface that
      // as an error, just an empty conversation.
      return { messages: [] };
    }
    if (!upstreamRes.ok) {
      const body = scrubToken(await this.upstream.readErrorBody(upstreamRes));
      this.logger.warn(`ccaas GET messages ${upstreamRes.status}: ${body}`);
      throw new BadGatewayException(
        `ccaas upstream ${upstreamRes.status} for session ${sessionId}`,
      );
    }
    return upstreamRes.json();
  }

  /**
   * Proxy ccaas's `POST /api/v1/sessions/:sid/bind-project`. Injects
   * `tenantId` server-side from the env-cached value, so the browser
   * body only carries `{ projectId }`.
   *
   * 4xx upstream (e.g. session not found, cross-tenant rebind 409,
   * malformed body 400) is promoted to 502 BadGateway so the browser
   * sees a single recognizable error category. The actual upstream
   * status is included in the message for debugging.
   */
  @Post('bind-project')
  @ApiOperation({
    summary: 'Proxy ccaas bind-project (tenantId injected server-side)',
  })
  @ApiParam({ name: 'sessionId', type: String })
  async bindProject(
    @Param('sessionId') sessionId: string,
    @Body() body: { projectId?: string },
  ): Promise<unknown> {
    if (!body?.projectId) {
      throw new BadGatewayException('projectId required in request body');
    }
    const { url, key } = this.upstream.resolveCcaas();
    const tenantId = await this.upstream.resolveTenantId();
    let upstreamRes: globalThis.Response;
    try {
      upstreamRes = await fetch(
        `${url}/api/v1/sessions/${encodeURIComponent(sessionId)}/bind-project`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ projectId: body.projectId, tenantId }),
        },
      );
    } catch (err) {
      throw this.upstream.wrapUpstreamError('connect', err);
    }
    if (!upstreamRes.ok) {
      const text = scrubToken(await this.upstream.readErrorBody(upstreamRes));
      this.logger.warn(
        `ccaas bind-project ${upstreamRes.status} session=${sessionId}: ${text}`,
      );
      throw new BadGatewayException(
        `ccaas upstream ${upstreamRes.status} on bind-project: ${text}`,
      );
    }
    return upstreamRes.json();
  }

  /**
   * Proxy ccaas's `POST /api/v1/sessions/:sid/messages` — the chat
   * send + SSE response stream. NestJS's `@Sse()` decorator only works
   * with `@Get`, so we use raw Express `@Res()` and write the SSE
   * frames ourselves: headers + flush, then pipe upstream chunks
   * verbatim to the browser, then `res.end()` on completion / abort.
   *
   * tenantId is injected server-side; browser sends just `{ message,
   * projectId?, enabledSkills?, templateName? }`. AbortController is
   * wired to the response 'close' event so a client disconnect tears
   * down the upstream connection (no leaked open sockets).
   *
   * Upstream errors before headers go out → SSE `error` event then
   * close. Upstream errors mid-stream → propagate to the browser as
   * a partial response that ends; the chat UI will see the partial
   * agent reply + an SSE 'error' event in its parser.
   */
  @Post('messages')
  @ApiOperation({
    summary: 'Proxy ccaas chat send + SSE response (raw Express; tenantId injected)',
  })
  @ApiParam({ name: 'sessionId', type: String })
  async sendMessage(
    @Param('sessionId') sessionId: string,
    @Body() body: {
      message: string;
      projectId?: string;
      enabledSkills?: string[];
      templateName?: string;
    },
    @Res() res: Response,
  ): Promise<void> {
    const { url, key } = this.upstream.resolveCcaas();
    let tenantId: string;
    try {
      tenantId = await this.upstream.resolveTenantId();
    } catch (err) {
      // Tenant resolution failed BEFORE we touched the response —
      // surface as a normal HTTP error (NestJS exception filter
      // catches), not a half-written SSE stream.
      throw err;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    // Disable nginx response buffering — without this, intermediaries
    // can hold our chunks until the connection closes.
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const controller = new AbortController();
    // Browser disconnect aborts the upstream so we don't leak the
    // open socket to ccaas after the client is gone.
    res.on('close', () => controller.abort());

    let upstream: globalThis.Response;
    try {
      upstream = await fetch(
        `${url}/api/v1/sessions/${encodeURIComponent(sessionId)}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({ ...body, tenantId }),
          signal: controller.signal,
        },
      );
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // Client gone before upstream connected — nothing to do.
        res.end();
        return;
      }
      const safe = scrubToken((err as Error).message ?? String(err));
      res.write(`event: error\ndata: ${JSON.stringify({ message: safe })}\n\n`);
      res.end();
      return;
    }

    if (!upstream.ok || !upstream.body) {
      const status = upstream.status;
      const text = upstream.body ? scrubToken(await this.upstream.readErrorBody(upstream)) : '';
      this.logger.warn(`ccaas POST messages upstream ${status} session=${sessionId}: ${text}`);
      res.write(
        `event: error\ndata: ${JSON.stringify({ status, message: text || `ccaas ${status}` })}\n\n`,
      );
      res.end();
      return;
    }

    // Pipe upstream SSE → downstream. We pass chunks through verbatim;
    // ccaas's SSE formatting (id/data/event lines, blank-line frames)
    // is already correct and the browser's EventSource parser handles
    // it natively. No need to parse-then-rewrite.
    try {
      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (res.writableEnded) break; // client gone
        res.write(decoder.decode(value, { stream: true }));
      }
    } catch (err) {
      // Mid-stream upstream error — write a final SSE error event so
      // the chat UI's event-parser can surface it, then close.
      if ((err as Error).name !== 'AbortError' && !res.writableEnded) {
        const safe = scrubToken((err as Error).message ?? String(err));
        res.write(`event: error\ndata: ${JSON.stringify({ message: safe })}\n\n`);
      }
    } finally {
      if (!res.writableEnded) res.end();
    }
  }
}
