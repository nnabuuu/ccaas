/**
 * Bulk Kill DTO
 *
 * Validates bulk session termination requests
 */

import { IsArray, IsString, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export class BulkKillDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'sessionIds must contain at least one session ID' })
  @ArrayMaxSize(100, { message: 'Cannot terminate more than 100 sessions at once' })
  @IsString({ each: true, message: 'All session IDs must be strings' })
  sessionIds!: string[];
}
