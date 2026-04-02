/**
 * Control Response DTO
 *
 * Data transfer object for submitting control responses (wizard answers).
 * POST /api/v1/sessions/:sessionId/control-response
 */

import { IsString, IsObject, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ControlResponseDto {
  @ApiProperty({
    description: 'control_request 的 ID / ID of the control_request',
    example: 'ctrl_abc123',
  })
  @IsString()
  @IsNotEmpty()
  requestId: string;

  @ApiProperty({
    description: '用户回答 / User answers (key=field name, value=answer)',
    example: { subject: '数学', grade: '八年级上' },
  })
  @IsObject()
  @IsNotEmpty()
  answers: Record<string, string>;
}
