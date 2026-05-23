import type { AiQuestionRecord } from '../types/ai-question';

export const AI_QUESTION_REPO_PORT = Symbol('AiQuestionRepoPort');

export type AiQuestionInsert = Omit<AiQuestionRecord, 'id' | 'askedAt'>;

export interface AiQuestionRepoPort {
  findBySession(sessionId: string): Promise<AiQuestionRecord[]>;
  countAskByStudent(sessionId: string, studentId: string): Promise<number>;
  insert(rec: AiQuestionInsert): Promise<void>;
}
