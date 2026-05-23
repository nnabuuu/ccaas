import type { Grader, GradeResult } from '../../shared/grader.interface';
import type { SelectEvidenceAnswerKey } from '../../../schemas';

export class SelectEvidenceGrader implements Grader {
  grade(key: SelectEvidenceAnswerKey, data: Record<string, unknown>): GradeResult {
    const sections = key.sections || [];
    const paragraphTokens = key.paragraphTokens || {};
    const studentSections = (data.sections || {}) as Record<
      string,
      { function: string; picked: string[] }
    >;

    const totalSections = sections.length;
    const byDimension: Record<string, boolean | number> = {};
    let scoreSum = 0;
    let completedCount = 0;

    for (const sec of sections) {
      const student = studentSections[sec.id];
      if (!student) {
        continue;
      }

      completedCount++;
      const funcCorrect =
        student.function?.toLowerCase() === sec.correctFunction.toLowerCase();

      const pickedSet = new Set(student.picked || []);
      let totalEvidence = 0;
      let truePositives = 0;
      let wrongPicks = 0;

      for (const pn of sec.range) {
        const tokens = paragraphTokens[String(pn)];
        if (!tokens) continue;
        tokens.forEach((tk, i) => {
          const tokenKey = `${pn}:${i}`;
          if (tk.kind === 'evidence') {
            totalEvidence++;
            if (pickedSet.has(tokenKey)) truePositives++;
          } else if (
            pickedSet.has(tokenKey) &&
            (tk.kind === 'pick' || tk.kind === 'distractor')
          ) {
            wrongPicks++;
          }
        });
      }

      const recall = totalEvidence > 0 ? truePositives / totalEvidence : 0;
      const precisionFactor =
        wrongPicks > 0 && totalEvidence > 0
          ? Math.max(0, 1 - wrongPicks / totalEvidence)
          : 1;
      const evidenceScore = recall * precisionFactor;

      const sectionScore = funcCorrect
        ? 0.3 + 0.7 * evidenceScore
        : 0.3 * evidenceScore;

      scoreSum += sectionScore;

      byDimension[`${sec.id}_func`] = funcCorrect;
      byDimension[`${sec.id}_hit`] = truePositives;
      byDimension[`${sec.id}_total`] = totalEvidence;
      byDimension[`${sec.id}_wrong`] = wrongPicks;
    }

    byDimension['sectionsCompleted'] = completedCount;
    byDimension['sectionsTotal'] = totalSections;

    const total =
      totalSections > 0 ? Math.round((scoreSum / totalSections) * 100) : 0;

    return { total, byDimension };
  }
}
