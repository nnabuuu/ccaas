import { IsEnum, IsOptional, IsString } from 'class-validator';
import { UserStatus } from '../entities/user.entity';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(['active', 'suspended', 'deleted'])
  @IsOptional()
  status?: UserStatus;
}
