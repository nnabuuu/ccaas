import { Injectable } from '@nestjs/common';
import { ObserveType } from '../observe-handler.interface';
import type { ObserveHandler, ObserveContext } from '../observe-handler.interface';
import type { ImageUploadObserveData } from '../../../schemas/classroom/observe-data';

interface RubricItem {
  id: string;
  label: string;
  weight: number;
}

@Injectable()
@ObserveType('image-upload')
export class ImageUploadObserveHandler implements ObserveHandler {
  compute(ctx: ObserveContext): ImageUploadObserveData {
    if (ctx.answerKey && ctx.answerKey.type !== 'image-upload') {
      throw new Error(`ImageUploadObserveHandler expects image-upload answerKey, got ${ctx.answerKey.type}`);
    }
    const rubric = ((ctx.answerKey as Record<string, unknown> | null)?.rubric || []) as RubricItem[];

    const totalStudents = ctx.students.length;
    let submitted = 0;
    let totalScore = 0;
    let perfectCount = 0;
    let pendingReview = 0;

    // Per-rubric accumulators
    const rubricAccum = rubric.map(r => ({
      id: r.id,
      label: r.label,
      scoreSum: 0,
      count: 0,
      distribution: { 0: 0, 1: 0, 2: 0, 3: 0 } as Record<number, number>,
    }));

    const studentResults: ImageUploadObserveData['students'] = [];

    for (const student of ctx.students) {
      const subs = ctx.subsByStudent.get(student.id) || {};
      const sub = subs[ctx.stepIdx];
      if (!sub) continue;

      submitted++;
      const data = sub.dataJson || {};
      const scoreJson = sub.scoreJson || {};
      const images = (data.images || []) as string[];
      const score = (scoreJson.total as number) ?? 0;
      totalScore += score;
      if (score === 100) perfectCount++;

      // Parse rubric results from scoreJson
      const byDimension = (scoreJson.byDimension || {}) as Record<string, number>;
      const rubricResults: ImageUploadObserveData['students'][number]['rubricResults'] = [];
      let hasGrades = false;

      for (const ri of rubric) {
        const dimScore = byDimension[ri.id];
        if (dimScore !== undefined) {
          hasGrades = true;
          rubricResults.push({
            id: ri.id,
            label: ri.label,
            score: dimScore,
            comment: '',
          });

          // Accumulate rubric stats
          const acc = rubricAccum.find(a => a.id === ri.id);
          if (acc) {
            acc.scoreSum += dimScore;
            acc.count++;
            const bucket = Math.min(3, Math.max(0, Math.round(dimScore)));
            acc.distribution[bucket] = (acc.distribution[bucket] || 0) + 1;
          }
        }
      }

      if (!hasGrades) {
        pendingReview++;
      }

      // Extract feedback from checkItems if available
      let feedback = '';
      const checkItems = (data.checkItems || scoreJson.checkItems || []) as Array<Record<string, unknown>>;
      const llmItem = checkItems.find(it => it.idx === '_llm');
      if (llmItem?.hint) feedback = llmItem.hint as string;

      // Also try to get per-rubric comments from checkItems
      for (const ci of checkItems) {
        if (ci.idx === '_llm') continue;
        const rr = rubricResults.find(r => r.id === ci.idx);
        if (rr && ci.hint) rr.comment = ci.hint as string;
      }

      // Key insights
      const keyInsights = this.generateInsights(rubricResults, rubric);

      studentResults.push({
        id: student.id,
        name: student.name,
        score,
        images,
        rubricResults,
        feedback,
        keyInsights,
      });
    }

    const rubricStats = rubricAccum.map(acc => ({
      id: acc.id,
      label: acc.label,
      avgScore: acc.count > 0 ? acc.scoreSum / acc.count : 0,
      distribution: acc.distribution,
    }));

    return {
      stats: {
        totalStudents,
        submitted,
        avgScore: submitted > 0 ? totalScore / submitted : 0,
        perfectCount,
        pendingReview,
      },
      rubricStats,
      students: studentResults,
    };
  }

  private generateInsights(
    rubricResults: Array<{ id: string; label: string; score: number }>,
    rubric: RubricItem[],
  ): string[] {
    if (rubricResults.length === 0) return ['未批阅'];

    const insights: string[] = [];
    const allGood = rubricResults.every(r => r.score >= 2);
    if (allGood) {
      insights.push('✓ 完成良好');
      return insights;
    }

    for (const rr of rubricResults) {
      if (rr.score === 0) {
        insights.push(`缺失: ${rr.label}`);
      } else if (rr.score === 1) {
        insights.push(`基本: ${rr.label}`);
      }
    }

    return insights;
  }
}
