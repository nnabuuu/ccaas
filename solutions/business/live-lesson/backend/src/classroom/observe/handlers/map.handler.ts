import { Injectable } from '@nestjs/common';
import { ObserveType } from '../observe-handler.interface';
import type { ObserveHandler, ObserveContext } from '../observe-handler.interface';
import type { MapObserveData } from '../../../schemas/classroom/observe-data';
import type { MapAnswerKey } from '../../../schemas/answer-key.schema';

@Injectable()
@ObserveType('map')
export class MapObserveHandler implements ObserveHandler {
  compute(ctx: ObserveContext): MapObserveData {
    if (ctx.answerKey && ctx.answerKey.type !== 'map') {
      throw new Error(`MapObserveHandler expects map answerKey, got ${ctx.answerKey.type}`);
    }
    const key = ctx.answerKey as MapAnswerKey | null;
    const akItems = key?.items || [];
    const expected = key?.expected || {};
    const defaultAxis = { neg: '', pos: '', label: '' };
    const axes: MapObserveData['axes'] = (key?.axes as MapObserveData['axes']) ?? { x: { ...defaultAxis }, y: { ...defaultAxis } };
    const totalStudents = ctx.students.length;

    let submitted = 0;
    let totalDeviation = 0;
    let deviationCount = 0;
    let reasonedCount = 0;

    const itemData: Record<string, { placements: Array<{ studentId: string; studentName: string; x: number; y: number; deviation: number }> }> = {};
    for (const item of akItems) {
      itemData[item.id] = { placements: [] };
    }

    const studentResults: MapObserveData['students'] = [];

    for (const student of ctx.students) {
      const subs = ctx.subsByStudent.get(student.id) || {};
      const sub = subs[ctx.stepIdx];
      if (!sub) continue;

      submitted++;
      const data = sub.dataJson || {};
      const placements = data.placements || {};
      const reasons = data.reasons || {};
      const score = sub.scoreJson;
      const llmFeedback = score?.llmFeedback || null;
      const llmItemComments: Record<string, { relevant: boolean; comment: string }> = {};
      if (score?.llmItems) {
        for (const li of score.llmItems) {
          if (li.id) llmItemComments[li.id] = { relevant: Boolean(li.relevant), comment: li.reason || '' };
        }
      }

      let totalDev = 0;
      let devCount = 0;
      let placed = 0;
      let hasReason = false;

      for (const item of akItems) {
        const pos = placements[item.id];
        if (!pos) continue;
        placed++;
        const exp = expected[item.id];
        if (exp) {
          const dev = Math.sqrt(Math.pow(pos[0] - exp[0], 2) + Math.pow(pos[1] - exp[1], 2));
          totalDev += dev;
          devCount++;
          itemData[item.id]?.placements.push({
            studentId: student.id,
            studentName: student.name,
            x: pos[0],
            y: pos[1],
            deviation: dev,
          });
        }
        if (reasons[item.id] && reasons[item.id].trim().length > 0) hasReason = true;
      }

      if (hasReason) reasonedCount++;
      const avgDev = devCount > 0 ? totalDev / devCount : 0;
      totalDeviation += avgDev;
      if (devCount > 0) deviationCount++;

      const insights: string[] = [];
      if (avgDev > 2) insights.push('偏差较大');
      if (!hasReason) insights.push('未写 reasoning');

      studentResults.push({
        id: student.id,
        name: student.name,
        placed,
        reasoned: hasReason,
        time: 0,
        submitted: true,
        placements,
        reasons,
        avgDeviation: avgDev,
        keyInsights: insights,
        llmFeedback,
        ...(Object.keys(llmItemComments).length > 0 && { llmItemComments }),
      });
    }

    const items: MapObserveData['items'] = akItems.map(item => ({
      id: item.id,
      label: item.label,
      expected: (expected[item.id] || [0, 0]) as [number, number],
      studentPlacements: itemData[item.id]?.placements || [],
    }));

    return {
      stats: {
        totalStudents,
        submitted,
        avgDeviation: deviationCount > 0 ? totalDeviation / deviationCount : 0,
        reasonedCount,
      },
      axes,
      items,
      misconceptions: [],
      students: studentResults,
    };
  }
}
