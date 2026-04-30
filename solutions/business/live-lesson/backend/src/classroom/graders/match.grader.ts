import type { Grader, GradeResult } from './grader.interface';
import type { MatchAnswerKey } from '../../schemas';

export class MatchGrader implements Grader {
  grade(key: MatchAnswerKey, data: Record<string, unknown>): GradeResult {
    const answers = key.answers || [];
    const studentPairs = (data.pairs || data.answers || []) as unknown[];
    const byDimension: Record<string, boolean> = {};
    let correct = 0;

    for (const a of answers) {
      const studentPair = studentPairs[a.pairIdx] as string | { value?: string } | undefined;
      const studentValue = typeof studentPair === 'string' ? studentPair : studentPair?.value;
      const isCorrect = studentValue?.toLowerCase() === a.correct.toLowerCase();
      byDimension[`p${a.pairIdx}`] = isCorrect;
      if (isCorrect) correct++;
    }

    const total = answers.length > 0 ? Math.round((correct / answers.length) * 100) : 0;

    const attemptCounts: Record<string, number> = {};
    const dataAttempts = data.attemptCounts as Record<string, number> | undefined;
    if (dataAttempts) {
      for (const a of answers) {
        attemptCounts[`p${a.pairIdx}`] = dataAttempts[a.pairIdx] ?? 1;
      }
    }

    return { total, byDimension, ...(Object.keys(attemptCounts).length > 0 && { attemptCounts }) };
  }
}
