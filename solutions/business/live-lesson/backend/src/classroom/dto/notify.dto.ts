import { IsString, IsOptional, IsIn, MaxLength } from 'class-validator';

export class NotifyDto {
  @IsString()
  @MaxLength(500)
  message: string;

  @IsOptional()
  @IsIn(['hint', 'vocab', 'time', 'general'])
  type?: 'hint' | 'vocab' | 'time' | 'general';
}
