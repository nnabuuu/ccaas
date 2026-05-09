import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../entities/student.entity';
import { Submission } from '../entities/submission.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { Lesson } from '../entities/lesson.entity';
import { buildTaskMap } from './task-map.utils';
import { textQuality } from './exercise/graders/matrix.grader';
import type {
  McObserveData,
  EvidenceObserveData,
  MapObserveData,
  MatrixObserveData,
  DiscussObserveData,
} from '../schemas/classroom/observe-data';

@Injectable()
export class ObserveService {
  private readonly logger = new Logger(ObserveService.name);

  constructor(
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Submission)
    private readonly submissionRepo: Repository<Submission>,
    @InjectRepository(ChatMessage)
    private readonly chatMessageRepo: Repository<ChatMessage>,
  ) {}

  /** Load common data for observe computation */
  async loadObserveData(sessionId: string): Promise<{
    students: Student[];
    submissions: Submission[];
    subsByStudent: Map<string, Record<number, Submission>>;
  }> {
    const students = await this.studentRepo.find({ where: { sessionId }, order: { joinedAt: 'ASC' } });
    const submissions = await this.submissionRepo.find({ where: { sessionId, phase: 'exercise' } });
    const subsByStudent = new Map<string, Record<number, Submission>>();
    for (const sub of submissions) {
      if (!subsByStudent.has(sub.studentId)) subsByStudent.set(sub.studentId, {});
      subsByStudent.get(sub.studentId)![sub.step] = sub;
    }
    return { students, submissions, subsByStudent };
  }

  // ── MC Observe ──

  computeMcObserve(
    students: Student[],
    subsByStudent: Map<string, Record<number, Submission>>,
    stepIdx: number,
    answerKey: Record<string, unknown> | null,
    view: 'first' | 'latest' = 'latest',
  ): McObserveData {
    type AnsEntry = { correct: number; options?: string[]; text?: string; questionText?: string; tag?: string; dimension?: string };
    const answers: AnsEntry[] = (answerKey?.answers as AnsEntry[]) || [];
    const totalStudents = students.length;

    // Gather all submissions for this step
    const studentResults: McObserveData['students'] = [];
    let submitted = 0;
    let totalScore = 0;
    let perfectCount = 0;
    let zeroCount = 0;
    let totalTime = 0;
    let timeCount = 0;
    let minTime = Infinity;
    let maxTime = 0;

    // Per-question tracking
    const qDistributions: Array<Array<{ count: number; students: Array<{ id: string; name: string }> }>> = [];
    for (let qi = 0; qi < answers.length; qi++) {
      const optCount = answers[qi].options?.length || 4;
      qDistributions.push(Array.from({ length: optCount }, () => ({ count: 0, students: [] })));
    }

    for (const student of students) {
      const subs = subsByStudent.get(student.id) || {};
      const sub = subs[stepIdx];
      if (!sub) continue;

      submitted++;
      const rawScore = sub.scoreJson?.total ?? 0;

      const data = sub.dataJson || {};
      const studentAnswers = (view === 'first' && data.firstAttemptAnswers)
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

      // Recompute score from selected answers when viewing first attempts
      const computedCorrect = Object.values(perQAnswers).filter(a => a.correct).length;
      const score = (view === 'first' && data.firstAttemptAnswers)
        ? (answers.length > 0 ? Math.round((computedCorrect / answers.length) * 100) : 0)
        : rawScore;
      totalScore += score;
      if (score === 100) perfectCount++;
      if (score === 0) zeroCount++;

      // Generate key insights
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

    // Build question data
    const questions: McObserveData['questions'] = answers.map((a, qi) => {
      const dist = qDistributions[qi] || [];
      const totalForQ = dist.reduce((s, d) => s + d.count, 0);
      const correctCount = dist[a.correct]?.count || 0;
      return {
        idx: qi,
        stem: a.text || a.questionText || '',
        tag: a.tag || a.dimension || undefined,
        options: a.options || [],
        correctIdx: a.correct,
        distribution: dist.map(d => ({
          count: d.count,
          pct: totalForQ > 0 ? (d.count / totalForQ) * 100 : 0,
        })),
        correctRate: totalForQ > 0 ? (correctCount / totalForQ) * 100 : 0,
      };
    });

    // Misconception detection: same wrong option chosen by >= 3 students
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

    return {
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
      questions,
      misconceptions,
      students: studentResults,
    };
  }

  // ── Evidence Observe ──

  computeEvidenceObserve(
    students: Student[],
    subsByStudent: Map<string, Record<number, Submission>>,
    stepIdx: number,
    answerKey: Record<string, unknown> | null,
    view: 'first' | 'latest' = 'latest',
  ): EvidenceObserveData {
    type AkSection = { id: string; label?: string; correctFunction: string; range?: string; hint?: string };
    type Token = { t?: string; kind?: string; paraId?: string; idx?: number };
    const akSections: AkSection[] = (answerKey?.sections as AkSection[]) || [];
    const paragraphTokens: Record<string, Token[]> = (answerKey?.paragraphTokens as Record<string, Token[]>) || {};
    const totalStudents = students.length;

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

    for (const student of students) {
      const subs = subsByStudent.get(student.id) || {};
      const sub = subs[stepIdx];
      if (!sub) continue;

      const data = sub.dataJson || {};
      const studentSections = data.sections || {};
      let isComplete = true;
      let isPerfect = true;
      const insights: string[] = [];
      type PerSectionEntry = { func: string; funcCorrect: boolean; attempts: number; evidenceHit: number; evidenceTotal: number; wrongPicks: string[]; perfect: boolean; missed?: string[] };
      const perSection: Record<string, PerSectionEntry> = {};

      for (const sec of akSections) {
        const latestSs = studentSections[sec.id];
        const firstSs = (view === 'first' && data.firstAttemptSections)
          ? data.firstAttemptSections[sec.id]
          : null;
        const ss = firstSs || latestSs;
        if (!ss) { isComplete = false; isPerfect = false; continue; }

        const funcCorrect = ss.function === sec.correctFunction;
        if (!funcCorrect) { isPerfect = false; funcWrongStudents.add(student.id); }

        // Count evidence hits
        const expectedTokens = (paragraphTokens[sec.id] || []).filter(t => t.kind === 'key');
        const pickedSet = new Set<string>(ss.picked || []);
        let evidenceHit = 0;
        const missed: string[] = [];
        for (const token of expectedTokens) {
          const tokenId = `${token.paraId || sec.id}:${token.idx ?? expectedTokens.indexOf(token)}`;
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

  // ── Map Observe ──

  computeMapObserve(
    students: Student[],
    subsByStudent: Map<string, Record<number, Submission>>,
    stepIdx: number,
    answerKey: Record<string, unknown> | null,
  ): MapObserveData {
    type AkItem = { id: string; label?: string };
    const akItems: AkItem[] = (answerKey?.items as AkItem[]) || [];
    const expected: Record<string, [number, number]> = (answerKey?.expected as Record<string, [number, number]>) || {};
    const defaultAxis = { neg: '', pos: '', label: '' };
    const axes = (answerKey?.axes as MapObserveData['axes']) || { x: { ...defaultAxis }, y: { ...defaultAxis } };
    const totalStudents = students.length;

    let submitted = 0;
    let totalDeviation = 0;
    let deviationCount = 0;
    let reasonedCount = 0;

    const itemData: Record<string, { placements: Array<{ studentId: string; studentName: string; x: number; y: number; deviation: number }> }> = {};
    for (const item of akItems) {
      itemData[item.id] = { placements: [] };
    }

    const studentResults: MapObserveData['students'] = [];

    for (const student of students) {
      const subs = subsByStudent.get(student.id) || {};
      const sub = subs[stepIdx];
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
      expected: expected[item.id] || [0, 0],
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

  // ── Matrix Observe ──

  computeMatrixObserve(
    students: Student[],
    subsByStudent: Map<string, Record<number, Submission>>,
    stepIdx: number,
    answerKey: Record<string, unknown> | null,
  ): MatrixObserveData {
    type AkRow = { rowIdx: number; place: string; isDemo?: boolean; practice?: string; reason?: string; paraRef?: number[]; whatPrompt?: string };
    const allRows: AkRow[] = (answerKey?.answers as AkRow[]) || [];
    const practiceRows = allRows.filter(r => !r.isDemo);
    const totalStudents = students.length;

    let submitted = 0;
    let totalCompletion = 0;
    let totalQuality = 0;
    let totalWhatQ = 0;
    let totalWhyQ = 0;
    let qualityCount = 0;

    // Per-row tracking: rowIdx → { whatScores, whyScores }
    const rowTracker: Record<string, { whatScores: number[]; whyScores: number[] }> = {};
    for (const r of practiceRows) {
      rowTracker[String(r.rowIdx)] = { whatScores: [], whyScores: [] };
    }

    const studentResults: MatrixObserveData['students'] = [];

    for (const student of students) {
      const subs = subsByStudent.get(student.id) || {};
      const sub = subs[stepIdx];
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

        // Quality from cellQualities (LLM) or text-length heuristic
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

        // Track per-row stats (only for students who attempted this row)
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
        submitted: true, // All submission records are final (no draft state)
        completion,
        avgQuality: avgQ,
        responses,
        keyInsights: insights,
      });
    }

    // Build per-row stats
    const rows: MatrixObserveData['rows'] = practiceRows.map(r => {
      const rid = String(r.rowIdx);
      const tracker = rowTracker[rid] || { whatScores: [], whyScores: [] };
      const whatAvg = tracker.whatScores.length > 0 ? tracker.whatScores.reduce((a, b) => a + b, 0) / tracker.whatScores.length : 0;
      const whyAvg = tracker.whyScores.length > 0 ? tracker.whyScores.reduce((a, b) => a + b, 0) / tracker.whyScores.length : 0;

      const whatDist: [number, number, number, number] = [0, 0, 0, 0]; // [优秀,良好,基本,未填]
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

    // Pattern detection
    const patterns: MatrixObserveData['patterns'] = [];
    const globalWhatAvg = qualityCount > 0 ? totalWhatQ / qualityCount : 0;
    const globalWhyAvg = qualityCount > 0 ? totalWhyQ / qualityCount : 0;

    // Pattern: Why 列空白 >= 30%
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

    // Pattern: What far stronger than Why
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

    // Pattern: quality drops in later rows (per-student)
    if (practiceRows.length >= 4) {
      const half = Math.floor(practiceRows.length / 2);
      const firstHalfRows = rows.slice(0, half);
      const secondHalfRows = rows.slice(half);
      const firstAvg = firstHalfRows.reduce((a, r) => a + (r.whatAvg + r.whyAvg) / 2, 0) / firstHalfRows.length;
      const secondAvg = secondHalfRows.reduce((a, r) => a + (r.whatAvg + r.whyAvg) / 2, 0) / secondHalfRows.length;
      if (firstAvg - secondAvg > 0.5) {
        // Only list students who individually show the drop
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

    const needAttention = studentResults.filter(s => s.avgQuality < 1.5).length;

    return {
      stats: {
        totalStudents,
        submitted,
        avgCompletion: submitted > 0 ? Math.round(totalCompletion / submitted) : 0,
        avgQuality: qualityCount > 0 ? Math.round(totalQuality / qualityCount * 100) / 100 : 0,
        whatAvg: qualityCount > 0 ? Math.round(globalWhatAvg * 100) / 100 : 0,
        whyAvg: qualityCount > 0 ? Math.round(globalWhyAvg * 100) / 100 : 0,
        needAttention,
      },
      rows,
      patterns,
      students: studentResults,
    };
  }

  // ── Discuss Observe ──

  async computeDiscussObserve(
    sessionId: string,
    students: Student[],
    stepIdx: number,
  ): Promise<DiscussObserveData> {
    const totalStudents = students.length;

    // Load chat messages for discuss threads of this step
    const threadId = `discuss:${stepIdx}`;
    const messages = await this.chatMessageRepo.find({
      where: { sessionId, threadId },
      order: { seq: 'ASC' },
    });

    // Group messages by student
    const msgsByStudent = new Map<string, typeof messages>();
    for (const m of messages) {
      if (!msgsByStudent.has(m.studentId)) msgsByStudent.set(m.studentId, []);
      msgsByStudent.get(m.studentId)!.push(m);
    }

    let discussedCount = 0;
    let goalReachedCount = 0;
    let totalRounds = 0;
    let totalTime = 0;
    let timeCount = 0;

    const studentResults: DiscussObserveData['students'] = [];

    for (const student of students) {
      const msgs = msgsByStudent.get(student.id);
      if (!msgs || msgs.length === 0) continue;

      discussedCount++;
      // persistThread saves role='student'; accept 'user' defensively for legacy data
      const studentMsgs = msgs.filter(m => m.role === 'student' || m.role === 'user');
      const rounds = studentMsgs.length;
      totalRounds += rounds;

      // Determine completion from last system message or metadata
      const lastMsg = msgs[msgs.length - 1];
      let goalReached = false;
      let completionType: DiscussObserveData['students'][0]['completionType'] = '';
      // All current discuss threads use the socratic endpoint — hardcoded value is intentionally correct
      let method: 'socratic' | 'fallback' = 'socratic';

      // Check if there's a discuss_complete marker in content
      if (lastMsg.content?.includes('goal_reached')) {
        goalReached = true;
        completionType = 'goal_reached';
      } else if (lastMsg.content?.includes('fallback')) {
        completionType = 'fallback_rounds';
      }

      if (goalReached) goalReachedCount++;

      // Calculate time span
      const first = msgs[0].createdAt instanceof Date ? msgs[0].createdAt.getTime() : new Date(msgs[0].createdAt).getTime();
      const last = lastMsg.createdAt instanceof Date ? lastMsg.createdAt.getTime() : new Date(lastMsg.createdAt).getTime();
      const timeUsed = (last - first) / 1000;
      if (timeUsed > 0) { totalTime += timeUsed; timeCount++; }

      const conversation = msgs.map(m => ({
        role: (m.role === 'student' || m.role === 'user' ? 'student' : 'ai') as 'ai' | 'student',
        text: m.content,
      }));

      const insights: string[] = [];
      if (goalReached) insights.push('达成讨论目标');
      if (rounds <= 2) insights.push('对话轮次较少');

      studentResults.push({
        id: student.id,
        name: student.name,
        method,
        goalReached,
        roundsUsed: rounds,
        timeUsedSeconds: timeUsed,
        completionType,
        conversation,
        keyInsights: insights,
      });
    }

    return {
      stats: {
        totalStudents,
        discussedCount,
        goalReachedCount,
        avgRounds: discussedCount > 0 ? totalRounds / discussedCount : 0,
        avgTime: timeCount > 0 ? totalTime / timeCount : 0,
      },
      students: studentResults,
    };
  }
}
