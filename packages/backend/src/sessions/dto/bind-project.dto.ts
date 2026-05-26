/**
 * Bind Project DTO
 *
 * @deprecated since β-2 (2026-05-26) — use `AttachWorkspaceSourceDto`
 * with the new `POST /api/v1/sessions/:sessionId/attach-workspace-source`
 * route. This DTO is kept for one release while solutions migrate.
 *
 * Request body for POST /api/v1/sessions/:sessionId/bind-project.
 *
 * Solution note: the body-supplied solutionId is validated against the
 * session's owning tenant inside `SessionService.bindToProject` (a
 * deprecated alias that delegates to `attachWorkspaceSource`). The
 * DTO only enforces shape; the service enforces ownership.
 */

import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BindProjectDto {
  @ApiProperty({
    description: 'Project ID to bind this session to (opaque string, ' +
      'solution-defined).',
    example: 'proj_01HXYZ...',
  })
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @ApiProperty({
    description: 'Owning tenant ID — must match the session\'s tenant. ' +
      'Cross-tenant binds are rejected with 403.',
    example: 'tenant-uuid',
  })
  @IsString()
  @IsNotEmpty()
  solutionId: string;
}
