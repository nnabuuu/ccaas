import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../entities/student.entity';
import { Submission } from '../entities/submission.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { Lesson } from '../entities/lesson.entity';
import { buildTaskMap } from './task-map.utils';
import type {
  McObserveData,
  EvidenceObserveData,
  MapObserveData,
  DiscussObserveData,
} from './observe.types';

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
    const submissions = await this.submissionRepo.find({ where: { sessionId } });
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
      const score = sub.scoreJson?.total ?? 0;
      totalScore += score;
      if (score === 100) perfectCount++;
      if (score === 0) zeroCount++;

      const data = sub.dataJson || {};
      const studentAnswers = data.answers || [];
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

      if (studentTime > 0) { totalTime += studentTime; timeCount++; }

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
        const ss = studentSections[sec.id];
        if (!ss) { isComplete = false; isPerfect = false; continue; }

        const funcCorrect = ss.function === sec.correctFunction;
        if (!funcCorrect) { isPerfect = false; funcWrongStudents.add(student.id); }

        // Count evidence hits
        const expectedTokens = (paragraphTokens[sec.id] || []).filter(t => t.kind === 'key');
        const pickedSet = new Set(ss.picked || []);
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
          attempts: ss.attempts || 1,
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
      const studentMsgs = msgs.filter(m => m.role === 'user');
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
        role: (m.role === 'user' ? 'student' : 'ai') as 'ai' | 'student',
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
