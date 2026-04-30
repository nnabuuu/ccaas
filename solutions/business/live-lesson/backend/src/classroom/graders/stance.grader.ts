import type { Grader, GradeResult } from './grader.interface';
import type { StanceAnswerKey } from '../../schemas';

export class StanceGrader implements Grader {
  grade(key: StanceAnswerKey, data: Record<string, unknown>): GradeResult {
    const validPositions = key.validPositions || [];
    const minEvidence = key.minEvidence || 2;
    const raw = data.position;

    // Support both numeric index (legacy frontend) and text string
    let position: string;
    if (typeof raw === 'number') {
      position = (key.stanceOpts?.[raw] ?? '').toLowerCase();
    } else {
      position = String(raw ?? '').toLowerCase();
    }

    const evidence = (data.evidence || []) as unknown[];

    const hasValidPosition = validPositions.some(
      (v) => v.toLowerCase() === position,
    );
    const hasEnoughEvidence = Array.isArray(evidence) && evidence.length >= minEvidence;

    const byDimension: Record<string, boolean> = {
      position: hasValidPosition,
      evidence: hasEnoughEvidence,
    };

    const total = hasValidPosition && hasEnoughEvidence ? 100 : (hasValidPosition || hasEnoughEvidence ? 50 : 0);
    return { total, byDimension };
  }
}
