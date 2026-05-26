/**
 * GET /api/v1/auth/me — caller identity introspection.
 *
 * Used by the creator UI (and any other browser frontend) at boot to
 * resolve the solutionId that goes with the API key in localStorage.
 * Without this, the UI can't construct a valid attach-workspace-source
 * body (which requires the session's owning solutionId).
 *
 * Returns the same identity facts the ApiKeyGuard already attached to
 * the request — no fresh DB hit beyond what the guard performed.
 *
 * Anonymous handling:
 *   - With a key → 200 + identity payload
 *   - Without a key:
 *     - AUTH_ALLOW_ANONYMOUS=true  → request gets `isAnonymous=true`
 *       context with the default tenant. We surface that honestly:
 *       `{ solutionId: <default>, isAnonymous: true }`.
 *     - AUTH_ALLOW_ANONYMOUS=false → ApiKeyGuard rejects with 401
 *       (UI uses 401 as the "show paste-key banner" signal).
 */

import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Auth, Ctx } from './decorators';
import type { RequestContext, ApiKeyScope } from './types';

export interface MeResponse {
  solutionId: string;
  tenantSlug: string;
  apiKeyId?: string;
  scopes: ApiKeyScope[];
  isAnonymous: boolean;
}

@ApiTags('auth')
@Controller('api/v1/auth')
export class MeController {
  @Auth()
  @Get('me')
  @ApiOperation({
    summary: 'Resolve caller identity (tenant + scopes)',
    description:
      'Returns the solutionId, tenant slug, scopes attached to the API ' +
      'key. The UI uses solutionId for attach-workspace-source body ' +
      'composition. Returns 401 when no key is present and anonymous ' +
      'access is disabled — the frontend treats 401 as a "paste your ' +
      'API key" prompt.',
  })
  @ApiResponse({
    status: 200,
    description: 'Caller identity',
    schema: {
      properties: {
        solutionId: { type: 'string', format: 'uuid' },
        tenantSlug: { type: 'string' },
        apiKeyId: { type: 'string', format: 'uuid', nullable: true },
        scopes: { type: 'array', items: { type: 'string' } },
        isAnonymous: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'No API key + anonymous access disabled',
  })
  me(@Ctx() ctx: RequestContext | undefined): MeResponse {
    // Defensive — ApiKeyGuard always populates ctx on success, but
    // an empty ctx would crash the response. Throw a clear error
    // rather than silently returning undefined fields.
    if (!ctx) {
      throw new Error('auth context missing; ApiKeyGuard misconfigured');
    }
    return {
      solutionId: ctx.solutionId,
      tenantSlug: ctx.tenant.slug,
      apiKeyId: ctx.apiKeyId,
      scopes: ctx.apiKeyScopes ?? [],
      isAnonymous: ctx.isAnonymous === true,
    };
  }
}
