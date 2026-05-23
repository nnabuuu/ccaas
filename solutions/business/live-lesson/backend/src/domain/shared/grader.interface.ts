export type { GradeResult } from '../../../schemas';
import type { AnswerKey, GradeResult } from '../../../schemas';

export interface Grader {
  grade(key: AnswerKey, data: Record<string, unknown>): GradeResult | Promise<GradeResult>;
}
