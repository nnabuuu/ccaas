import { IsString, IsInt, Matches, Min, Max } from 'class-validator';

export class PhaseDto {
  @IsString()
  studentId: string;

  @IsInt()
  @Min(1)
  @Max(20)
  task: number;

  @Matches(/^(listen|practice(-\d+)?|discuss|discovery|takeaway|completed)$/)
  phase: string;
}
