import type { Grader, GradeResult } from '../../shared/grader.interface';
import type { QuizAnswerKey } from '../../../schemas';

export class QuizGrader implements Grader {
  grade(key: QuizAnswerKey, data: Record<string, unknown>): GradeResult {
    const answers = key.answers || [];
    const studentAnswers = (data.answers || []) as unknown[];
    const byDimension: Record<string, boolean> = {};
    let correct = 0;

    for (const a of answers) {
      const studentAnswer = studentAnswers[a.questionIdx];
      const isCorrect = studentAnswer === a.correct;
      byDimension[`q${a.questionIdx}`] = isCorrect;
      if (isCorrect) correct++;
    }

    const total = answers.length > 0 ? Math.round((correct / answers.length) * 100) : 0;

    const attemptCounts: Record<string, number> = {};
    const dataAttempts = data.attemptCounts as Record<string, number> | undefined;
    if (dataAttempts) {
      for (const a of answers) {
        attemptCounts[`q${a.questionIdx}`] = dataAttempts[a.questionIdx] ?? 1;
      }
    }

    return { total, byDimension, ...(Object.keys(attemptCounts).length > 0 && { attemptCounts }) };
  }
}
