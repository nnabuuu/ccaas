/**
 * CcaasProxyController — thin proxy from the browser to ccaas's
 * agent-runtime endpoints.
 *
 * **Why this exists** (per the platform design):
 *   - ccaas knows tenants, not end users. Each solution backend is one
 *     ccaas tenant and holds the one ccaas API key for its tenant.
 *   - End users belong to the solution, not to ccaas. They authenticate
 *     to the solution backend (using whatever the solution's own auth
 *     is) and the solution backend mediates every ccaas call.
 *   - The browser must never see the ccaas key.
 *
 * Prior to this controller, the creator app's `useProjectChanges` hook
 * opened `EventSource('http://ccaas:3001/projects/:id/changes?token=...')`
 * direct from the browser with the ccaas key pasted into localStorage.
 * Wrong shape — it leaked the solution's master key onto every operator's
 * machine and broke the "browser belongs to the solution" boundary.
 *
 * This controller replaces that path. The browser hits a relative
 * `/api/projects/:id/changes` (or `/invalidate`); we open an upstream
 * connection to ccaas with the env-var key and pipe events back.
 *
 * **Auth model today**: live-lesson's existing controllers are anonymous
 * (no @UseGuards on classroom / project / lesson). That's the solution's
 * current auth posture. Tighter auth (cookie session, JWT) is a
 * solution-author concern, not this controller's. When live-lesson adds
 * an auth guard, slap it on here too.
 *
 * **Env**:
 *   - `CCAAS_URL`         — base URL for ccaas (default `http://localhost:3001`)
 *   - `CCAAS_API_KEY`     — the solution's ccaas tenant API key (required;
 *                           controller throws 503 if unset so the operator
 *                           notices on the first request rather than later)
 */

