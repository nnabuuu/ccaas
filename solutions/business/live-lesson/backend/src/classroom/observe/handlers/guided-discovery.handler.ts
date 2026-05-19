import { Injectable } from '@nestjs/common';
import { ObserveType } from '../observe-handler.interface';
import type { ObserveHandler, ObserveContext } from '../observe-handler.interface';
import type { GuidedDiscoveryObserveData } from '../../../schemas/classroom/observe-data';
import type { GuidedDiscoveryAnswerKey, GuidedDiscoveryStep } from '../../../schemas/answer-key.schema';
import { normalizeMath } from '../../../schemas/normalize-math';

type ErrorMap = Map<string, Array<{ id: string; name: string }>>;

function addError(
  errorMap: ErrorMap,
  desc: string,
  student: { id: string; name: string },
): void {
  const arr = errorMap.get(desc) || [];
  arr.push({ id: student.id, name: student.name });
  errorMap.set(desc, arr);
}

@Injectable()
@ObserveType('guided-discovery')
export class GuidedDiscoveryObserveHandler implements ObserveHandler {
  compute(ctx: ObserveContext): GuidedDiscoveryObserveData {
    if (ctx.answerKey && ctx.answerKey.type !== 'guided-discovery') {
      throw new Error(`GuidedDiscoveryObserveHandler expects guided-discovery answerKey, got ${ctx.answerKey.type}`);
    }
    const key = ctx.answerKey as GuidedDiscoveryAnswerKey | null;
    const steps = key?.steps || [];

    const stepDefs = steps.map(s => ({ id: s.id, title: s.title, type: s.type }));

    // Per-step accumulators
    const stepPassedCounts: Record<string, number> = {};
    const stepErrors: Record<string, ErrorMap> = {};
    for (const s of steps) {
      stepPassedCounts[s.id] = 0;
      stepErrors[s.id] = new Map();
    }

    const studentResults: GuidedDiscoveryObserveData['students'] = [];
    let submitted = 0;
    let totalScore = 0;
    let perfectCount = 0;
    let totalTime = 0;
    let timeCount = 0;

    for (const student of ctx.students) {
      const subs = ctx.subsByStudent.get(student.id) || {};
      const sub = subs[ctx.stepIdx];

      if (!sub) {
        studentResults.push({
          id: student.id,
          name: student.name,
          submitted: false,
          score: 0,
          time: 0,
          stepResults: {},
          stepAnswers: {},
          keyInsights: [],
        });
        continue;
      }

      submitted++;
      const score = sub.scoreJson?.total ?? 0;
      const byDimension = (sub.scoreJson?.byDimension ?? {}) as Record<string, boolean>;
      const data = sub.dataJson || {};
      const stepsData = (data.steps ?? {}) as Record<string, Record<string, unknown>>;
      const duration = sub.duration ?? 0;

      totalScore += score;
      if (score === 100) perfectCount++;
      if (duration > 0) { totalTime += duration; timeCount++; }

      const stepResults: Record<string, boolean> = {};
      const stepAnswers: Record<string, Record<string, unknown>> = {};

      for (const stepDef of steps) {
        const passed = byDimension[stepDef.id] ?? false;
        stepResults[stepDef.id] = passed;
        if (passed) stepPassedCounts[stepDef.id]++;

        const sd = stepsData[stepDef.id] ?? {};
        const answers = (sd.answers ?? {}) as Record<string, unknown>;
        stepAnswers[stepDef.id] = answers;

        if (!passed) {
          this.detectErrors(stepDef, answers, student, stepErrors[stepDef.id]);
        }
      }

      const wrongCount = Object.values(stepResults).filter(v => !v).length;
      const insights: string[] = [];
      if (wrongCount > 0) insights.push(`${wrongCount} 步答错`);

      studentResults.push({
        id: student.id,
        name: student.name,
        submitted: true,
        score,
        time: duration,
        stepResults,
        stepAnswers,
        keyInsights: insights,
      });
    }

    const stepStats = steps.map(s => {
      const passedCount = stepPassedCounts[s.id];
      const errors: GuidedDiscoveryObserveData['stepStats'][number]['errors'] = [];
      for (const [desc, students] of stepErrors[s.id]) {
        errors.push({ description: desc, count: students.length, students });
      }
      errors.sort((a, b) => b.count - a.count);
      return {
        id: s.id,
        title: s.title,
        passedCount,
        passedRate: submitted > 0 ? Math.round((passedCount / submitted) * 100) : 0,
        errors,
      };
    });

    return {
      stats: {
        totalStudents: ctx.students.length,
        submitted,
        avgScore: submitted > 0 ? Math.round(totalScore / submitted) : 0,
        perfectCount,
        avgTime: timeCount > 0 ? Math.round(totalTime / timeCount) : 0,
      },
      stepDefs,
      stepStats,
      students: studentResults.sort((a, b) => {
        if (a.submitted !== b.submitted) return a.submitted ? -1 : 1;
        return b.score - a.score;
      }),
    };
  }

  private detectErrors(
    stepDef: GuidedDiscoveryStep,
    answers: Record<string, unknown>,
    student: { id: string; name: string },
    errorMap: ErrorMap,
  ): void {
    switch (stepDef.type) {
      case 'observation_choice':
        for (const choice of stepDef.choices) {
          const selected = answers[choice.id];
          if (selected != null && selected !== choice.correct) {
            const wrongOpt = choice.options[selected as number] ?? `选项${selected}`;
            addError(errorMap, `${choice.prompt}: 选了"${wrongOpt}"`, student);
          }
        }
        break;
      case 'formula_blanks':
        for (const blank of stepDef.blanks) {
          const val = answers[blank.id] as string | undefined;
          if (val && !blank.accepts.some(a => normalizeMath(a) === normalizeMath(val))) {
            addError(errorMap, `${blank.label}: 填了"${val}"（应为 ${blank.accepts[0]}）`, student);
          }
        }
        break;
      case 'derivation_blank':
        for (const line of stepDef.lines) {
          if (!line.blank) continue;
          const val = answers[line.blank.id] as string | undefined;
          if (val && !line.blank.accepts.some(a => normalizeMath(a) === normalizeMath(val))) {
            addError(errorMap, `推导: 填了"${val}"（应为 ${line.blank.accepts[0]}）`, student);
          }
        }
        break;
      case 'text_blanks':
        for (const blank of stepDef.blanks) {
          const val = answers[blank.id] as string | undefined;
          if (val && !blank.accepts.some(a => normalizeMath(a) === normalizeMath(val))) {
            addError(errorMap, `填空: 填了"${val}"（应为 ${blank.accepts[0]}）`, student);
          }
        }
        break;
    }
  }
}
