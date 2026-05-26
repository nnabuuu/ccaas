/**
 * Admin API Key Creation DTO
 *
 * Extends base CreateApiKeyDto with solutionId field for admin-level API key creation.
 */

import { IsString, IsNotEmpty } from 'class-validator';
import { CreateApiKeyDto } from '../../auth/dto/api-key.dto';

/**
 * Admin-level API key creation DTO
 * Extends base DTO with solutionId field
 */
export class CreateApiKeyAdminDto extends CreateApiKeyDto {
  @IsString()
  @IsNotEmpty()
  solutionId!: string; // Solution UUID or slug
}
