import { SetMetadata } from '@nestjs/common';

export const EXERCISE_TYPE_KEY = 'EXERCISE_TYPE';

/**
 * Marks a class as an exercise type plugin.
 * The ExerciseTypeRegistry auto-discovers all providers carrying this metadata.
 *
 * @example
 * \@Injectable()
 * \@ExerciseType('quiz')
 * export class QuizPlugin implements ExerciseTypePlugin { ... }
 */
export function ExerciseType(type: string): ClassDecorator {
  return SetMetadata(EXERCISE_TYPE_KEY, type);
}
