import { SetMetadata } from '@nestjs/common';
import type { StudentRecord } from '../types/student';
import type { SubmissionRecord } from '../types/submission';
import type { AnswerKey } from '../../schemas/answer-key.schema';

export interface ObserveContext {
  sessionId: string;
  lessonId: string;
  students: StudentRecord[];
  subsByStudent: Map<string, Record<number, SubmissionRecord>>;
  stepIdx: number;
  answerKey: AnswerKey | null;
  view: 'first' | 'latest';
  partIds?: string[];
}

export interface ObserveHandler {
  compute(ctx: ObserveContext): Promise<unknown> | unknown;
}

export const OBSERVE_TYPE_KEY = 'OBSERVE_TYPE';

export function ObserveType(type: string): ClassDecorator {
  return SetMetadata(OBSERVE_TYPE_KEY, type);
}
