import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import type { Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import type { SyncField } from '../../../mcp-server/src/common/types';
import { SYNC_FIELDS } from '../../../mcp-server/src/common/types';
import type { JobsService } from '../jobs/jobs.service';

@Injectable()
export class AgentProxyService {
  private readonly logger = new Logger(AgentProxyService.name);
  private readonly ccaasUrl: string;
  private readonly tenantId = 'quiz-analyzer';
  private jobsService: JobsService | null = null;

  constructor(
    @Optional() @Inject('JOBS_SERVICE') jobsServiceRef?: JobsService,
  ) {
    this.jobsService = jobsServiceRef ?? null;
    this.ccaasUrl =
      process.env.CCAAS_CORE_URL || 'http://localhost:3001';
    this.logger.log(`CCAAS Core configured (${this.ccaasUrl.replace(/\/\/.*@/, '//***@')})`);
  }

  /** Allow late-binding of JobsService to avoid circular dependency */
  setJobsService(service: JobsService): void {
    this.jobsService = service;
  }

  /**
   * Proxy an SSE stream from CCAAS Core to the client.
   *
   * 1. Build a sessionId if the caller didn't provide one
   * 2. POST to CCAAS Core /api/v1/sessions/:id/messages
   * 3. Pipe the SSE response body straight to the client
   * 4. Abort the upstream fetch when the client disconnects
   */
  async streamToResponse(
    templateName: string,
    dto: {
      message: string;
      sessionId?: string;
      context?: Record<string, unknown>;
    },
    req: Request,
    res: Response,
  ): Promise<void> {
    const prefix = templateName === 'kp-refinement' ? 'kpm' : 'qae';
    const sessionId = dto.sessionId || `${prefix}-${uuid()}`;

    // SSE response headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('X-Session-Id', sessionId);
    res.flushHeaders();

    const abortController = new AbortController();
    const UPSTREAM_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes for LLM operations

    // Abort upstream when client disconnects
    req.on('close', () => {
      this.logger.debug(`Client disconnected, aborting upstream for session ${sessionId}`);
      abortController.abort();
    });

    // Timeout guard: abort if CCAAS Core doesn't respond within limit
    const timeout = setTimeout(() => {
      this.logger.warn(`Upstream timeout after ${UPSTREAM_TIMEOUT_MS}ms for session ${sessionId}`);
      abortController.abort();
    }, UPSTREAM_TIMEOUT_MS);

    const url = `${this.ccaasUrl}/api/v1/sessions/${sessionId}/messages`;
    const body = JSON.stringify({
      message: dto.message,
      tenantId: this.tenantId,
      templateName,
      ...(dto.context ? { context: dto.context } : {}),
    });

    this.logger.debug(`Proxying to ${url} (template=${templateName})`);

    try {
      const coreResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: abortController.signal,
      });

      if (!coreResponse.ok) {
        const errorText = await coreResponse.text().catch(() => 'Unknown error');
        this.logger.error(
          `CCAAS Core returned ${coreResponse.status}: ${errorText}`,
        );
        // Write an SSE error event so the client can handle it
        res.write(
          `data: ${JSON.stringify({
            seq: 0,
            sessionId,
            timestamp: new Date().toISOString(),
            event: {
              type: 'agent_status',
              status: 'error',
              error: `Upstream error: ${coreResponse.status}`,
            },
          })}\n\n`,
        );
        res.end();
        return;
      }

      if (!coreResponse.body) {
        this.logger.error('No response body from CCAAS Core');
        res.write(
          `data: ${JSON.stringify({
            seq: 0,
            sessionId,
            timestamp: new Date().toISOString(),
            event: { type: 'agent_status', status: 'error', error: 'No response body' },
          })}\n\n`,
        );
        res.end();
        return;
      }

      // Pipe SSE stream transparently, intercepting output_update events
      const reader = coreResponse.body.getReader();
      const decoder = new TextDecoder();

      // Find active job for this session (if JobsService is available)
      let activeJobId: string | null = null;
      if (this.jobsService) {
        try {
          const activeJob =
            await this.jobsService.findActiveJobForSession(sessionId);
          activeJobId = activeJob?.id ?? null;
        } catch {
          // Non-critical — proceed without job tracking
        }
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });

          // Intercept SSE lines to detect output_update events
          if (activeJobId && this.jobsService) {
            await this.interceptOutputUpdates(activeJobId, chunk);
          }

          // Always write original chunk to response (backward compatible)
          res.write(chunk);
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          this.logger.debug(`Stream aborted for session ${sessionId}`);
        } else {
          this.logger.error(`Stream error: ${(err as Error).message}`);
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        this.logger.debug(`Fetch aborted for session ${sessionId}`);
      } else {
        this.logger.error(`Proxy error: ${(err as Error).message}`);
        // Try to send error if response hasn't ended
        if (!res.writableEnded) {
          res.write(
            `data: ${JSON.stringify({
              seq: 0,
              sessionId,
              timestamp: new Date().toISOString(),
              event: {
                type: 'agent_status',
                status: 'error',
                error: (err as Error).message,
              },
            })}\n\n`,
          );
        }
      }
    } finally {
      clearTimeout(timeout);
      if (!res.writableEnded) {
        res.end();
      }
    }
  }

  /**
   * Parse SSE chunk text for output_update events and update job steps.
   * Non-throwing — errors are logged but never propagate to the stream.
   */
  private async interceptOutputUpdates(
    jobId: string,
    chunk: string,
  ): Promise<void> {
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      try {
        const payload = JSON.parse(line.slice(6));
        // Handle both flat and nested event shapes
        const event = payload.event ?? payload;
        if (event.type === 'output_update' && event.field) {
          const field = event.field as string;
          if ((SYNC_FIELDS as readonly string[]).includes(field)) {
            await this.jobsService!.completeStep(
              jobId,
              field as SyncField,
              event.value,
            );
          }
        }
      } catch {
        // Non-JSON data line — safe to ignore
      }
    }
  }
}
