import { Injectable, Logger } from '@nestjs/common';

/**
 * Pure-function grading service.
 * Takes an answerKey + student data, returns a score object.
 * No repository dependencies.
 */
@Injectable()
export class GradingService {
  private readonly logger = new Logger(GradingService.name);

  /**
   * Dispatch to type-specific grader based on answerKey.type.
   * Returns null if no answerKey or type is unknown.
   */
  grade(answerKey: any, data: Record<string, any>): Record<string, any> | null {
    if (!answerKey) return null;

    switch (answerKey.type) {
      case 'quiz':
        return this.gradeQuiz(answerKey, data);
      case 'match':
        return this.gradeMatch(answerKey, data);
      case 'matrix':
        return this.gradeMatrix(answerKey, data);
      case 'stance':
        return this.gradeStance(answerKey, data);
      case 'order':
        return this.gradeOrder(answerKey, data);
      default:
        return null;
    }
  }

  private gradeQuiz(key: any, data: Record<string, any>): Record<string, any> {
    const answers = key.answers || [];
    const studentAnswers = data.answers || [];
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
    if (data.attemptCounts) {
      for (const a of answers) {
        attemptCounts[`q${a.questionIdx}`] = data.attemptCounts[a.questionIdx] ?? 1;
      }
    }

    return { total, byDimension, ...(Object.keys(attemptCounts).length > 0 && { attemptCounts }) };
  }

  private gradeMatch(key: any, data: Record<string, any>): Record<string, any> {
    const answers = key.answers || [];
    const studentPairs = data.pairs || data.answers || [];
    const byDimension: Record<string, boolean> = {};
    let correct = 0;

    for (const a of answers) {
      const studentPair = studentPairs[a.pairIdx];
      const studentValue = typeof studentPair === 'string' ? studentPair : studentPair?.value;
      const isCorrect = studentValue?.toLowerCase() === a.correct.toLowerCase();
      byDimension[`p${a.pairIdx}`] = isCorrect;
      if (isCorrect) correct++;
    }

    const total = answers.length > 0 ? Math.round((correct / answers.length) * 100) : 0;

    const attemptCounts: Record<string, number> = {};
    if (data.attemptCounts) {
      for (const a of answers) {
        attemptCounts[`p${a.pairIdx}`] = data.attemptCounts[a.pairIdx] ?? 1;
      }
    }

    return { total, byDimension, ...(Object.keys(attemptCounts).length > 0 && { attemptCounts }) };
  }

  private gradeMatrix(key: any, data: Record<string, any>): Record<string, any> {
    const answers = (key.answers || []).filter((a: any) => !a.isDemo);
    const studentRows = data.rows || [];
    let placeCorrect = 0, practiceCorrect = 0, reasonCorrect = 0;
    const totalRows = answers.length;
    const byDimension: Record<string, number> = {};

    for (const a of answers) {
      const studentRow = studentRows[a.rowIdx] || {};
      const sPlace = (studentRow.place || '').toLowerCase().trim();
      const sPractice = (studentRow.practice || '').toLowerCase().trim();
      const sReason = (studentRow.reason || '').toLowerCase().trim();

      if (sPlace.includes(a.place.toLowerCase())) placeCorrect++;
      if (sPractice.includes(a.practice.toLowerCase()) || a.practice.toLowerCase().includes(sPractice)) practiceCorrect++;
      if (sReason.includes(a.reason.toLowerCase()) || a.reason.toLowerCase().includes(sReason)) reasonCorrect++;
    }

    byDimension.place = totalRows > 0 ? Math.round((placeCorrect / totalRows) * 100) : 0;
    byDimension.practice = totalRows > 0 ? Math.round((practiceCorrect / totalRows) * 100) : 0;
    byDimension.reason = totalRows > 0 ? Math.round((reasonCorrect / totalRows) * 100) : 0;

    const total = Math.round((byDimension.place + byDimension.practice + byDimension.reason) / 3);
    return { total, byDimension };
  }

  private gradeStance(key: any, data: Record<string, any>): Record<string, any> {
    const validPositions = key.validPositions || [];
    const minEvidence = key.minEvidence || 2;
    const position = (data.position || '').toLowerCase();
    const evidence = data.evidence || [];

    const hasValidPosition = validPositions.includes(position);
    const hasEnoughEvidence = Array.isArray(evidence) && evidence.length >= minEvidence;

    const byDimension: Record<string, boolean> = {
      position: hasValidPosition,
      evidence: hasEnoughEvidence,
    };

    const total = hasValidPosition && hasEnoughEvidence ? 100 : (hasValidPosition || hasEnoughEvidence ? 50 : 0);
    return { total, byDimension };
  }

  private gradeOrder(key: any, data: Record<string, any>): Record<string, any> {
    const correctOrder = key.correctOrder || [];
    const studentOrder = data.order || [];

    const isCorrect = correctOrder.length === studentOrder.length &&
      correctOrder.every((item: string, idx: number) => {
        const studentItem = typeof studentOrder[idx] === 'string' ? studentOrder[idx] : studentOrder[idx]?.label;
        return studentItem?.toLowerCase() === item.toLowerCase();
      });

    return { total: isCorrect ? 100 : 0, byDimension: { correct: isCorrect } };
  }
}
