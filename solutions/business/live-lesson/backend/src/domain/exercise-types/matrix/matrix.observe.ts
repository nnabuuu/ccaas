import { Injectable } from '@nestjs/common';
import { ObserveType } from '../../shared/observe-handler.interface';
import type { ObserveHandler, ObserveContext } from '../../shared/observe-handler.interface';
import type { MatrixObserveData } from '../../../schemas/classroom/observe-data';
import type { MatrixAnswerKey } from '../../../schemas/answer-key.schema';
import { textQuality } from './matrix.grader';

type MatrixRow = MatrixAnswerKey['answers'][number];

interface Aggregates {
  submitted: number;
  totalCompletion: number;
  totalQuality: number;
  totalWhatQ: number;
  totalWhyQ: number;
  qualityCount: number;
  totalStudents: number;
}

type RowTracker = Record<string, { whatScores: number[]; whyScores: number[] }>;

@Injectable()
@ObserveType('matrix')
export class MatrixObserveHandler implements ObserveHandler {
  compute(ctx: ObserveContext): MatrixObserveData {
    if (ctx.answerKey && ctx.answerKey.type !== 'matrix') {
      throw new Error(`MatrixObserveHandler expects matrix answerKey, got ${ctx.answerKey.type}`);
    }
    const key = ctx.answerKey as MatrixAnswerKey | null;
    const allRows = key?.answers || [];
    const practiceRows = allRows.filter(r => !r.isDemo);

    const { studentResults, aggregates, rowTracker } = this.buildStudentResults(ctx, practiceRows);
    const rows = this.buildRowStats(practiceRows, rowTracker);
    const patterns = this.detectPatterns(studentResults, rows, practiceRows, aggregates);

    const needAttention = studentResults.filter(s => s.avgQuality < 1.5).length;

    return {
      stats: {
        totalStudents: aggregates.totalStudents,
        submitted: aggregates.submitted,
        avgCompletion: aggregates.submitted > 0 ? Math.round(aggregates.totalCompletion / aggregates.submitted) : 0,
        avgQuality: aggregates.qualityCount > 0 ? Math.round(aggregates.totalQuality / aggregates.qualityCount * 100) / 100 : 0,
        whatAvg: aggregates.qualityCount > 0 ? Math.round(aggregates.totalWhatQ / aggregates.qualityCount * 100) / 100 : 0,
        whyAvg: aggregates.qualityCount > 0 ? Math.round(aggregates.totalWhyQ / aggregates.qualityCount * 100) / 100 : 0,
        needAttention,
      },
      rows,
      patterns,
      students: studentResults,
    };
  }

  private buildStudentResults(
    ctx: ObserveContext,
    practiceRows: MatrixRow[],
  ): { studentResults: MatrixObserveData['students']; aggregates: Aggregates; rowTracker: RowTracker } {
    const totalStudents = ctx.students.length;

    let submitted = 0;
    let totalCompletion = 0;
    let totalQuality = 0;
    let totalWhatQ = 0;
    let totalWhyQ = 0;
    let qualityCount = 0;

    const rowTracker: RowTracker = {};
    for (const r of practiceRows) {
      rowTracker[String(r.rowIdx)] = { whatScores: [], whyScores: [] };
    }

    const studentResults: MatrixObserveData['students'] = [];

    for (const student of ctx.students) {
      const subs = ctx.subsByStudent.get(student.id) || {};
      const sub = subs[ctx.stepIdx];
      if (!sub) continue;

      submitted++;
      const data = sub.dataJson || {};
      const studentRowData = (data.rows || []) as Array<Record<string, string>>;
      const scoreJson = sub.scoreJson || {};
      const cellQualities: Record<string, { whatQ: number; whyQ: number }> = scoreJson.cellQualities || {};

      let filled = 0;
      let totalCells = 0;
      let studentWhatSum = 0;
      let studentWhySum = 0;
      let studentQCount = 0;
      const responses: Record<string, { what: string; why: string; whatQ: number; whyQ: number }> = {};

      for (const row of practiceRows) {
        const rid = String(row.rowIdx);
        const sRow = studentRowData[row.rowIdx] || {};
        const what = sRow.practice || sRow.what || '';
        const why = sRow.reason || sRow.why || '';
        const hasWhat = what.trim().length > 0;
        const hasWhy = why.trim().length > 0;

        let whatQ: number, whyQ: number;
        if (cellQualities[rid]) {
          whatQ = cellQualities[rid].whatQ;
          whyQ = cellQualities[rid].whyQ;
        } else {
          whatQ = textQuality(what);
          whyQ = textQuality(why);
        }

        if (hasWhat) filled++;
        if (hasWhy) filled++;
        totalCells += 2;

        responses[rid] = { what, why, whatQ, whyQ };

        if (hasWhat || hasWhy) {
          rowTracker[rid]?.whatScores.push(whatQ);
          rowTracker[rid]?.whyScores.push(whyQ);
          studentWhatSum += whatQ;
          studentWhySum += whyQ;
          studentQCount++;
        }
      }

      const completion = { filled, total: totalCells, pct: totalCells > 0 ? Math.round((filled / totalCells) * 100) : 0 };
      const avgQ = studentQCount > 0 ? (studentWhatSum + studentWhySum) / (studentQCount * 2) : 0;

      totalCompletion += completion.pct;
      if (studentQCount > 0) {
        totalQuality += avgQ;
        totalWhatQ += studentWhatSum / studentQCount;
        totalWhyQ += studentWhySum / studentQCount;
        qualityCount++;
      }

      const insights: string[] = [];
      if (completion.pct < 50) insights.push('完成度低于50%');
      if (avgQ < 1.5 && studentQCount > 0) insights.push('整体质量偏低');
      if (studentQCount > 0 && studentWhatSum / studentQCount - studentWhySum / studentQCount > 0.8) {
        insights.push('What 远强于 Why');
      }

      studentResults.push({
        id: student.id,
        name: student.name,
        time: 0,
        submitted: true,
        completion,
        avgQuality: avgQ,
        responses,
        keyInsights: insights,
      });
    }

    return {
      studentResults,
      aggregates: { submitted, totalCompletion, totalQuality, totalWhatQ, totalWhyQ, qualityCount, totalStudents },
      rowTracker,
    };
  }

