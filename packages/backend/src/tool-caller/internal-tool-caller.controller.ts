/**
 * Internal HTTP API the proxy MCP bundle calls back into.
 *
 * Routes:
 *   GET  /api/v1/internal/tool-caller/sessions/:sessionId/tools
 *   POST /api/v1/internal/tool-caller/sessions/:sessionId/invoke
 *
 * Auth model: the proxy subprocess sends `X-Proxy-Token` with the
 * per-session shared secret created by `McpEngineAdapter`. The
 * regular API-key auth is bypassed via `@Public()` because this
 * endpoint is never browser-facing — it's loopback-only (the proxy
 * runs on the same host). Listening on 127.0.0.1 + secret-token
 * gates production safely; the controller still rejects non-loopback
 * peers defensively in case operators expose ccaas on 0.0.0.0.
 *
 * Wire shape: see comment at the top of
 * packages/mcp/tool-caller-proxy-server/src/index.ts — the proxy
 * server speaks this protocol. Changing either side requires both
 * to ship together.
 *
 * Reference: docs/design-tool-caller-proxy.md §5.1.
 */

import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Logger,
  NotFoundException,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import * as zts from 'zod-to-json-schema';
import type { ZodTypeAny } from 'zod';
import { Public } from '../auth/decorators';
import { McpEngineAdapterService } from './adapters/mcp-engine-adapter.service';
import { SolutionToolkitRegistry } from './solution-toolkit-registry';
import { ToolCallerProxyService } from './tool-caller-proxy.service';

/**
 * `zod-to-json-schema`'s exported function has an inferred return type
 * that pulls in the full Zod schema-shape graph; using it directly in
 * a generic mapping context trips `TS2589: type instantiation is
 * excessively deep`. Routing through an explicitly-typed function
 * reference flattens the inference and produces a plain
 * `Record<string, unknown>` for the rest of the controller to consume.
 *
 * Runtime behavior is identical — this is purely a typing escape hatch.
 */
const zodToJsonSchemaTyped: (s: ZodTypeAny) => Record<string, unknown> =
  (s) => (zts as unknown as { zodToJsonSchema: (...a: unknown[]) => unknown })
    .zodToJsonSchema(s, { $refStrategy: 'none' }) as Record<string, unknown>;

/**
 * The remote IP set on `Request` is `string | undefined` in express
 * types; we treat anything other than loopback as a forbidden peer
 * since this endpoint is never meant to reach the public network.
 *
 * `undefined` is intentionally NOT in the allowlist. Some in-process
 * supertest harnesses (and a hypothetical Unix-socket transport)
 * leave `remoteAddress` undefined — accepting that quietly would
 * bypass the entire loopback gate. Tests must construct a fake
 * request with `socket.remoteAddress = '127.0.0.1'` (see the spec
 * helpers in this directory for the pattern). If real Unix-socket
 * transport ever lands, gate on a typed `req.socket instanceof
 * UnixSocket` check rather than a sentinel value.
 */
const LOOPBACK_PEERS = new Set<string>([
  '127.0.0.1',
  '::1',
  '::ffff:127.0.0.1',
]);

@ApiTags('internal-tool-caller')
@Controller('api/v1/internal/tool-caller/sessions/:sessionId')
export class InternalToolCallerController {
  private readonly logger = new Logger(InternalToolCallerController.name);

  constructor(
    private readonly registry: SolutionToolkitRegistry,
    private readonly proxy: ToolCallerProxyService,
    private readonly adapter: McpEngineAdapterService,
  ) {}

  @Get('tools')
  @Public()
  async listTools(
    @Param('sessionId') sessionId: string,
    @Headers('x-proxy-token') token: string | undefined,
    @Req() req: Request,
  ): Promise<{
    tools: Array<{
      name: string;
      description: string;
      inputSchema: Record<string, unknown>;
    }>;
  }> {
    this.assertLoopback(req);
    this.assertValidToken(sessionId, token);
    const ctx = this.adapter.getContext(sessionId);
    if (!ctx) {
      // Token validated but context missing means we have a stale
      // session registration — log + 404 so the proxy fails loudly.
      this.logger.warn(
        `Tools requested for session ${sessionId} with valid token but no registered context`,
      );
      throw new NotFoundException(`session ${sessionId} not registered with engine adapter`);
    }
    const tools = this.registry.listToolsForSolution(ctx.solutionId).map((t) => ({
      name: t.qualifiedName,
      description: t.definition.description,
      // Prefer the upstream JSON Schema verbatim (e.g. from a probed
      // stdio MCP server) when set; otherwise derive from Zod. This
      // avoids drift between what the stdio server's own server.tool()
      // call advertises and what we forward to Claude Code.
      inputSchema:
        t.definition.jsonSchemaOverride ??
        zodToJsonSchemaTyped(t.definition.argsSchema),
    }));
    return { tools };
  }

  @Post('invoke')
  @Public()
  async invoke(
    @Param('sessionId') sessionId: string,
    @Body() body: { tool?: string; args?: Record<string, unknown> },
    @Headers('x-proxy-token') token: string | undefined,
    @Req() req: Request,
  ): Promise<{ ok: true; content: Array<{ type: 'text'; text: string }> } | { ok: false; code: string; reason: string }> {
    this.assertLoopback(req);
    this.assertValidToken(sessionId, token);
    const ctx = this.adapter.getContext(sessionId);
    if (!ctx) {
      throw new NotFoundException(`session ${sessionId} not registered with engine adapter`);
    }
    if (!body || typeof body.tool !== 'string') {
      return {
        ok: false,
        code: 'validation_failed',
        reason: 'Request body must include a non-empty `tool` field.',
      };
    }
    const result = await this.proxy.invoke(
      { tool: body.tool, args: body.args ?? {} },
      ctx,
    );
    // Result type already matches the proxy's discriminated union;
    // explicit cast keeps Nest's serializer from inferring `unknown`.
    return result;
  }

  private assertLoopback(req: Request): void {
    // express's `req.ip` honors trust-proxy; we want the actual socket
    // peer so we read `req.socket.remoteAddress` directly.
    const peer = req.socket?.remoteAddress;
    if (typeof peer !== 'string' || !LOOPBACK_PEERS.has(peer)) {
      this.logger.warn(
        `Rejecting non-loopback peer for internal endpoint: ${peer ?? '<undefined>'}`,
      );
      throw new ForbiddenException('internal endpoint accepts loopback peers only');
    }
  }

  private assertValidToken(sessionId: string, token: string | undefined): void {
    if (!this.adapter.validateToken(sessionId, token)) {
      // No "wrong token" vs "session not registered" distinction in the
      // response — both surface as 401 so a brute-forcer can't enumerate.
      throw new UnauthorizedException('invalid or unknown session token');
    }
  }
}
