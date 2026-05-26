import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { UserRole } from '../entities/user-solution.entity';

export class CreateUserTenantDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @IsUUID()
  @IsNotEmpty()
  solutionId: string;

  @IsEnum(['admin', 'developer', 'viewer'])
  @IsNotEmpty()
  role: UserRole;

  @IsBoolean()
  @IsOptional()
  canCreateSkills?: boolean;
}
