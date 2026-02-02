/**
 * UpdateFieldDto
 *
 * DTO for updating a single field via output_update sync.
 */

import { IsString, IsNotEmpty } from 'class-validator';
import type { LessonPlanSyncField } from '@ccaas/common';

export class UpdateFieldDto {
  @IsString()
  @IsNotEmpty()
  field: LessonPlanSyncField;

  @IsNotEmpty()
  value: unknown;
}
