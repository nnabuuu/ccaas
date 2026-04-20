import { IsInt, Min, Max } from 'class-validator';

export class StepDto {
  @IsInt()
  @Min(0)
  @Max(4)
  step: number;
}
