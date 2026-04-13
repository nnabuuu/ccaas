import { IsArray, IsString } from 'class-validator';

export class LinkExercisesDto {
  @IsArray()
  @IsString({ each: true })
  exercise_ids: string[];
}
