/**
 * WorkspaceAccessGuard — query-param token auth + workspace↔tenant
 * check for `/workspaces/:identity/*` (and its `/projects/:identity/*`
 * compat alias). Renamed from `ProjectAccessGuard` in β-3.
 *
 * Why a Guard and not a pre-pipe in the SSE Observable: NestJS's `@Sse()`
 * handler commits the HTTP response (status 200, `Content-Type:
 * text/event-stream`) AT THE MOMENT THE HANDLER IS INVOKED — BEFORE the
 * returned Observable is subscribed. If we throw `UnauthorizedException`
 * later from inside the Observable (e.g. via `from(Promise).pipe(switchMap)`)
 * the error happens after the response is committed, so the client sees
 * `200 OK` followed by a silent connection close. No 401/403 ever reaches
 * the wire.
 *
 * Guards run in `canActivate` BEFORE the handler is invoked, so a thrown
 * `UnauthorizedException` / `ForbiddenException` cleanly maps to the
 * intended HTTP status. This is the only correct place for pre-stream
 * SSE auth.
 *
 * Reject paths:
 *   401: missing `?token=` query param
 *   401: token rejected by `ApiKeyService.validateKey` (invalid / expired / unknown)
 *   403: resolver returned `false`
 *        (workspace unknown to ccaas OR no resolver registered)
 *   403: token's tenant ≠ workspace's resolved tenant
 *
 * Note: the agent-runtime npm package's `ProjectTenantResolver`
 * interface still has the legacy name (renaming the package's exported
 * type is a bigger move than β-3's scope). Inside ccaas-core this
 * guard speaks "workspace" / "identity"; the resolver port it calls is
 * still `ProjectTenantResolver.verifyProjectAccess`. We treat that as
 * the same semantic check — only the vocabulary on the controller +
 * guard surface changed.
 */

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import type { ProjectTenantResolver } from '@kedge-agentic/agent-runtime';

import { ApiKeyService } from '../../auth/api-key.service';
import { PROJECT_TENANT_RESOLVER } from './tokens';

@Injectable()
export class WorkspaceAccessGuard implements CanActivate {
  constructor(
    private readonly apiKeys: ApiKeyService,
    @Inject(PROJECT_TENANT_RESOLVER)
    private readonly tenantResolver: ProjectTenantResolver,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    // Express coerces duplicate query params into arrays: `?token=a&token=b`
    // becomes `['a','b']`. The route-param case is single-value by definition,
    // but we type-check both for symmetry / defense-in-depth. The unknown-typed
    // accessors below force an explicit type narrow rather than trusting the
    // TypeScript surface.
    const identity = (req.params as Record<string, unknown>)?.identity;
    const token = (req.query as Record<string, unknown>)?.token;

    if (typeof identity !== 'string' || identity.length === 0) {
      // Defensive — the controller's `@Param('identity')` wouldn't bind
      // an empty string, but a guard should fail closed.
      throw new ForbiddenException('workspace identity missing from request');
    }
    if (typeof token !== 'string' || token.length === 0) {
      // `typeof` also rejects array values (`['a','b']` from duplicate
      // query params), which would otherwise slip into validateKey and
      // crash inside the hasher with a confusing error.
      throw new UnauthorizedException('Missing ?token= query param');
    }

    let callerTenantId: string;
    try {
      const { tenant } = await this.apiKeys.validateKey(token);
      callerTenantId = tenant.id;
    } catch {
      // ApiKeyService throws specific exceptions (expired / invalid /
      // disabled); normalize to a single 401 to avoid leaking which
      // failure mode triggered.
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Ask the resolver the verification question directly. A `false`
    // answer covers both "workspace unknown to ccaas" and "this caller
    // doesn't own it" — we don't disambiguate to the client because
    // doing so leaks identity-existence to unauthorized callers.
    const ok = await this.tenantResolver.verifyProjectAccess(
      identity,
      callerTenantId,
    );
    if (!ok) {
      throw new ForbiddenException(
        `Tenant does not own workspace ${identity}`,
      );
    }
    return true;
  }
}
