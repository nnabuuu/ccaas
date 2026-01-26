/**
 * Update Context DTO
 *
 * Data transfer object for updating session context (form state sync).
 * Used to sync frontend form state to a file in the session workspace
 * so Claude Code can read current form values.
 */

import { IsOptional, IsObject, IsString } from 'class-validator';

/**
 * Request body for PUT /api/v1/sessions/:sessionId/context
 */
export class UpdateContextDto {
  @IsOptional()
  @IsString()
  lessonPlanId?: string;

  @IsOptional()
  @IsObject()
  currentForm?: Record<string, unknown>;
}
