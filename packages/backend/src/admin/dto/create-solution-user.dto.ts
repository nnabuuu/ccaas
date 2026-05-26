/**
 * Create Solution User DTO
 *
 * Input for creating a user within a specific tenant.
 */

import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateTenantUserDto {
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsUUID()
  @IsNotEmpty()
  solutionId: string;

  @IsEnum(['admin', 'developer', 'viewer'])
  @IsOptional()
  role?: 'admin' | 'developer' | 'viewer';
}
