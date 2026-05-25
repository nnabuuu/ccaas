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
 * Auth: callers handle the `Auth('admin')` + `TenantGuard` decorators
 * at the controller layer. We enforce session existence here so the
 * provider methods only see real session ids.
 */

import {
  BadRequestException,
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

  async diff(sessionId: string, tenantId: string): Promise<FsDiffEntry[]> {
    const session = this.requireOwnedSession(sessionId, tenantId);
    if (!session.workspaceHandle?.diff) {
      throw this.unsupported('diff');
    }
    return session.workspaceHandle.diff();
  }

  async timeline(
    sessionId: string,
    tenantId: string,
    opts?: TimelineOpts,
  ): Promise<FsTimelineEntry[]> {
    const session = this.requireOwnedSession(sessionId, tenantId);
    if (!session.workspaceHandle?.timeline) {
      throw this.unsupported('timeline');
    }
    return session.workspaceHandle.timeline(opts);
  }

  async snapshot(
    sessionId: string,
    tenantId: string,
    label: string,
  ): Promise<SnapshotResult> {
    if (!label || !/^[\w.-]{1,64}$/.test(label)) {
      throw new BadRequestException(
        'label must match ^[\\w.-]{1,64}$ (alphanumeric, underscore, dot, dash; ≤64 chars)',
      );
    }
    const session = this.requireOwnedSession(sessionId, tenantId);
    if (!session.workspaceHandle?.snapshot) {
      throw this.unsupported('snapshot');
    }
    await session.workspaceHandle.snapshot(label);
    return { label, takenAt: new Date().toISOString() };
  }

  async rollback(
    sessionId: string,
    tenantId: string,
    label: string,
  ): Promise<void> {
    if (!label || !/^[\w.-]{1,64}$/.test(label)) {
      throw new BadRequestException(
        'label must match ^[\\w.-]{1,64}$ (alphanumeric, underscore, dot, dash; ≤64 chars)',
      );
    }
    const session = this.requireOwnedSession(sessionId, tenantId);
    if (!session.workspaceHandle?.rollback) {
      throw this.unsupported('rollback');
    }
    await session.workspaceHandle.rollback(label);
  }

  // ─── internals ─────────────────────────────────────────────────────────

  private requireOwnedSession(sessionId: string, tenantId: string) {
    const session = this.sessions.getSession(sessionId);
    if (!session) {
      throw new NotFoundException(
        `session not found or not active: ${sessionId} (sessions purged from memory after close)`,
      );
    }
    // Tenant ownership: admins can cross-tenant via header (TenantGuard
    // already swaps tenantId on the request for admin keys), so a
    // direct equality check is sufficient here.
    if (session.tenantId && session.tenantId !== tenantId) {
      throw new ForbiddenException(
        `session ${sessionId} belongs to a different tenant`,
      );
    }
    return session;
  }

  private unsupported(op: string): BadRequestException {
    return new BadRequestException(
      `fs.${op} requires WORKSPACE_PROVIDER=agentfs ` +
      `(current provider does not expose '${op}' on its workspace handle)`,
    );
  }
}
