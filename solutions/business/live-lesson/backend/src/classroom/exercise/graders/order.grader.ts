import type { Grader, GradeResult } from './grader.interface';
import type { OrderAnswerKey } from '../../../schemas';

export class OrderGrader implements Grader {
  grade(key: OrderAnswerKey, data: Record<string, unknown>): GradeResult {
    const items = key.items || [];
    const correctOrder = key.correctOrder || [];
    const studentOrder = (data.order || []) as Array<string | number | { label?: string }>;

    // correctOrder contains numeric indices into items[]; resolve to labels
    const correctLabels = correctOrder.map((idx) => items[idx] ?? '');

    const isCorrect = correctLabels.length === studentOrder.length &&
      correctLabels.every((label, idx) => {
        const raw = studentOrder[idx];
        // Handle numeric indices (frontend sends item indices, not labels)
        const studentLabel = typeof raw === 'number'
          ? (items[raw] ?? '')
          : typeof raw === 'string'
            ? raw
            : (raw as { label?: string })?.label ?? '';
        return studentLabel.toLowerCase() === label.toLowerCase();
      });

    return { total: isCorrect ? 100 : 0, byDimension: { correct: isCorrect } };
  }
}
