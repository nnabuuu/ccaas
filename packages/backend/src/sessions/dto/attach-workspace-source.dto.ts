/**
 * AttachWorkspaceSource DTO — request body for the new
 * `POST /api/v1/sessions/:sessionId/attach-workspace-source` route,
 * which replaces `bind-project` as ccaas-core's way of telling
 * agent-runtime where to load/save the session's editable artifacts.
 *
 * Why this DTO exists (β-1 of the α+β refactor — see
 * `~/.claude/plans/kind-exploring-mango.md`):
 *
 * The old `bind-project` route had `projectId` in its name + body.
 * "Project" is a solution-side concept (live-lesson has projects,
 * demo-sandbox has projects, they mean different things). ccaas-core
 * had no business knowing what a "project" was — it just needed an
 * opaque identifier + a URL to pull artifacts from. Now it asks for
 * exactly that:
 *
 *   - `sourceUrl`     — where to GET/PUT/DELETE artifacts (a REST URL
 *                       that the solution exposes; opaque to ccaas)
 *   - `sourceIdentity` — opaque ID the solution wants ccaas to use
 *                       when calling that URL (becomes the path
 *                       segment in {sourceUrl}/{sourceIdentity})
 *   - `sourceSchemaHash` — optional fingerprint so the solution can
 *                       reject stale syncs after a schema change
 *   - `solutionId`      — kept here transitionally because
 *                       SessionService.attachWorkspaceSource still
 *                       requires it. α phase will sweep this to
 *                       solutionId; future phases may pull it from
 *                       auth context instead. For now: solutions
 *                       pass it the same way they did for bind-project.
 *
 * The old `bind-project` route stays as an alias for one release.
 * New route calls the canonical `SessionService.attachWorkspaceSource`;
 * the old route calls the deprecated `bindToProject` alias which
 * delegates to the same canonical method. β-1 added the wire rename
 * + DTO; β-2 renamed the service internals + widened the in-memory
 * binding map to hold the full WorkspaceSource descriptor.
 */

import { IsString, IsNotEmpty, IsOptional, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AttachWorkspaceSourceDto {
  @ApiProperty({
    description:
      'REST base URL the solution exposes for artifact GET/PUT/DELETE. ' +
      'ccaas appends `/{sourceIdentity}/artifacts...` to it. Must be a ' +
      'reachable HTTP(S) URL from the ccaas process. `require_tld:false` ' +
      'so `http://localhost:3007` (the dev default) validates.',
    example: 'http://localhost:3007/api/projects',
  })
  // Validated as URL now even though β-3 is the phase that actually
  // *uses* it for syncing — fail-fast at the boundary means a misconfig
  // surfaces as a 400 here instead of a confusing fetch failure later.
  @IsUrl({ require_tld: false, require_protocol: true })
  @IsNotEmpty()
  sourceUrl: string;

  @ApiProperty({
    description:
      'Opaque identifier (solution-defined) for the workspace ccaas is ' +
      'attaching this session to. Becomes a path segment in the artifact ' +
      'URLs ccaas builds against `sourceUrl`. ccaas does not parse or ' +
      'validate this — it is just a string the solution recognizes.',
    example: 'proj_01HXYZ...',
  })
  @IsString()
  @IsNotEmpty()
  sourceIdentity: string;

  @ApiProperty({
    description:
      'Optional schema fingerprint. If provided, ccaas echoes it back on ' +
      'subsequent sync calls so the solution can reject syncs that were ' +
      'computed against a stale schema. Opaque string.',
    example: 'sha256:abcd1234...',
    required: false,
  })
  @IsString()
  @IsOptional()
  sourceSchemaHash?: string;

  @ApiProperty({
    description:
      'Owning tenant ID — must match the session\'s tenant. Cross-tenant ' +
      'attaches are rejected with 403. **Transitional**: kept on the body ' +
      'while SessionService.attachWorkspaceSource still requires it; α ' +
      'phase will rename to `solutionId`, a future phase may pull it from ' +
      'auth context entirely.',
    example: 'tenant-uuid',
  })
  // TODO(β-2): once SessionService is renamed + solutionId is read from
  // auth context, drop this field entirely. The wire shape will become
  // strictly `{sourceUrl, sourceIdentity, sourceSchemaHash?}`.
  @IsString()
  @IsNotEmpty()
  solutionId: string;
}
