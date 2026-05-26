import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { UserRole } from '../entities/user-solution.entity';

export class UpdateUserTenantDto {
  @IsEnum(['admin', 'developer', 'viewer'])
  @IsOptional()
  role?: UserRole;

  @IsBoolean()
  @IsOptional()
  canCreateSkills?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
