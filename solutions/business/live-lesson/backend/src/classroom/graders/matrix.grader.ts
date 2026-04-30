import type { Grader, GradeResult } from './grader.interface';
import type { MatrixAnswerKey } from '../../schemas';

export class MatrixGrader implements Grader {
  grade(key: MatrixAnswerKey, data: Record<string, unknown>): GradeResult {
    const answers = (key.answers || []).filter((a) => !a.isDemo);
    const studentRows = (data.rows || []) as Array<Record<string, string>>;
    let placeCorrect = 0, practiceCorrect = 0, reasonCorrect = 0;
    const totalRows = answers.length;
    const byDimension: Record<string, number> = {};

    for (const a of answers) {
      const studentRow = studentRows[a.rowIdx] || {};
      const sPlace = (studentRow.place || '').toLowerCase().trim();
      const sPractice = (studentRow.practice || '').toLowerCase().trim();
      const sReason = (studentRow.reason || '').toLowerCase().trim();

      if (sPlace.includes(a.place.toLowerCase())) placeCorrect++;
      const practice = (a.practice ?? '').toLowerCase();
      const reason = (a.reason ?? '').toLowerCase();
      if (sPractice.includes(practice) || practice.includes(sPractice)) practiceCorrect++;
      if (sReason.includes(reason) || reason.includes(sReason)) reasonCorrect++;
    }

    byDimension.place = totalRows > 0 ? Math.round((placeCorrect / totalRows) * 100) : 0;
    byDimension.practice = totalRows > 0 ? Math.round((practiceCorrect / totalRows) * 100) : 0;
    byDimension.reason = totalRows > 0 ? Math.round((reasonCorrect / totalRows) * 100) : 0;

    const total = Math.round((byDimension.place + byDimension.practice + byDimension.reason) / 3);
    return { total, byDimension };
  }
}
