/**
 * ToolCallerProxy — the single chokepoint every solution-scoped tool
 * call flows through.
 *
 * Pipeline (design doc §5.2):
 *   1. Reserved-field strip on agent-supplied args (sanitization).
 *   2. Zod-schema validation of sanitized args.
 *   3. Permission check — STUB this round (always allow).
 *   4. Context injection (ExecutionContext provided by caller; never
 *      derived from `args`).
 *   5. Handler dispatch.
 *   6. Audit log (success or failure, always).
 *
 * Anything the agent writes lives in `request.args`. Anything about
 * identity lives in `context`. Conflating these two is the whole
 * class of bug the proxy exists to prevent.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ZodError } from 'zod';
import {
  RESERVED_ARG_FIELDS,
  sanitizeArgs,
  type ReservedArgField,
} from './reserved-fields';
import { SolutionToolkitRegistry } from './solution-toolkit-registry';
import type {
  ExecutionContext,
  ToolCallAuditEntry,
  ToolCallRequest,
  ToolInvocation,
  ToolResult,
} from './types';

/** Hook the proxy calls for every invocation. Pluggable for testing. */
export interface ToolCallAuditSink {
  record(entry: ToolCallAuditEntry): void | Promise<void>;
}

@Injectable()
export class ToolCallerProxyService {
  private readonly logger = new Logger(ToolCallerProxyService.name);
  private auditSink: ToolCallAuditSink | null = null;
  /**
   * One-shot guard so the "audit sink unwired" warning fires exactly
   * once per process. The design doc (§5.2 step 6) promises audit on
   * every call — when the production wiring is missing, we want loud
   * evidence in logs the first time a tool actually runs, but not
   * once per invocation.
   */
  private auditSinkAbsenceWarned = false;

  constructor(private readonly registry: SolutionToolkitRegistry) {}

  /**
   * Wire an audit sink. The proxy writes one entry per invocation
   * (regardless of outcome). Today there's one consumer (tool_events
   * table writer in the sessions layer); the indirection keeps the
   * proxy decoupled from that table.
   */
  setAuditSink(sink: ToolCallAuditSink | null): void {
    this.auditSink = sink;
    if (sink) {
      // Reset the absence-warning latch so a later test or hot-reload
      // that clears + re-registers a sink can re-warn if cleared again.
      this.auditSinkAbsenceWarned = false;
    }
  }

  /**
   * Invoke a tool against a known ExecutionContext.
   *
   * Returns a ToolResult — success or a structured failure (which the
   * agent can relay in natural language). NEVER throws for the
   * documented failure modes; only handler bugs reach the caller via
   * exception, and we log + convert those to `handler_error` results.
   */
  async invoke(
    request: ToolCallRequest,
    context: ExecutionContext,
  ): Promise<ToolResult> {
    const startedAt = Date.now();

    // Step 1: strip reserved fields from agent-supplied args.
    const { cleaned, stripped } = sanitizeArgs(request.args);
    if (stripped.length > 0) {
      this.logger.warn(
        `Tool "${request.tool}" call by session ${context.sessionId} ` +
        `(actingUserId=${context.actingUserId ?? 'none'}) tried to set ` +
        `reserved fields: ${stripped.join(', ')} — silently stripped`,
      );
    }

    const resolved = this.registry.resolveTool(
      context.solutionId,
      request.tool,
    );
    if (!resolved) {
      const result: ToolResult = {
        ok: false,
        code: 'tool_not_found',
        reason: `Tool "${request.tool}" is not registered for this solution.`,
      };
      await this.audit(
        request,
        context,
        stripped,
        cleaned,
        result,
        startedAt,
      );
      return result;
    }

    // Step 2: schema validation of sanitized args.
    let parsedArgs: Record<string, unknown>;
    try {
      parsedArgs = resolved.definition.argsSchema.parse(cleaned);
    } catch (err) {
      const reason =
        err instanceof ZodError
          ? this.formatZodError(err)
          : `Invalid arguments for "${request.tool}".`;
      const result: ToolResult = {
        ok: false,
        code: 'validation_failed',
        reason,
      };
      await this.audit(
        request,
        context,
        stripped,
        cleaned,
        result,
        startedAt,
      );
      return result;
    }

    // Step 3: permission check — STUB. Always allow.
    // When the permission engine lands, this checks
    // resolved.definition.requiredPermissions against context.permissions.

    // Step 4: assemble the ToolInvocation. ExecutionContext is the
    // caller's claim — we do NOT derive any field from `args` here.
    const invocation: ToolInvocation = {
      tool: resolved.qualifiedName,
      args: parsedArgs,
      context,
    };

    // Step 5: handler dispatch. We catch unexpected throws and turn
    // them into a documented failure shape — the agent should never
    // see an HTTP-style crash.
    let result: ToolResult;
    try {
      result = await resolved.definition.handler(invocation);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Tool "${request.tool}" handler threw for session ${context.sessionId}: ${msg}`,
      );
      result = {
        ok: false,
        code: 'handler_error',
        reason: `Tool "${request.tool}" execution failed: ${msg}`,
      };
    }

    // Step 6: audit (always).
    await this.audit(
      request,
      context,
      stripped,
      parsedArgs,
      result,
      startedAt,
    );
    return result;
  }

  /**
   * Reserved field names, exposed as a stable list for consumers
   * (e.g. type tests, documentation, the spoofing spec).
   */
  static get RESERVED_FIELDS(): readonly string[] {
    return RESERVED_ARG_FIELDS;
  }

  private async audit(
    request: ToolCallRequest,
    context: ExecutionContext,
    stripped: readonly ReservedArgField[],
    argsRedacted: Record<string, unknown>,
    result: ToolResult,
    startedAt: number,
  ): Promise<void> {
    const outcome: ToolCallAuditEntry['outcome'] = result.ok ? 'ok' : result.code;
    const entry: ToolCallAuditEntry = {
      sessionId: context.sessionId,
      solutionId: context.solutionId,
      actingUserId: context.actingUserId,
      tool: request.tool,
      strippedFields: stripped,
      outcome,
      argsRedacted,
      startedAt,
      durationMs: Date.now() - startedAt,
    };

    if (!this.auditSink) {
      // No production sink wired — fall back to logger so the audit
      // trail is at least observable in stdout. Warn once per process
      // so ops notice that DB-backed audit isn't on. The design doc
      // §5.2 step 6 says audit is unconditional; we honor that even
      // in the not-yet-fully-wired state.
      if (!this.auditSinkAbsenceWarned) {
        this.logger.warn(
          'ToolCallerProxy: no audit sink registered — falling back to ' +
          'logger-only audit. Wire a sink before relying on tool_events.',
        );
        this.auditSinkAbsenceWarned = true;
      }
      this.logger.log(
        `[audit-fallback] tool=${entry.tool} solutionId=${entry.solutionId} ` +
        `sessionId=${entry.sessionId} actingUserId=${entry.actingUserId ?? 'none'} ` +
        `outcome=${entry.outcome} stripped=${
          entry.strippedFields.length ? entry.strippedFields.join(',') : 'none'
        } durationMs=${entry.durationMs}`,
      );
      return;
    }

    try {
      await this.auditSink.record(entry);
    } catch (err) {
      // Audit failure must never break the call path. Log + move on.
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Audit sink threw: ${msg}`);
    }
  }

  private formatZodError(err: ZodError): string {
    const issues = err.issues
      .map((i) => {
        const path = i.path.length ? i.path.join('.') : '(root)';
        return `${path}: ${i.message}`;
      })
      .join('; ');
    return `Invalid arguments: ${issues}`;
  }
}
