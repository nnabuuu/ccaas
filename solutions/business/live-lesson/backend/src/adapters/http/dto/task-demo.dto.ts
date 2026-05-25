import { IsInt, IsNotEmpty, IsObject, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateTaskDemoDto {
  @IsString()
  @IsNotEmpty()
  lessonId: string;

  @IsInt()
  @Min(1)
  step: number;
}

export class ClaimTaskDemoDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  user: string;
}

export class SubmitTaskDemoDto {
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @IsObject()
  data: Record<string, unknown>;
}
