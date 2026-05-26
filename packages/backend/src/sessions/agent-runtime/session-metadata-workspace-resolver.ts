/**
 * SessionMetadataWorkspaceResolver — the default tenant-access resolver
 * for ccaas (Phase 2b-2). Renamed from
 * `SessionMetadataProjectTenantResolver` in β-3.
 *
 * Implements the agent-runtime package's `WorkspaceAccessResolver`
 * interface (the package's interface name still uses the legacy
 * "Project" vocabulary; renaming the npm package's exported types is
 * out of β-3's scope). The semantic question this class answers is
 * the same as the interface: "is `callerTenantId` allowed to read /
 * write the workspace identified by `identity`?"
 *
 * **Why this design (deviation from the original 2b-2 plan):**
 *
 * The 2b-2 plan called for solutions to ship their own resolver
 * querying their own DB (e.g. `LiveLessonProjectTenantResolver` →
 * `CourseProject.solutionId`). That works but forces every solution to
 * add a tenant column + migration AND requires a cross-process
 * callback (ccaas → solution REST) at every SSE/invalidate request —
 * extra latency, extra failure modes, extra schema rollout.
 *
 * The attach-workspace-source flow (`POST /sessions/:id/attach-workspace-source`,
 * plus its deprecated `bind-project` alias) already writes
 * `session_metadata(sessionId, solutionId, key='sourceIdentity', value=<sourceIdentity>)`
 * with the caller's solutionId on it. That's by construction the source
 * of truth for "who owns this workspace from ccaas's point of view".
 * This resolver reuses it directly via a single indexed SQLite lookup
 * — no callbacks, no schema change.
 *
 * **Trade-off:** workspaces that have never been attached to a session
 * (e.g. the creator GUI subscribes to SSE before any agent session
 * opens) verify to `false` → 403. Solutions must attach first (the
 * canonical pattern; `solutions/business/live-lesson-creator/scripts/poc-smoke.sh`
 * already does this) or register a custom resolver via
 * `WORKSPACE_ACCESS_RESOLVER`.
 *
 * The row this resolver reads is keyed `'sourceIdentity'`, written by
 * `SessionService.attachWorkspaceSource`. `attachWorkspaceSource` also
 * writes optional `'workspaceSourceUrl'` / `'workspaceSourceSchemaHash'`
 * rows when those fields are supplied; this resolver only needs the
 * identity for access verification.
 *
 * **Multi-solution correctness**: the query is keyed on BOTH `identity`
 * AND `callerTenantId` so a tenant can never piggyback on another
 * tenant's attachment (which the older "resolve to first binding"
 * shape would have allowed in the unlikely case of an identity
 * collision).
 *
 * `session_metadata` rows survive session cleanup (see
 * `SessionMetadataService` docs), so attachments remain queryable
 * across the workspace's lifetime — not just while a live session is
 * open.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { WorkspaceAccessResolver } from '@kedge-agentic/agent-runtime';

import { SessionMetadata } from '../entities/session-metadata.entity';

@Injectable()
export class SessionMetadataWorkspaceResolver implements WorkspaceAccessResolver {
  private readonly logger = new Logger(
    SessionMetadataWorkspaceResolver.name,
  );

  constructor(
    @InjectRepository(SessionMetadata)
    private readonly repo: Repository<SessionMetadata>,
  ) {}

  /**
   * Implements the package interface verbatim — `verifyWorkspaceAccess`
   * stays as the method name because that's what the
   * `WorkspaceAccessResolver` interface defines. The method is
   * semantically `verifyWorkspaceAccess`; the rename happens whenever
   * we get around to bumping the agent-runtime package.
   */
  async verifyWorkspaceAccess(
    identity: string,
    callerTenantId: string,
  ): Promise<boolean> {
    if (!identity || !callerTenantId) return false;
    // The attach flow writes value=<sourceIdentity> as a JSON-stringified
    // string (SessionMetadataService.put). Stored form is `"<value>"`
    // (with quotes). Match both forms because older rows from prototype
    // code may have raw strings.
    const quoted = JSON.stringify(identity);
    const count = await this.repo
      .createQueryBuilder('m')
      .where('m.key = :key', { key: 'sourceIdentity' })
      .andWhere('(m.value = :raw OR m.value = :quoted)', {
        raw: identity,
        quoted,
      })
      .andWhere('m.solutionId = :solutionId', { solutionId: callerTenantId })
      .getCount();
    if (count === 0) {
      this.logger.debug(
        `verifyWorkspaceAccess: no attachment for workspace=${identity} tenant=${callerTenantId}`,
      );
      return false;
    }
    return true;
  }
}
