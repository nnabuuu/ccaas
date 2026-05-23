import { Injectable } from '@nestjs/common';
import { ObserveType } from '../../shared/observe-handler.interface';
import type { ObserveHandler, ObserveContext } from '../../shared/observe-handler.interface';
import type { EvidenceObserveData } from '../../../schemas/classroom/observe-data';
import type { SelectEvidenceAnswerKey } from '../../../schemas/answer-key.schema';

@Injectable()
@ObserveType('evidence')
export class SelectEvidenceObserveHandler implements ObserveHandler {
  compute(ctx: ObserveContext): EvidenceObserveData {
    if (ctx.answerKey && ctx.answerKey.type !== 'select-evidence') {
      throw new Error(`SelectEvidenceObserveHandler expects select-evidence answerKey, got ${ctx.answerKey.type}`);
    }
    const key = ctx.answerKey as SelectEvidenceAnswerKey | null;
    const akSections = key?.sections || [];
    const paragraphTokens = key?.paragraphTokens || {};
    const totalStudents = ctx.students.length;

    let allDone = 0;
    let perfectAll = 0;
    let totalEvidenceHit = 0;
    let totalEvidenceCount = 0;
    const funcWrongStudents = new Set<string>();

    const sectionStats: Record<string, { funcCorrect: number; evidenceHit: number; evidenceTotal: number; perfect: number; total: number }> = {};
    for (const sec of akSections) {
      sectionStats[sec.id] = { funcCorrect: 0, evidenceHit: 0, evidenceTotal: 0, perfect: 0, total: 0 };
    }

    const studentResults: EvidenceObserveData['students'] = [];

    for (const student of ctx.students) {
      const subs = ctx.subsByStudent.get(student.id) || {};
      const sub = subs[ctx.stepIdx];
      if (!sub) continue;

      const data = sub.dataJson || {};
      const studentSections = data.sections || {};
      let isComplete = true;
      let isPerfect = true;
      const insights: string[] = [];
      type PerSectionEntry = {
        func: string; funcCorrect: boolean; attempts: number;
        evidenceHit: number; evidenceTotal: number; wrongPicks: string[];
        perfect: boolean; missed?: string[];
      };
      const perSection: Record<string, PerSectionEntry> = {};

      for (const sec of akSections) {
        const latestSs = studentSections[sec.id];
        const firstSs = (ctx.view === 'first' && data.firstAttemptSections)
          ? data.firstAttemptSections[sec.id]
          : null;
        const ss = firstSs || latestSs;
        if (!ss) { isComplete = false; isPerfect = false; continue; }

        const funcCorrect = ss.function === sec.correctFunction;
        if (!funcCorrect) { isPerfect = false; funcWrongStudents.add(student.id); }

        const expectedTokens = (paragraphTokens[sec.id] || []).filter(t => t.kind === 'key');
        const pickedSet = new Set<string>(ss.picked || []);
        let evidenceHit = 0;
        const missed: string[] = [];
        for (const token of expectedTokens) {
          const rt = token as typeof token & { paraId?: string; idx?: number };
          const tokenId = `${rt.paraId || sec.id}:${rt.idx ?? expectedTokens.indexOf(token)}`;
          if (pickedSet.has(tokenId)) {
            evidenceHit++;
          } else {
            missed.push(token.t?.substring(0, 20) || tokenId);
          }
        }
        const evidenceTotal = expectedTokens.length;
        totalEvidenceHit += evidenceHit;
        totalEvidenceCount += evidenceTotal;
        if (evidenceHit < evidenceTotal) isPerfect = false;

        sectionStats[sec.id].total++;
        if (funcCorrect) sectionStats[sec.id].funcCorrect++;
        sectionStats[sec.id].evidenceHit += evidenceHit;
        sectionStats[sec.id].evidenceTotal += evidenceTotal;

        perSection[sec.id] = {
          func: ss.function,
          funcCorrect,
          attempts: ss.funcAttempts || ss.attempts || 1,
          evidenceHit,
          evidenceTotal,
          wrongPicks: [],
          perfect: funcCorrect && evidenceHit === evidenceTotal,
          missed: missed.length > 0 ? missed : undefined,
        };

        if (funcCorrect && evidenceHit === evidenceTotal) sectionStats[sec.id].perfect++;
      }

      if (isComplete) allDone++;
      if (isPerfect) perfectAll++;

      if (!isComplete) insights.push('部分 section 未完成');
      const wrongFuncs = Object.entries(perSection).filter(([, v]) => !v.funcCorrect);
      if (wrongFuncs.length > 0) insights.push(`${wrongFuncs.length} 个功能判断错误`);

      studentResults.push({
        id: student.id,
        name: student.name,
        time: 0,
        completed: isComplete,
        sections: perSection,
        keyInsights: insights,
      });
    }

    const sections: EvidenceObserveData['sections'] = akSections.map(sec => {
      const st = sectionStats[sec.id] || { funcCorrect: 0, evidenceHit: 0, evidenceTotal: 0, perfect: 0, total: 0 };
      return {
        id: sec.id,
        label: sec.label || sec.id,
        func: sec.correctFunction,
        funcZh: sec.correctFunction,
        funcCorrectRate: st.total > 0 ? (st.funcCorrect / st.total) * 100 : 0,
        evidenceHitRate: st.evidenceTotal > 0 ? (st.evidenceHit / st.evidenceTotal) * 100 : 0,
        perfectCount: st.perfect,
        evidenceBar: { hit: st.evidenceHit, total: st.evidenceTotal, pct: st.evidenceTotal > 0 ? (st.evidenceHit / st.evidenceTotal) * 100 : 0 },
      };
    });

    return {
      stats: {
        totalStudents,
        allDone,
        perfectAll,
        evidenceHitRate: totalEvidenceCount > 0 ? (totalEvidenceHit / totalEvidenceCount) * 100 : 0,
        funcWrongCount: funcWrongStudents.size,
      },
      sections,
      misconceptions: [],
      students: studentResults,
    };
  }
}
