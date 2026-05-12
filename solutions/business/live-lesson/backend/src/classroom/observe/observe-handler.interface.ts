import { SetMetadata } from '@nestjs/common';
import type { Student } from '../../entities/student.entity';
import type { Submission } from '../../entities/submission.entity';
import type { AnswerKey } from '../../schemas/answer-key.schema';

export interface ObserveContext {
  sessionId: string;
  lessonId: string;
  students: Student[];
  subsByStudent: Map<string, Record<number, Submission>>;
  stepIdx: number;
  answerKey: AnswerKey | null;
  view: 'first' | 'latest';
}

export interface ObserveHandler {
  compute(ctx: ObserveContext): Promise<unknown> | unknown;
}

export const OBSERVE_TYPE_KEY = 'OBSERVE_TYPE';

export function ObserveType(type: string): ClassDecorator {
  return SetMetadata(OBSERVE_TYPE_KEY, type);
}
