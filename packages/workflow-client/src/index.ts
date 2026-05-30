/**
 * `@kedge-agentic/workflow-client` — framework-free HTTP client for the
 * platform's Workflow engine `POST /api/v1/workflow/sessions/:id/events`
 * endpoint.
 *
 * Solution-side outbox workers wrap this client with their own
 * persistence (a small TypeORM entity), retry policy, and durability
 * guarantees. The client itself is stateless: it builds the request,
 * sends it, parses the response, and returns a discriminated outcome.
 *
 * No NestJS, no TypeORM, no Zod. Just `globalThis.fetch` (Node 18+).
 * Solutions importing this package get a tight surface they can
 * compose into their own architecture.
 *
 * @see docs/gitbook/zh/platform/workflow-architecture.md (M6+)
 */

export interface WorkflowEventPayload {
  /** Caller-supplied. Used by the platform side for cross-process dedup. */
  readonly eventId: string;
  /** ManifestDef.name this event belongs to. */
  readonly manifestName: string;
  /** StreamDef.apiName on the manifest. */
  readonly streamApiName: string;
  /** The entity the event is about (e.g. student id). */
  readonly entityId: string;
  /** Shape determined by the StreamDef.payloadSchema. */
  readonly payload: Record<string, unknown>;
  /** Optional cross-process correlation id for tracing. */
  readonly correlationId?: string;
}

export type WorkflowPushOutcome =
  | {
      readonly status: 'accepted';
      /** The eventId echoed back from the platform. */
      readonly eventId: string;
    }
  | {
      readonly status: 'duplicate';
      /** Platform saw this eventId before. Caller can mark outbox row delivered. */
      readonly eventId: string;
    }
  | {
      readonly status: 'disabled';
      /** Platform's WORKFLOW_INGEST flag is off. Persisted but not dispatched. */
      readonly eventId: string;
    }
  | {
      readonly status: 'failed';
      readonly httpStatus?: number;
      readonly error: string;
      /** Caller is expected to retry with exponential backoff. */
      readonly retryable: boolean;
    };

/**
 * Indicator catalog entry pushed via `setIndicators`. Shape matches the
 * platform's `IndicatorDef`. The platform's PUT endpoint validates
 * each field (non-empty `id`/`type`/`label`).
 */
export interface WorkflowIndicatorDef {
  readonly id: string;
  readonly type: string;
  readonly label: string;
  readonly description: string;
}

export type WorkflowSetIndicatorsOutcome =
  | { readonly status: 'ok' }
  | {
      readonly status: 'failed';
      readonly httpStatus?: number;
      readonly error: string;
      readonly retryable: boolean;
    };

/**
 * The legacy `{logs, alerts, indicatorStats}` dashboard shape served by
 * the platform's `ObservationDashboardController`. Typed as `unknown`
 * here because the package stays framework-free + framework-agnostic;
 * the live-lesson outbox wrapper narrows to the concrete shape on
 * receipt. M5 second pass deletes this endpoint; until then, the live-
 * lesson backend HTTP-fetches via this method to source the dashboard
 * from the platform's observation table.
 */
export type WorkflowDashboardOutcome =
  | { readonly status: 'ok'; readonly payload: unknown }
  | {
      readonly status: 'failed';
      readonly httpStatus?: number;
      readonly error: string;
      readonly retryable: boolean;
    };

export interface WorkflowClientOptions {
  /** Platform base URL — e.g. `http://localhost:3001`. No trailing slash. */
  readonly baseUrl: string;
  /** API key the platform tenant auth check accepts. */
  readonly apiKey: string;
  /** Request timeout in ms. Default 5000. */
  readonly timeoutMs?: number;
  /** Override the platform-side `On-Behalf-Of` tenant header. */
  readonly onBehalfOfSolutionId?: string;
  /** Inject a custom fetch for testing. Defaults to globalThis.fetch. */
  readonly fetchImpl?: typeof fetch;
}

