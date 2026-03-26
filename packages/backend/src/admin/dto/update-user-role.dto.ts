import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { UserRole } from '../../users/entities/user-tenant.entity';

export class UpdateUserRoleDto {
  @IsEnum(['admin', 'developer', 'viewer'])
  @IsOptional()
  role?: UserRole;

  @IsBoolean()
  @IsOptional()
  canCreateSkills?: boolean;
}
