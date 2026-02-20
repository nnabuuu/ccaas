import { IsString, IsOptional, IsEnum } from 'class-validator';

export enum ProblemStatus {
  PENDING = 'pending',
  EXPLAINING = 'explaining',
  COMPLETED = 'completed',
}

export class CreateProblemDto {
  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsString()
  subject: string;

  @IsOptional()
  @IsString()
  gradeLevel?: string;

  @IsOptional()
  @IsString()
  problemType?: string;

  @IsOptional()
  @IsString()
  tenantId?: string;
}

export class UpdateProblemDto {
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  gradeLevel?: string;

  @IsOptional()
  @IsString()
  problemType?: string;

  @IsOptional()
  @IsEnum(ProblemStatus)
  status?: ProblemStatus;
}