export class WorkflowClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly onBehalfOf?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: WorkflowClientOptions) {
    if (!opts.baseUrl || !opts.apiKey) {
      throw new Error('WorkflowClient requires baseUrl + apiKey');
    }
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.apiKey = opts.apiKey;
    this.timeoutMs = opts.timeoutMs ?? 5000;
    this.onBehalfOf = opts.onBehalfOfSolutionId;
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch;
    if (!this.fetchImpl) {
      throw new Error(
        'WorkflowClient: globalThis.fetch is unavailable; pass fetchImpl explicitly (Node <18)',
      );
    }
  }

  /**
   * Push an event for the given session.
   *
   * Never throws — failures land in the `status: 'failed'` arm of the
   * returned outcome. Outbox callers should treat:
   *   - `accepted` / `duplicate` / `disabled` → mark row delivered
   *   - `failed` with `retryable: true` → backoff + retry
   *   - `failed` with `retryable: false` → mark row poisoned (4xx, schema rejection)
   */
  async pushEvent(
    sessionId: string,
    event: WorkflowEventPayload,
  ): Promise<WorkflowPushOutcome> {
    if (!sessionId || typeof sessionId !== 'string') {
      return {
        status: 'failed',
        error: 'sessionId is required',
        retryable: false,
      };
    }
    const url = `${this.baseUrl}/api/v1/workflow/sessions/${encodeURIComponent(sessionId)}/events`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };
    if (this.onBehalfOf) {
      headers['X-Ccaas-On-Behalf-Of'] = this.onBehalfOf;
    }
    const body = JSON.stringify({
      eventId: event.eventId,
      manifestName: event.manifestName,
      streamApiName: event.streamApiName,
      entityId: event.entityId,
      payload: event.payload,
      correlationId: event.correlationId,
    });

    const controller =
      typeof AbortController !== 'undefined' ? new AbortController() : undefined;
    const timer = controller
      ? setTimeout(() => controller.abort(), this.timeoutMs)
      : undefined;

    try {
      const res = await this.fetchImpl(url, {
        method: 'POST',
        headers,
        body,
        signal: controller?.signal,
      });

      // Parse response body (controller may return 202, 200, 4xx, 5xx)
      let parsed: unknown;
      try {
        parsed = await res.json();
      } catch {
        parsed = null;
      }

      if (res.status === 202) {
        return mapResponse(parsed, event.eventId, 'accepted');
      }
      if (res.status === 200) {
        return mapResponse(parsed, event.eventId, 'duplicate');
      }
      // Pass-1 review S-6: distinguish retryable 4xx (408 timeout / 429
      // rate limit / 425 too-early) from terminal ones, and treat a few
      // 5xx that signal "upgrade required" as terminal so the outbox
      // doesn't burn its budget retrying impossible requests.
      const retryable = isRetryableStatus(res.status);
      return {
        status: 'failed',
        httpStatus: res.status,
        error: extractError(parsed, `HTTP ${res.status}`),
        retryable,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isAbort = msg.toLowerCase().includes('abort');
      return {
        status: 'failed',
        error: isAbort ? `request timed out after ${this.timeoutMs}ms` : msg,
        retryable: true,
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /**
   * Replace the platform-side indicator catalog for the given session.
   * Idempotent (PUT semantics). The platform M4 LLM handlers
   * (ChatTurn / StatusChange) read indicators from this registry; this
   * method is the cross-process wire for live-lesson to push them in.
   *
   * Never throws — failures land in the `status: 'failed'` arm.
   * Retryable bucket matches `pushEvent`.
   */
  async setIndicators(
    sessionId: string,
    indicators: readonly WorkflowIndicatorDef[],
  ): Promise<WorkflowSetIndicatorsOutcome> {
    if (!sessionId || typeof sessionId !== 'string') {
      return {
        status: 'failed',
        error: 'sessionId is required',
        retryable: false,
      };
    }
    const url = `${this.baseUrl}/api/v1/workflow/sessions/${encodeURIComponent(sessionId)}/indicators`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };
    if (this.onBehalfOf) {
      headers['X-Ccaas-On-Behalf-Of'] = this.onBehalfOf;
    }
    const body = JSON.stringify({ indicators });

    const controller =
      typeof AbortController !== 'undefined' ? new AbortController() : undefined;
    const timer = controller
      ? setTimeout(() => controller.abort(), this.timeoutMs)
      : undefined;

    try {
      const res = await this.fetchImpl(url, {
        method: 'PUT',
        headers,
        body,
        signal: controller?.signal,
      });
      if (res.status === 204 || res.status === 200) {
        return { status: 'ok' };
      }
      let parsed: unknown = null;
      try {
        parsed = await res.json();
      } catch {
        // body may be empty (204 case is already handled); ignore
      }
      return {
        status: 'failed',
        httpStatus: res.status,
        error: extractError(parsed, `HTTP ${res.status}`),
        retryable: isRetryableStatus(res.status),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isAbort = msg.toLowerCase().includes('abort');
      return {
        status: 'failed',
        error: isAbort ? `request timed out after ${this.timeoutMs}ms` : msg,
        retryable: true,
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /**
   * GET the legacy `{logs, alerts, indicatorStats}` dashboard for the
   * session from the platform's `/observation-dashboard` endpoint.
   * Cross-process source of truth for the M5.3b live-lesson cutover.
   * Returns `unknown` payload; callers narrow with their own schema.
   */
  async getObservationDashboard(
    sessionId: string,
  ): Promise<WorkflowDashboardOutcome> {
    if (!sessionId || typeof sessionId !== 'string') {
      return {
        status: 'failed',
        error: 'sessionId is required',
        retryable: false,
      };
    }
    const url = `${this.baseUrl}/api/v1/workflow/sessions/${encodeURIComponent(sessionId)}/observation-dashboard`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
    };
    if (this.onBehalfOf) {
      headers['X-Ccaas-On-Behalf-Of'] = this.onBehalfOf;
    }

    const controller =
      typeof AbortController !== 'undefined' ? new AbortController() : undefined;
    const timer = controller
      ? setTimeout(() => controller.abort(), this.timeoutMs)
      : undefined;

    try {
      const res = await this.fetchImpl(url, {
        method: 'GET',
        headers,
        signal: controller?.signal,
      });
      let parsed: unknown = null;
      try {
        parsed = await res.json();
      } catch {
        // body parse failure on non-2xx is non-fatal; we report error below
      }
      if (res.status === 200) {
        return { status: 'ok', payload: parsed };
      }
      return {
        status: 'failed',
        httpStatus: res.status,
        error: extractError(parsed, `HTTP ${res.status}`),
        retryable: isRetryableStatus(res.status),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isAbort = msg.toLowerCase().includes('abort');
      return {
        status: 'failed',
        error: isAbort ? `request timed out after ${this.timeoutMs}ms` : msg,
        retryable: true,
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

/**
 * The platform endpoint returns shapes like:
 *   { accepted: true, eventId }
 *   { accepted: false, dropped: 'duplicate', eventId }
 *   { accepted: false, dropped: 'disabled', eventId }
 *
 * Map to our discriminated outcome by looking at the dropped reason.
 */
function mapResponse(
  parsed: unknown,
  fallbackEventId: string,
  defaultStatus: 'accepted' | 'duplicate',
): WorkflowPushOutcome {
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    const eventId = typeof obj.eventId === 'string' ? obj.eventId : fallbackEventId;
    if (obj.accepted === false && obj.dropped === 'duplicate') {
      return { status: 'duplicate', eventId };
    }
    if (obj.accepted === false && obj.dropped === 'disabled') {
      return { status: 'disabled', eventId };
    }
    if (obj.accepted === true) {
      return { status: 'accepted', eventId };
    }
  }
  return { status: defaultStatus, eventId: fallbackEventId };
}

/**
 * Bucket the HTTP status into "outbox should retry later" vs "outbox
 * should poison and stop". Defaults: 4xx terminal except 408/425/429;
 * 5xx retryable except 501/505 (server doesn't support the request and
 * never will).
 */
function isRetryableStatus(status: number): boolean {
  if (status === 408 || status === 425 || status === 429) return true;
  if (status >= 400 && status < 500) return false;
  if (status === 501 || status === 505) return false;
  if (status >= 500) return true;
  // Anything outside known codes — treat as retryable; transient by default.
  return true;
}

function extractError(parsed: unknown, fallback: string): string {
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.error === 'string') return obj.error;
  }
  return fallback;
}
