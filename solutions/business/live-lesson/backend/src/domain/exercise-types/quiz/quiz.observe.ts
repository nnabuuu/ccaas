import { Injectable } from '@nestjs/common';
import { ObserveType } from '../../shared/observe-handler.interface';
import type { ObserveHandler, ObserveContext } from '../../shared/observe-handler.interface';
import type { McObserveData } from '../../../schemas/classroom/observe-data';
import type { QuizAnswerKey } from '../../../schemas/answer-key.schema';

type QuizAnswer = QuizAnswerKey['answers'][number];
type QDist = Array<Array<{ count: number; students: Array<{ id: string; name: string }> }>>;

@Injectable()
@ObserveType('mc')
export class QuizObserveHandler implements ObserveHandler {
  compute(ctx: ObserveContext): McObserveData {
    if (ctx.answerKey && ctx.answerKey.type !== 'quiz') {
      throw new Error(`QuizObserveHandler expects quiz answerKey, got ${ctx.answerKey.type}`);
    }
    const key = ctx.answerKey as QuizAnswerKey | null;
    const answers = key?.answers || [];
    const { studentResults, stats, qDistributions } = this.buildStudentResults(ctx, answers);
    const questions = this.buildQuestionStats(answers, qDistributions);
    const misconceptions = this.detectMisconceptions(answers, qDistributions);
    return { stats, questions, misconceptions, students: studentResults };
  }

  private buildStudentResults(
    ctx: ObserveContext,
    answers: QuizAnswer[],
  ): { studentResults: McObserveData['students']; stats: McObserveData['stats']; qDistributions: QDist } {
    const totalStudents = ctx.students.length;
    const studentResults: McObserveData['students'] = [];
    let submitted = 0;
    let totalScore = 0;
    let perfectCount = 0;
    let zeroCount = 0;
    let totalTime = 0;
    let timeCount = 0;
    let minTime = Infinity;
    let maxTime = 0;

    const qDistributions: QDist = [];
    for (let qi = 0; qi < answers.length; qi++) {
      const optCount = answers[qi].options?.length || 4;
      qDistributions.push(Array.from({ length: optCount }, () => ({ count: 0, students: [] })));
    }

    for (const student of ctx.students) {
      const subs = ctx.subsByStudent.get(student.id) || {};
      const sub = subs[ctx.stepIdx];
      if (!sub) continue;

      submitted++;
      const rawScore = sub.scoreJson?.total ?? 0;

      const data = sub.dataJson || {};
      const studentAnswers = (ctx.view === 'first' && data.firstAttemptAnswers)
        ? data.firstAttemptAnswers
        : (data.answers || []);
      const questionTimes = data.questionTimes || {};
      const answerChanges = data.answerChanges || [];

      const perQAnswers: Record<string, { selected: number; correct: boolean; changed: boolean; timeSpent: number }> = {};
      let studentTime = 0;

      for (let qi = 0; qi < answers.length; qi++) {
        const selected = studentAnswers[qi];
        const correctIdx = answers[qi].correct;
        const isCorrect = selected === correctIdx;
        const changed = answerChanges.some((c: Record<string, unknown>) => c.qi === qi);
        const timeSpent = questionTimes[qi] || 0;
        studentTime += timeSpent;

        perQAnswers[qi] = { selected, correct: isCorrect, changed, timeSpent };

        if (selected != null && qDistributions[qi] && qDistributions[qi][selected]) {
          qDistributions[qi][selected].count++;
          qDistributions[qi][selected].students.push({ id: student.id, name: student.name });
        }
      }

      if (studentTime > 0) {
        totalTime += studentTime; timeCount++;
        if (studentTime < minTime) minTime = studentTime;
        if (studentTime > maxTime) maxTime = studentTime;
      }

      const computedCorrect = Object.values(perQAnswers).filter(a => a.correct).length;
      const score = (ctx.view === 'first' && data.firstAttemptAnswers)
        ? (answers.length > 0 ? Math.round((computedCorrect / answers.length) * 100) : 0)
        : rawScore;
      totalScore += score;
      if (score === 100) perfectCount++;
      if (score === 0) zeroCount++;

      const insights: string[] = [];
      const wrongQs = Object.entries(perQAnswers).filter(([, a]) => !a.correct && a.selected != null);
      if (wrongQs.length > 0) insights.push(`${wrongQs.length} 题答错`);
      if (answerChanges.length > 0) insights.push(`改过 ${answerChanges.length} 次答案`);

      studentResults.push({
        id: student.id,
        name: student.name,
        score,
        time: studentTime,
        answers: perQAnswers,
        keyInsights: insights,
      });
    }

    return {
      studentResults,
      stats: {
        totalStudents,
        submitted,
        avgScore: submitted > 0 ? totalScore / submitted : 0,
        perfectCount,
        zeroCount,
        avgTime: timeCount > 0 ? totalTime / timeCount : 0,
        fastestTime: timeCount > 0 ? minTime : 0,
        slowestTime: timeCount > 0 ? maxTime : 0,
      },
      qDistributions,
    };
  }

  private buildQuestionStats(answers: QuizAnswer[], qDistributions: QDist): McObserveData['questions'] {
    return answers.map((a, qi) => {
      const dist = qDistributions[qi] || [];
      const totalForQ = dist.reduce((s, d) => s + d.count, 0);
      const correctCount = dist[a.correct]?.count || 0;
      return {
        idx: qi,
        stem: a.questionText || '',
        tag: a.label || undefined,
        options: a.options || [],
        correctIdx: a.correct,
        distribution: dist.map(d => ({
          count: d.count,
          pct: totalForQ > 0 ? (d.count / totalForQ) * 100 : 0,
        })),
        correctRate: totalForQ > 0 ? (correctCount / totalForQ) * 100 : 0,
      };
    });
  }

  private detectMisconceptions(answers: QuizAnswer[], qDistributions: QDist): McObserveData['misconceptions'] {
    const misconceptions: McObserveData['misconceptions'] = [];
    for (let qi = 0; qi < answers.length; qi++) {
      const correctIdx = answers[qi].correct;
      const dist = qDistributions[qi] || [];
      for (let oi = 0; oi < dist.length; oi++) {
        if (oi === correctIdx) continue;
        if (dist[oi].count >= 3) {
          misconceptions.push({
            id: `q${qi}_opt${oi}`,
            label: `Q${qi + 1}: ${dist[oi].count} 人选了 ${String.fromCharCode(65 + oi)}（应为 ${String.fromCharCode(65 + correctIdx)}）`,
            count: dist[oi].count,
            severity: dist[oi].count >= 5 ? 'high' : 'medium',
            students: dist[oi].students,
          });
        }
      }
    }
    return misconceptions;
  }
}
