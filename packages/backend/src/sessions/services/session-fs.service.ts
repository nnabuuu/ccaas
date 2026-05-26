/**
 * SessionFsService — thin facade over the active WorkspaceProvider for
 * the FS observability + checkpoint endpoints. All of the agentfs
 * specifics (snapshot-copy of the live delta, CLI invocation, diff
 * parsing) live inside `AgentfsProvider`; this service is just lookup
 * + auth-shape + 400-on-unsupported.
 *
 * Endpoints surfaced (see `SessionFsController`):
 *   GET   /api/v1/sessions/:id/fs/diff
 *   GET   /api/v1/sessions/:id/fs/timeline
 *   POST  /api/v1/sessions/:id/fs/snapshot
 *   POST  /api/v1/sessions/:id/fs/rollback
 *
 * Auth: callers handle the `Auth('admin')` + `SolutionAuthGuard` decorators
 * at the controller layer. We enforce session existence here so the
 * provider methods only see real session ids.
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { SessionService } from '../session.service';
import { WORKSPACE_PROVIDER } from '../workspace/types';
import type {
  WorkspaceProvider,
  FsDiffEntry,
  FsTimelineEntry,
  TimelineOpts,
} from '../workspace/types';

export interface SnapshotResult {
  label: string;
  takenAt: string;
}

@Injectable()
export class SessionFsService {
  constructor(
    @Inject(WORKSPACE_PROVIDER) private readonly provider: WorkspaceProvider,
    private readonly sessions: SessionService,
  ) {}

  async diff(sessionId: string, solutionId: string): Promise<FsDiffEntry[]> {
    const session = this.requireOwnedSession(sessionId, solutionId);
    if (!session.workspaceHandle?.diff) {
      throw this.unsupported('diff');
    }
    return session.workspaceHandle.diff();
  }

  async timeline(
    sessionId: string,
    solutionId: string,
    opts?: TimelineOpts,
  ): Promise<FsTimelineEntry[]> {
    const session = this.requireOwnedSession(sessionId, solutionId);
    if (!session.workspaceHandle?.timeline) {
      throw this.unsupported('timeline');
    }
    return session.workspaceHandle.timeline(opts);
  }

  async snapshot(
    sessionId: string,
    solutionId: string,
    label: string,
  ): Promise<SnapshotResult> {
    this.requireValidLabel(label);
    const session = this.requireOwnedSession(sessionId, solutionId);
    this.requireSessionIdle(session, 'snapshot');
    if (!session.workspaceHandle?.snapshot) {
      throw this.unsupported('snapshot');
    }
    await session.workspaceHandle.snapshot(label);
    return { label, takenAt: new Date().toISOString() };
  }

  async rollback(
    sessionId: string,
    solutionId: string,
    label: string,
  ): Promise<void> {
    this.requireValidLabel(label);
    const session = this.requireOwnedSession(sessionId, solutionId);
    this.requireSessionIdle(session, 'rollback');
    if (!session.workspaceHandle?.rollback) {
      throw this.unsupported('rollback');
    }
    await session.workspaceHandle.rollback(label);
  }

  // ─── internals ─────────────────────────────────────────────────────────

  private requireValidLabel(label: string): void {
    if (!label || !/^[\w.-]{1,64}$/.test(label)) {
      throw new BadRequestException(
        'label must match ^[\\w.-]{1,64}$ (alphanumeric, underscore, dot, dash; ≤64 chars)',
      );
    }
  }

  /**
   * Solution ownership check.
   *
   * **Auth model for stage-1**: these endpoints are gated `Auth('admin')`
   * at the controller layer, which means SolutionAuthGuard reads `x-tenant-id`
   * from the request header (admin keys can cross-tenant freely). The
   * equality check below is therefore *defensive*: an admin caller who
   * sends the wrong tenant header gets 403 instead of accidentally
   * reading another tenant's session. It is NOT load-bearing as a
   * security boundary in stage-1 (admin scope is intentionally
   * unrestricted). Stage-2 may add a `sessions:fs` granular scope for
   * tenant-bound keys, at which point this check becomes load-bearing.
   */
  private requireOwnedSession(sessionId: string, solutionId: string) {
    const session = this.sessions.getSession(sessionId);
    if (!session) {
      throw new NotFoundException(
        `session not found or not active: ${sessionId} (sessions purged from memory after close)`,
      );
    }
    if (session.solutionId && session.solutionId !== solutionId) {
      throw new ForbiddenException(
        `session ${sessionId} belongs to a different tenant`,
      );
    }
    return session;
  }

  /**
   * Snapshot + rollback cycle the underlying mount daemon (stop + cp +
   * restart). Doing this mid-turn yanks open file handles out from
   * under the agent process — claude sees EIO and the turn breaks.
   * Refuse with 409 unless the session is idle.
   */
  private requireSessionIdle(
    session: { status?: string; sessionId: string },
    op: string,
  ): void {
    const busy = session.status && session.status !== 'idle' && session.status !== 'error';
    if (busy) {
      throw new ConflictException(
        `cannot ${op} while session ${session.sessionId} is ${session.status} ` +
        `(snapshot/rollback cycle the agentfs mount; mid-turn agent file handles would EIO). ` +
        `Cancel the turn first, or wait for status=idle.`,
      );
    }
  }

  private unsupported(op: string): BadRequestException {
    return new BadRequestException(
      `fs.${op} requires WORKSPACE_PROVIDER=agentfs ` +
      `(current provider does not expose '${op}' on its workspace handle)`,
    );
  }
}
