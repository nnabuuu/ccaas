import { IsString, IsInt, IsIn, Min, Max } from 'class-validator';

const VALID_PHASES = ['listen', 'practice', 'discuss', 'takeaway', 'completed'] as const;

export class PhaseDto {
  @IsString()
  studentId: string;

  @IsInt()
  @Min(1)
  @Max(20)
  task: number;

  @IsIn(VALID_PHASES)
  phase: string;
}
