import { Injectable } from '@nestjs/common';
import { ObserveType } from '../observe-handler.interface';
import type { ObserveHandler, ObserveContext } from '../observe-handler.interface';
import type { ImageUploadObserveData, RichContentQuizObserveData } from '../../../schemas/classroom/observe-data';
import type { RichContentPart } from '../../../schemas';

interface RubricItem {
  id: string;
  label: string;
  weight: number;
}

@Injectable()
@ObserveType('image-upload')
export class ImageUploadObserveHandler implements ObserveHandler {
  compute(ctx: ObserveContext): ImageUploadObserveData | RichContentQuizObserveData {
    if (ctx.answerKey && !['image-upload', 'rich-content-quiz'].includes(ctx.answerKey.type)) {
      throw new Error(`ImageUploadObserveHandler expects image-upload or rich-content-quiz answerKey, got ${ctx.answerKey.type}`);
    }

    const ak = ctx.answerKey as Record<string, unknown> | null;
    const hasParts = Array.isArray(ak?.parts) && (ak!.parts as unknown[]).length > 0;

    // For rich-content-quiz with parts, delegate to parts-aware path
    if (hasParts) {
      return this.computePartsAware(ctx, ak!.parts as RichContentPart[]);
    }

    const rubric = (ak?.rubric || []) as RubricItem[];

    const totalStudents = ctx.students.length;
    let submitted = 0;
    let totalScore = 0;
    let perfectCount = 0;
    let pendingReview = 0;

    // Per-rubric accumulators (Map for O(1) lookup)
    const rubricAccum = new Map(rubric.map(r => [r.id, {
      id: r.id,
      label: r.label,
      scoreSum: 0,
      count: 0,
      distribution: { 0: 0, 1: 0, 2: 0, 3: 0 } as Record<number, number>,
    }]));

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
          const acc = rubricAccum.get(ri.id);
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

    const rubricStats = [...rubricAccum.values()].map(acc => ({
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

  /** Parts-aware observe computation for rich-content-quiz with parts */
  private computePartsAware(ctx: ObserveContext, parts: RichContentPart[]): RichContentQuizObserveData {
    const totalStudents = ctx.students.length;
    let submitted = 0;
    let totalScore = 0;
    let perfectCount = 0;
    let pendingReview = 0;

    // Scaffold distribution accumulators
    let independentCount = 0;
    let partialCount = 0;
    let fullCount = 0;

    // Error clustering accumulators
    const errorTagMap = new Map<string, { count: number; students: Array<{ id: string; name: string }> }>();

    // Use first part with scaffold for scaffold distribution reference
    const scaffoldPart = parts.find(p => p.scaffold);
    const maxScaffoldLevel = scaffoldPart?.scaffold ? scaffoldPart.scaffold.levels.length : 0;

    // Global rubric for rubricStats (flatten all parts' rubrics)
    const allRubric: RubricItem[] = parts.flatMap(p =>
      p.rubric.map(r => ({ id: `${p.id}_${r.id}`, label: r.label ?? r.id, weight: r.weight ?? 1 })),
    );
    const rubricAccum = new Map(allRubric.map(r => [r.id, {
      id: r.id, label: r.label, scoreSum: 0, count: 0,
      distribution: { 0: 0, 1: 0, 2: 0, 3: 0 } as Record<number, number>,
    }]));

    const studentResults: RichContentQuizObserveData['students'] = [];

    for (const student of ctx.students) {
      const subs = ctx.subsByStudent.get(student.id) || {};
      const sub = subs[ctx.stepIdx];
      if (!sub) continue;

      submitted++;
      const data = (sub.dataJson || {}) as Record<string, unknown>;
      const scoreJson = (sub.scoreJson || {}) as Record<string, unknown>;
      const partsProgress = (data.parts || {}) as Record<string, any>;
      const images = (data.images || []) as string[];
      const score = (scoreJson.total as number) ?? 0;
      totalScore += score;
      if (score === 100) perfectCount++;

      // Build per-student parts data
      const studentParts: Record<string, any> = {};
      let hasAnyGrades = false;

      for (const partDef of parts) {
        const pp = partsProgress[partDef.id];
        if (!pp) continue;
        hasAnyGrades = true;

        studentParts[partDef.id] = {
          completed: pp.completed ?? false,
          attempts: pp.attempts ?? 0,
          scaffoldLevel: pp.scaffoldLevel ?? -1,
          attemptsHistory: pp.attemptsHistory,
        };

        // Accumulate per-part rubric stats from latest score
        if (pp.score?.byDimension) {
          for (const ri of partDef.rubric) {
            const dimScore = pp.score.byDimension[ri.id];
            if (dimScore === undefined) continue;
            const accKey = `${partDef.id}_${ri.id}`;
            const acc = rubricAccum.get(accKey);
            if (acc) {
              acc.scoreSum += dimScore;
              acc.count++;
              const bucket = Math.min(3, Math.max(0, Math.round(dimScore)));
              acc.distribution[bucket] = (acc.distribution[bucket] || 0) + 1;
            }
          }
        }

        // Collect error tags from score
        if (pp.score?.errorTags) {
          for (const tag of pp.score.errorTags as string[]) {
            if (!errorTagMap.has(tag)) {
              errorTagMap.set(tag, { count: 0, students: [] });
            }
            const entry = errorTagMap.get(tag)!;
            // Avoid duplicate students for same tag
            if (!entry.students.some(s => s.id === student.id)) {
              entry.count++;
              entry.students.push({ id: student.id, name: student.name });
            }
          }
        }
      }

      if (!hasAnyGrades) pendingReview++;

      // Determine scaffold tier using the scaffold reference part
      let scaffoldTier: 'independent' | 'partial' | 'full' = 'independent';
      if (scaffoldPart) {
        const pp = partsProgress[scaffoldPart.id];
        if (pp) {
          const level = pp.scaffoldLevel ?? -1;
          if (level === -1) {
            scaffoldTier = 'independent';
            independentCount++;
          } else if (maxScaffoldLevel > 0 && level >= maxScaffoldLevel - 1) {
            scaffoldTier = 'full';
            fullCount++;
          } else {
            scaffoldTier = 'partial';
            partialCount++;
          }
        } else {
          independentCount++;
        }
      }

      // Determine input method from latest attempt history
      const latestMethod = this.getLatestMethod(partsProgress);

      // Build rubric results for display (from aggregate score)
      const byDimension = (scoreJson.byDimension || {}) as Record<string, number>;
      const rubricResults: ImageUploadObserveData['students'][number]['rubricResults'] = [];
      for (const [dimKey, dimScore] of Object.entries(byDimension)) {
        const matchedRubric = allRubric.find(r => r.id === dimKey);
        rubricResults.push({
          id: dimKey,
          label: matchedRubric?.label ?? dimKey,
          score: dimScore as number,
          comment: '',
        });
      }

      const keyInsights = this.generateInsights(rubricResults, allRubric);

      studentResults.push({
        id: student.id,
        name: student.name,
        score,
        images,
        rubricResults,
        feedback: (scoreJson.llmFeedback as string) ?? '',
        keyInsights,
        parts: studentParts,
        scaffoldTier,
        method: latestMethod,
      });
    }

    const rubricStats = [...rubricAccum.values()].map(acc => ({
      id: acc.id, label: acc.label,
      avgScore: acc.count > 0 ? acc.scoreSum / acc.count : 0,
      distribution: acc.distribution,
    }));

    // Build error clusters sorted by count desc
    const errorClusters = [...errorTagMap.entries()]
      .map(([type, data]) => ({ type, count: data.count, students: data.students }))
      .sort((a, b) => b.count - a.count);

    return {
      stats: { totalStudents, submitted, avgScore: submitted > 0 ? totalScore / submitted : 0, perfectCount, pendingReview },
      rubricStats,
      students: studentResults,
      scaffoldDistribution: scaffoldPart ? { independent: independentCount, partial: partialCount, full: fullCount } : undefined,
      errorClusters: errorClusters.length > 0 ? errorClusters : undefined,
    };
  }

  /** Extract latest input method from any part's attemptsHistory */
  private getLatestMethod(partsProgress: Record<string, any>): 'handwrite' | 'photo' {
    let latest = 'photo';
    let latestTime = '';
    for (const pp of Object.values(partsProgress)) {
      if (!pp?.attemptsHistory?.length) continue;
      const lastAttempt = pp.attemptsHistory[pp.attemptsHistory.length - 1];
      if (lastAttempt.submittedAt > latestTime) {
        latestTime = lastAttempt.submittedAt;
        latest = lastAttempt.method ?? 'photo';
      }
    }
    return latest as 'handwrite' | 'photo';
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
