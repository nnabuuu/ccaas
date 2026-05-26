/**
 * SessionMetadataProjectTenantResolver — the default `ProjectTenantResolver`
 * impl for ccaas (Phase 2b-2).
 *
 * **Why this design (deviation from the original plan):**
 *
 * The 2b-2 plan called for solutions to ship their own resolver (e.g.
 * `LiveLessonProjectTenantResolver` querying `CourseProject.tenantId`).
 * That works but forces every solution to add a tenant column +
 * migration AND requires a cross-process callback (ccaas → solution
 * REST) at every SSE/invalidate request — extra latency, extra
 * failure modes, extra schema rollout.
 *
 * The bind-project flow (`POST /sessions/:id/bind-project`) already
 * writes `session_metadata(sessionId, tenantId, key='projectId',
 * value=<projectId>)` with the caller's tenantId on it. That is, by
 * construction, the source of truth for "who owns this project from
 * ccaas's point of view". This resolver reuses it directly via a single
 * indexed SQLite lookup — no callbacks, no schema change, works for
 * every solution that uses the standard bind-project endpoint.
 *
 * **Trade-off:** projects that have never been bound to a session (e.g.
 * the creator GUI subscribes to SSE before any agent session opens)
 * verify to `false` → 403. Solutions must bind first (the canonical
 * pattern; `solutions/business/live-lesson-creator/scripts/poc-smoke.sh`
 * already does this) or register a custom resolver via
 * `PROJECT_TENANT_RESOLVER` token.
 *
 * **Multi-tenant correctness**: the query is keyed on BOTH `projectId`
 * AND `callerTenantId` so a tenant can never piggyback on another
 * tenant's binding (which the older "resolve to first binding" shape
 * would have allowed in the unlikely case of a projectId collision).
 *
 * `session_metadata` rows survive session cleanup (see
 * `SessionMetadataService` docs), so bindings remain queryable across
 * the project's lifetime — not just while a live session is open.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { ProjectTenantResolver } from '@kedge-agentic/agent-runtime';

import { SessionMetadata } from '../entities/session-metadata.entity';

@Injectable()
export class SessionMetadataProjectTenantResolver
  implements ProjectTenantResolver
{
  private readonly logger = new Logger(
    SessionMetadataProjectTenantResolver.name,
  );

  constructor(
    @InjectRepository(SessionMetadata)
    private readonly repo: Repository<SessionMetadata>,
  ) {}

  async verifyProjectAccess(
    projectId: string,
    callerTenantId: string,
  ): Promise<boolean> {
    if (!projectId || !callerTenantId) return false;
    // The bind-project flow writes value=<projectId> as a JSON-stringified
    // string (SessionMetadataService.put). Stored form is `"<projectId>"`
    // (with quotes). Match both forms because older rows from prototype
    // code may have raw strings.
    const quoted = JSON.stringify(projectId);
    const count = await this.repo
      .createQueryBuilder('m')
      .where('m.key = :key', { key: 'projectId' })
      .andWhere('(m.value = :raw OR m.value = :quoted)', {
        raw: projectId,
        quoted,
      })
      .andWhere('m.tenantId = :tenantId', { tenantId: callerTenantId })
      .getCount();
    if (count === 0) {
      this.logger.debug(
        `verifyProjectAccess: no binding for project=${projectId} tenant=${callerTenantId}`,
      );
      return false;
    }
    return true;
  }
}
