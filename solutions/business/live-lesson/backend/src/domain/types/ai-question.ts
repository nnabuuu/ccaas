/**
 * AiQuestionRecord — the shape domain code reads from an ai-question row.
 * TypeORM `AiQuestion` entity `implements AiQuestionRecord`.
 */
export interface AiQuestionRecord {
  id: number;
  sessionId: string;
  studentId: string;
  studentName: string;
  step: number;
  question: string;
  answer: string;
  category: string;
  askedAt: Date;
}
