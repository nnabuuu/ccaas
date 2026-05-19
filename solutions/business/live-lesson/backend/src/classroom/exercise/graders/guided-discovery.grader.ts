import type { Grader, GradeResult } from './grader.interface';
import type { GuidedDiscoveryAnswerKey, GuidedDiscoveryStep } from '../../../schemas';
import { matchesAny } from '../../../schemas/normalize-math';

export class GuidedDiscoveryGrader implements Grader {
  grade(key: GuidedDiscoveryAnswerKey, data: Record<string, unknown>): GradeResult {
    const stepsData = (data.steps ?? {}) as Record<string, Record<string, unknown>>;
    const byDimension: Record<string, boolean> = {};
    let correct = 0;

    for (const stepDef of key.steps) {
      const sd = stepsData[stepDef.id] ?? {};
      const ok = this.gradeStep(stepDef, sd);
      byDimension[stepDef.id] = ok;
      if (ok) correct++;
    }

    return {
      total: key.steps.length > 0 ? Math.round((correct / key.steps.length) * 100) : 0,
      byDimension,
    };
  }

  private gradeStep(stepDef: GuidedDiscoveryStep, sd: Record<string, unknown>): boolean {
    const answers = (sd.answers ?? {}) as Record<string, unknown>;

    switch (stepDef.type) {
      case 'observation_choice':
        return stepDef.choices.every(c => (answers as Record<string, number>)[c.id] === c.correct);

      case 'formula_blanks':
        return stepDef.blanks.every(b => {
          const v = (answers as Record<string, string>)[b.id];
          return v ? matchesAny(v, b.accepts) : false;
        });

      case 'derivation_blank':
        return stepDef.lines.every(line => {
          if (!line.blank) return true;
          const v = (answers as Record<string, string>)[line.blank.id];
          return v ? matchesAny(v, line.blank.accepts) : false;
        });

      case 'text_blanks':
        return stepDef.blanks.every(b => {
          const v = (answers as Record<string, string>)[b.id];
          return v ? matchesAny(v, b.accepts) : false;
        });

      default:
        return false;
    }
  }
}
