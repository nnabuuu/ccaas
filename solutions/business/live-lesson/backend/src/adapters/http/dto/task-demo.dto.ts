import { IsInt, IsNotEmpty, IsObject, IsString, IsUUID, Matches, MaxLength, Min, MinLength } from 'class-validator';

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
  // \S asserts at least one non-whitespace character — blocks "   " which
  // would otherwise pass MinLength(1), trim to "", and create a Student
  // with an empty display name.
  @Matches(/\S/, { message: 'user must contain at least one non-whitespace character' })
  user: string;
}

export class SubmitTaskDemoDto {
  @IsUUID()
  studentId: string;

  @IsObject()
  data: Record<string, unknown>;
}
