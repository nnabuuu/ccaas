/**
 * AttachWorkspaceSource DTO — request body for
 * `POST /api/v1/sessions/:sessionId/attach-workspace-source`.
 *
 * ccaas-core does not know what a "project" is — that is a
 * solution-side concept. It only needs an opaque identifier + a URL
 * to pull artifacts from:
 *
 *   - `sourceUrl`        — REST base URL the solution exposes for
 *                          artifact GET/PUT/DELETE (opaque to ccaas)
 *   - `sourceIdentity`   — opaque identifier the solution wants ccaas
 *                          to use when calling that URL (becomes the
 *                          path segment in {sourceUrl}/{sourceIdentity})
 *   - `sourceSchemaHash` — optional fingerprint so the solution can
 *                          reject stale syncs after a schema change
 *   - `solutionId`       — owning solution; cross-solution attaches
 *                          are rejected with 403
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
  // Fail-fast at the boundary: a misconfig surfaces as a 400 here
  // instead of a confusing fetch failure later during sync.
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
      'Owning solution ID — must match the session\'s solution. ' +
      'Cross-solution attaches are rejected with 403.',
    example: 'solution-uuid',
  })
  @IsString()
  @IsNotEmpty()
  solutionId: string;
}
