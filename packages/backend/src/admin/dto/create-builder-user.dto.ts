/**
 * Create Builder User DTO
 *
 * Input for the one-step builder user onboarding endpoint.
 */

import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateBuilderUserDto {
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  tenantName: string;

  @IsString()
  @IsOptional()
  @MaxLength(64)
  @Matches(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, {
    message: 'tenantSlug must be lowercase alphanumeric with hyphens, not starting or ending with a hyphen',
  })
  tenantSlug?: string;
}