import {
  BadGatewayException,
  Controller,
  Get,
  HttpCode,
  Logger,
  Param,
  Post,
  Sse,
  type MessageEvent,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { CcaasUpstream } from './ccaas-upstream.service';
import { scrubToken } from './scrub-token';

@ApiTags('ccaas-proxy')
@Controller('projects/:projectId')
export class CcaasProxyController {
  private readonly logger = new Logger(CcaasProxyController.name);

  constructor(private readonly upstream: CcaasUpstream) {}

  /**
   * Live SSE feed of agent-runtime ChangeEvents for `projectId`, proxied
   * from ccaas. The upstream connection uses the solution's CCAAS_API_KEY
   * env var as the `?token=` auth (Phase 2b-2). Client disconnect aborts
   * the upstream connection via AbortController.
   */
  @Get('changes')
  @Sse('changes')
  @ApiOperation({
    summary: 'Proxy ccaas SSE change feed (browser never holds the ccaas key)',
  })
  @ApiParam({ name: 'projectId', type: String })
  changes$(@Param('projectId') projectId: string): Observable<MessageEvent> {
    const { url, key } = this.upstream.resolveCcaas();
    // Browser hits `/api/projects/:projectId/changes` (live-lesson keeps
    // "project" as its domain word); proxy calls ccaas's canonical
    // `/workspaces/:identity/changes` under the hood. ccaas's old
    // `/projects/:identity/changes` route still works as an alias for
    // one release, but we flip to the canonical name here so the
    // dependency direction is clean.
    //
    // The agent-runtime routes deliberately sit at the root of ccaas
    // (no `/api/v1/` prefix — see `WorkspaceChangesController` header).
    const upstreamUrl =
      `${url}/workspaces/${encodeURIComponent(projectId)}/changes?token=${encodeURIComponent(key)}`;

    return new Observable<MessageEvent>((subscriber) => {
      const controller = new AbortController();
      let cancelled = false;

      void (async () => {
        let res: Response;
        try {
          res = await fetch(upstreamUrl, {
            method: 'GET',
            headers: { Accept: 'text/event-stream' },
            signal: controller.signal,
          });
        } catch (err) {
          if (cancelled) return; // expected — caller closed the stream
          subscriber.error(this.upstream.wrapUpstreamError('connect', err));
          return;
        }
        if (!res.ok) {
          // ccaas returned 401/403/404; surface a single error event so
          // the browser sees it as an Observable error (NestJS @Sse will
          // close the connection on Observable error). Scrub any
          // accidentally-echoed token from the upstream body before
          // embedding — see `scrubToken` for the rationale.
          subscriber.error(
            new Error(
              `ccaas upstream ${res.status} for project ${projectId}: ${scrubToken(await this.upstream.readErrorBody(res))}`,
            ),
          );
          return;
        }
        // Defense-in-depth: refuse to consume non-SSE upstreams. A CDN
        // intercept, captive portal, or misconfigured reverse proxy might
        // return 200 OK with HTML; pumping that as SSE would hang the
        // subscriber forever (no \n\n delimiter, no error).
        const upstreamCt = res.headers.get('content-type') ?? '';
        if (!upstreamCt.includes('text/event-stream')) {
          subscriber.error(
            new Error(
              `ccaas upstream returned non-SSE content-type for project ${projectId}: ${upstreamCt}`,
            ),
          );
          return;
        }
        if (!res.body) {
          subscriber.error(new Error('ccaas upstream has no body'));
          return;
        }
        try {
          await this.pumpSse(res.body, subscriber, () => cancelled);
        } catch (err) {
          if (!cancelled) subscriber.error(this.upstream.wrapUpstreamError('stream', err));
        } finally {
          if (!cancelled) subscriber.complete();
        }
      })();

      // Teardown: client disconnected (browser closed the EventSource).
      // Abort the upstream so we don't leak the inbound connection.
      return () => {
        cancelled = true;
        controller.abort();
      };
    });
  }

  /**
   * Request an early sync flush from ccaas. Useful when the GUI just
   * persisted a change and wants the agent to see it before the next
   * turn boundary. Fire-and-forget on the client side; we await the
   * upstream POST so the response code reflects success or failure.
   */
  @Post('invalidate')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Proxy ccaas invalidate (early-sync hint) for the project',
  })
  @ApiParam({ name: 'projectId', type: String })
  async invalidate(
    @Param('projectId') projectId: string,
  ): Promise<{ accepted: boolean }> {
    const { url, key } = this.upstream.resolveCcaas();
    // Browser keeps the "project" word in its public URL; proxy calls
    // ccaas's canonical /workspaces/ route at the root namespace. See
    // `changes$` above for the same rationale.
    const upstreamUrl =
      `${url}/workspaces/${encodeURIComponent(projectId)}/invalidate?token=${encodeURIComponent(key)}`;
    let res: Response;
    try {
      res = await fetch(upstreamUrl, { method: 'POST' });
    } catch (err) {
      throw this.upstream.wrapUpstreamError('connect', err);
    }
    if (!res.ok) {
      // Auth failures (401/403) are operator-actionable — wrong or
      // expired CCAAS_API_KEY env. Failing silently here would leave
      // SSE technically working (browser sees calm 202s forever) while
      // the agent never re-syncs in response to GUI edits. Promote to
      // 502 so the misconfig surfaces. Other upstream failures (5xx,
      // 404, etc.) ARE "optional optimization" — log + return calmly.
      if (res.status === 401 || res.status === 403) {
        this.logger.error(
          `ccaas invalidate upstream ${res.status} for project ${projectId}: ` +
          `CCAAS_API_KEY is likely invalid or expired`,
        );
        throw new BadGatewayException(
          `ccaas auth failed (${res.status}); check CCAAS_API_KEY env var`,
        );
      }
      this.logger.warn(
        `ccaas invalidate upstream ${res.status} for project ${projectId}`,
      );
      return { accepted: false };
    }
    return { accepted: true };
  }

  /**
   * Drain an SSE response body and forward each event block to the
   * subscriber as a NestJS `MessageEvent`. Stops early if `isCancelled()`
   * returns true (set by the teardown function on client disconnect).
   *
   * SSE framing: events are separated by blank lines. Each block has
   * lines like `id: 1`, `event: <name>`, `data: <payload>`. We only
   * forward `data` (NestJS rebuilds the framing on the outbound side).
   * Multi-line `data:` are concatenated with `\n` per the spec.
   *
   * Line-ending handling: the SSE spec allows `\r\n`, `\r`, or `\n` as
   * event-block terminators. ccaas's `@Sse` decorator emits `\n` only,
   * but intermediate proxies (HTTP/2 implementations, IIS, some CDNs)
   * may normalize line endings either way. We normalize all variants to
   * `\n` on each chunk before scanning for the `\n\n` block separator.
   */
  private async pumpSse(
    body: ReadableStream<Uint8Array>,
    subscriber: { next(v: MessageEvent): void },
    isCancelled: () => boolean,
  ): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    try {
      while (true) {
        if (isCancelled()) return;
        const { value, done } = await reader.read();
        if (done) return;
        // Append + normalize CRLF / lone CR to LF so the \n\n scan finds
        // event boundaries regardless of upstream line-ending convention.
        buffer += decoder
          .decode(value, { stream: true })
          .replace(/\r\n/g, '\n')
          .replace(/\r/g, '\n');
        // Process whole event blocks; a block ends at a blank line
        // (\n\n in the buffer). Leftover partial block stays in buffer.
        let idx: number;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const block = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const dataLines: string[] = [];
          for (const line of block.split('\n')) {
            // Skip comment lines (start with `:`) and any non-data fields
            // — the framing is reconstructed by NestJS @Sse on outbound,
            // but we keep `id` if present so re-subscribe semantics carry.
            if (line.startsWith('data:')) {
              dataLines.push(line.slice(5).replace(/^ /, ''));
            }
          }
          if (dataLines.length > 0) {
            const data = dataLines.join('\n');
            // Try to parse as JSON; ccaas always emits JSON, but if
            // upstream ever sends a raw string we forward it verbatim.
            let parsed: unknown = data;
            try {
              parsed = JSON.parse(data);
            } catch {
              /* keep raw */
            }
            subscriber.next({ data: parsed as Record<string, unknown> });
          }
        }
      }
    } finally {
      try {
        reader.releaseLock();
      } catch {
        /* best-effort */
      }
    }
  }

}
