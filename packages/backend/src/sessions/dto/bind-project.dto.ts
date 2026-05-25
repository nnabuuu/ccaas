/**
 * Bind Project DTO
 *
 * Request body for POST /api/v1/sessions/:sessionId/bind-project.
 *
 * Tenant note: the body-supplied tenantId is validated against the
 * session's owning tenant inside SessionService.bindToProject — see
 * the ForbiddenException there. The DTO only enforces shape; the
 * service enforces ownership.
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
  tenantId: string;
}