  private buildRowStats(
    practiceRows: MatrixRow[],
    rowTracker: RowTracker,
  ): MatrixObserveData['rows'] {
    return practiceRows.map(r => {
      const rid = String(r.rowIdx);
      const tracker = rowTracker[rid] || { whatScores: [], whyScores: [] };
      const whatAvg = tracker.whatScores.length > 0 ? tracker.whatScores.reduce((a, b) => a + b, 0) / tracker.whatScores.length : 0;
      const whyAvg = tracker.whyScores.length > 0 ? tracker.whyScores.reduce((a, b) => a + b, 0) / tracker.whyScores.length : 0;

      const whatDist: [number, number, number, number] = [0, 0, 0, 0];
      const whyDist: [number, number, number, number] = [0, 0, 0, 0];
      for (const s of tracker.whatScores) { const idx = Math.max(0, Math.min(3, 3 - Math.round(s))); whatDist[idx]++; }
      for (const s of tracker.whyScores) { const idx = Math.max(0, Math.min(3, 3 - Math.round(s))); whyDist[idx]++; }

      return {
        id: rid,
        concept: r.whatPrompt || r.place,
        paraRef: r.paraRef?.join(', '),
        whatAvg: Math.round(whatAvg * 100) / 100,
        whyAvg: Math.round(whyAvg * 100) / 100,
        whatDist,
        whyDist,
      };
    });
  }

  private detectPatterns(
    studentResults: MatrixObserveData['students'],
    rows: MatrixObserveData['rows'],
    practiceRows: MatrixRow[],
    aggregates: Aggregates,
  ): MatrixObserveData['patterns'] {
    const patterns: MatrixObserveData['patterns'] = [];
    const globalWhatAvg = aggregates.qualityCount > 0 ? aggregates.totalWhatQ / aggregates.qualityCount : 0;
    const globalWhyAvg = aggregates.qualityCount > 0 ? aggregates.totalWhyQ / aggregates.qualityCount : 0;

    const whyEmptyStudents = studentResults.filter(s => {
      const vals = Object.values(s.responses);
      if (vals.length === 0) return false;
      const emptyCount = vals.filter(v => v.whyQ === 0).length;
      return emptyCount / vals.length >= 0.3;
    });
    if (whyEmptyStudents.length >= 2) {
      patterns.push({
        id: 'why_blank',
        label: 'Why 列大量空白',
        count: whyEmptyStudents.length,
        severity: whyEmptyStudents.length >= 5 ? 'high' : 'medium',
        students: whyEmptyStudents.map(s => ({ id: s.id, name: s.name })),
      });
    }

    if (globalWhatAvg - globalWhyAvg > 0.8) {
      const affectedStudents = studentResults.filter(s => {
        const vals = Object.values(s.responses);
        if (vals.length === 0) return false;
        const wAvg = vals.reduce((a, v) => a + v.whatQ, 0) / vals.length;
        const yAvg = vals.reduce((a, v) => a + v.whyQ, 0) / vals.length;
        return wAvg - yAvg > 0.5;
      });
      if (affectedStudents.length >= 2) {
        patterns.push({
          id: 'what_stronger',
          label: 'What 远强于 Why',
          count: affectedStudents.length,
          severity: 'medium',
          students: affectedStudents.map(s => ({ id: s.id, name: s.name })),
        });
      }
    }

    if (practiceRows.length >= 4) {
      const half = Math.floor(practiceRows.length / 2);
      const firstHalfRows = rows.slice(0, half);
      const secondHalfRows = rows.slice(half);
      const firstAvg = firstHalfRows.reduce((a, r) => a + (r.whatAvg + r.whyAvg) / 2, 0) / firstHalfRows.length;
      const secondAvg = secondHalfRows.reduce((a, r) => a + (r.whatAvg + r.whyAvg) / 2, 0) / secondHalfRows.length;
      if (firstAvg - secondAvg > 0.5) {
        const dropStudents = studentResults.filter(s => {
          const fIds = firstHalfRows.map(r => r.id);
          const sIds = secondHalfRows.map(r => r.id);
          const fVals = fIds.map(id => { const rp = s.responses[id]; return rp ? (rp.whatQ + rp.whyQ) / 2 : 0; });
          const sVals = sIds.map(id => { const rp = s.responses[id]; return rp ? (rp.whatQ + rp.whyQ) / 2 : 0; });
          const fAvg = fVals.length > 0 ? fVals.reduce((a, b) => a + b, 0) / fVals.length : 0;
          const sAvg = sVals.length > 0 ? sVals.reduce((a, b) => a + b, 0) / sVals.length : 0;
          return fAvg - sAvg > 0.3;
        });
        if (dropStudents.length >= 2) {
          patterns.push({
            id: 'quality_drop',
            label: '后半行质量下降',
            count: dropStudents.length,
            severity: 'low',
            students: dropStudents.map(s => ({ id: s.id, name: s.name })),
          });
        }
      }
    }

    return patterns;
  }
}
