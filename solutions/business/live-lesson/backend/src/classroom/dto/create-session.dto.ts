import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class CreateSessionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9-]+$/)
  lessonId: string;
}
