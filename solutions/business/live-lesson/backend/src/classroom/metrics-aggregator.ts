import { Injectable } from '@nestjs/common';
import { Student } from '../entities/student.entity';
import { AiQuestion } from '../entities/ai-question.entity';
import type { TaskMap, ResolvedObserve, ObserveSurface } from '../schemas';
import type { StepMetrics, HealthCards } from '../schemas/classroom';

export type { TaskMap };

/**
 * Computes per-step metrics for the teacher dashboard.
 * Pure computation — no repository access.
 */
@Injectable()
export class MetricsAggregator {

  /** Build enriched stepMetrics with byDimension, timing, AI stats, issues, questionAggregates */
  buildStepMetrics(
    total: number,
    students: Student[],
    subsByStudent: Map<string, Record<number, { step: number; data: any; score: any; submittedAt: string }>>,
    questions: AiQuestion[],
    studentDurations: Map<string, Record<number, number>>,
    manifest: any,
    taskMap: TaskMap,
    resolvedObserves?: Record<number, ResolvedObserve>,
  ): Record<number, StepMetrics> {
    const stepMetrics: Record<number, StepMetrics> = {};
    const readingSteps: any[] = manifest?.readingSteps || [];

    for (let taskNum = 1; taskNum <= taskMap.maxTask; taskNum++) {
      const stepIdx = taskMap.taskToStep[taskNum];
      let completedCount = 0;
      let currentCount = 0;
      let totalScore = 0;
      const durations: number[] = [];
      const dimensionAgg: Record<string, { good: number; partial: number; wrong: number; total: number }> = {};
      const attemptAgg: Record<string, { sum: number; count: number; wtCount: number }> = {};

      for (const s of students) {
        const subs = subsByStudent.get(s.id);
        if (subs && subs[stepIdx]) {
          completedCount++;
          const score = subs[stepIdx].score;
          if (score && typeof score.total === 'number') {
            totalScore += score.total;
          }

          // Aggregate byDimension across students
          if (score?.byDimension) {
            for (const [dim, val] of Object.entries(score.byDimension)) {
              if (!dimensionAgg[dim]) {
                dimensionAgg[dim] = { good: 0, partial: 0, wrong: 0, total: 0 };
              }
              dimensionAgg[dim].total++;
              if (typeof val === 'boolean') {
                if (val) dimensionAgg[dim].good++;
                else dimensionAgg[dim].wrong++;
              } else if (typeof val === 'number') {
                if (val === 100) dimensionAgg[dim].good++;
                else if (val > 0) dimensionAgg[dim].partial++;
                else dimensionAgg[dim].wrong++;
              }
            }
          }

          // Aggregate attemptCounts across students
          if (score?.attemptCounts) {
            for (const [dim, count] of Object.entries(score.attemptCounts)) {
              if (!attemptAgg[dim]) attemptAgg[dim] = { sum: 0, count: 0, wtCount: 0 };
              attemptAgg[dim].sum += count as number;
              attemptAgg[dim].count++;
              if ((count as number) >= 2) attemptAgg[dim].wtCount++;
            }
          }

          // Collect durations
          const dur = studentDurations.get(s.id)?.[stepIdx];
          if (dur !== undefined && dur >= 0) {
            durations.push(dur);
          }
        } else if (s.currentTask === taskNum) {
          currentCount++;
        }
      }

      // G1: byDimension with human-readable keys
      const stepDef = readingSteps.find((s: any) => s.idx === stepIdx);
      const nameMap = resolvedObserves?.[taskNum]?.dimensionNameMap
        || this.getDimensionNameMap(stepDef?.answerKey);
      const byDimension: Record<string, { good: number; partial: number; wrong: number }> = {};
      for (const [dim, agg] of Object.entries(dimensionAgg)) {
        if (agg.total > 0) {
          const readableName = nameMap[dim] || dim;
          byDimension[readableName] = {
            good: Math.round((agg.good / agg.total) * 100),
            partial: Math.round((agg.partial / agg.total) * 100),
            wrong: Math.round((agg.wrong / agg.total) * 100),
          };
        }
      }

      // G1b: attemptMetrics with human-readable keys
      const attemptMetrics: Record<string, { avgAttempts: number; walkthroughRate: number }> = {};
      for (const [dim, agg] of Object.entries(attemptAgg)) {
        if (agg.count > 0) {
          const readableName = nameMap[dim] || dim;
          attemptMetrics[readableName] = {
            avgAttempts: Math.round((agg.sum / agg.count) * 10) / 10,
            walkthroughRate: Math.round((agg.wtCount / agg.count) * 100),
          };
        }
      }

      // quality.cols -- same data in array format for design prototype
      const qualityCols = Object.entries(byDimension).map(([name, vals]) => ({
        name,
        good: vals.good,
        partial: vals.partial,
        wrong: vals.wrong,
      }));

      // Calculate timing
      durations.sort((a, b) => a - b);
      const avgTime = durations.length > 0
        ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length)
        : null;
      const medianTime = durations.length > 0
        ? durations[Math.floor(durations.length / 2)]
        : null;

      // AI stats for this step
      const stepQuestions = questions.filter(q => q.step === stepIdx);
      const aiRounds = stepQuestions.length;
      const aiPeople = new Set(stepQuestions.map(q => q.studentId)).size;

      // G7: issues -- detect common wrong answers (rules-driven or legacy fallback)
      const observeRules = resolvedObserves?.[taskNum]?.issueRules;
      const issues = observeRules?.length
        ? this.detectIssuesByRules(observeRules, dimensionAgg, nameMap)
        : this.detectIssues(stepIdx, subsByStudent, stepDef?.answerKey);

      // G5: questionAggregates with isHigh >= 4
      const questionAggregates: Record<string, { count: number; isHigh: boolean }> = {};
      for (const q of stepQuestions) {
        const cat = q.category || '其他';
        if (!questionAggregates[cat]) questionAggregates[cat] = { count: 0, isHigh: false };
        questionAggregates[cat].count++;
        questionAggregates[cat].isHigh = questionAggregates[cat].count >= 4;
      }

      stepMetrics[taskNum] = {
        name: stepDef?.label || `Step ${taskNum}`,
        desc: this.getStepTypeDesc(stepDef?.answerKey),
        currentCount,
        completedCount,
        completionRate: total > 0 ? Math.round((completedCount / total) * 100) : 0,
        avgScore: completedCount > 0 ? Math.round(totalScore / completedCount) : 0,
        byDimension,
        quality: { cols: qualityCols },
        avgTime,
        medianTime,
        avgTimeFormatted: avgTime != null ? this.formatDuration(avgTime) : null,
        medianTimeFormatted: medianTime != null ? this.formatDuration(medianTime) : null,
        aiRounds,
        aiPeople,
        issues,
        questionAggregates,
        attemptMetrics,
        dimensionLabels: nameMap,
      };
    }

    return stepMetrics;
  }

  /** G2: Compute per-student per-step durations in seconds */
  computeStudentDurations(
    students: Student[],
    subsByStudent: Map<string, Record<number, { step: number; data: any; score: any; submittedAt: string }>>,
    taskMap: TaskMap,
  ): Map<string, Record<number, number>> {
    const result = new Map<string, Record<number, number>>();
    const taskSteps = taskMap.taskSteps;

    for (const s of students) {
      const subs = subsByStudent.get(s.id);
      if (!subs) continue;

      const durations: Record<number, number> = {};

      for (let i = 0; i < taskSteps.length; i++) {
        const stepIdx = taskSteps[i];
        const sub = subs[stepIdx];
        if (!sub) continue;

        const subTime = new Date(sub.submittedAt).getTime();

        if (i === 0) {
          // First task: submittedAt - joinedAt
          const joinTime = s.joinedAt instanceof Date
            ? s.joinedAt.getTime()
            : new Date(String(s.joinedAt)).getTime();
          const dur = Math.round((subTime - joinTime) / 1000);
          if (dur >= 0) durations[stepIdx] = dur;
        } else {
          // Subsequent tasks: submittedAt[N] - submittedAt[N-1]
          const prevStepIdx = taskSteps[i - 1];
          const prevSub = subs[prevStepIdx];
          if (prevSub) {
            const prevTime = new Date(prevSub.submittedAt).getTime();
            const dur = Math.round((subTime - prevTime) / 1000);
            if (dur >= 0) durations[stepIdx] = dur;
          }
        }
      }

      result.set(s.id, durations);
    }

    return result;
  }

  /** Extract median times per task from stepMetrics for stuck detection */
  extractMedianTimes(stepMetrics: Record<number, any>): Record<number, number | null> {
    const result: Record<number, number | null> = {};
    for (const taskNumStr of Object.keys(stepMetrics)) {
      const taskNum = Number(taskNumStr);
      result[taskNum] = stepMetrics[taskNum]?.medianTime ?? null;
    }
    return result;
  }

  /** G3: Compute student status (done/reading/stuck/prog) */
  computeStudentStatus(
    student: Student,
    subs: Record<number, any> | undefined,
    medianTimes: Record<number, number | null>,
    taskMap: TaskMap,
  ): string {
    // done: completed phase or submitted all task steps.
    if (student.currentPhase === 'completed') return 'done';
    if (subs) {
      const allDone = taskMap.taskSteps.every(step => subs[step]);
      if (allDone) return 'done';
    }

    // reading: listen phase
    if (student.currentPhase === 'listen') return 'reading';

    // stuck: on current step > median x 1.5 without submission
    if (student.stepStartedAt) {
      const median = medianTimes[student.currentTask];
      if (median && median > 0) {
        const elapsed = (Date.now() - new Date(student.stepStartedAt).getTime()) / 1000;
        if (elapsed > median * 1.5) return 'stuck';
      }
    }

    return 'prog';
  }

  /** G6: Compute health cards for teacher dashboard */
  computeHealthCards(
    students: Student[],
    studentStatuses: Map<string, string>,
    questions: AiQuestion[],
    maxTask: number,
  ): HealthCards {
    // Furthest: highest task any student has reached
    const studentTasks: number[] = [];
    for (const s of students) {
      const effectiveTask = s.currentPhase === 'completed' ? maxTask : s.currentTask;
      studentTasks.push(effectiveTask);
    }

    let furthestTask = 0;
    let furthestCount = 0;
    const taskCounts: Record<number, number> = {};
    for (const t of studentTasks) {
      taskCounts[t] = (taskCounts[t] || 0) + 1;
      if (t > furthestTask) furthestTask = t;
    }
    furthestCount = taskCounts[furthestTask] || 0;

    // Median: middle value of student tasks
    const sorted = [...studentTasks].sort((a, b) => a - b);
    const medianStep = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0;

    // Stuck: count + concentration
    let stuckCount = 0;
    const stuckByTask: Record<number, number> = {};
    for (const s of students) {
      if (studentStatuses.get(s.id) === 'stuck') {
        stuckCount++;
        stuckByTask[s.currentTask] = (stuckByTask[s.currentTask] || 0) + 1;
      }
    }

    let stuckLocation = '';
    if (stuckCount > 0) {
      const maxEntry = Object.entries(stuckByTask).reduce(
        (max, [task, count]) => (count > max[1] ? [task, count] : max),
        ['0', 0] as [string, number],
      );
      stuckLocation = `Step ${maxEntry[0]}`;
    }

    // AI totals
    const aiRounds = questions.length;
    const aiPeople = new Set(questions.map(q => q.studentId)).size;

    return {
      furthest: { step: furthestTask, count: furthestCount },
      median: { step: medianStep },
      stuck: { count: stuckCount, location: stuckLocation },
      aiTotal: { rounds: aiRounds, people: aiPeople },
    };
  }

  /** G4: Compute alertTag for a step card (priority: stuck > wrong_dimension > issue) */
  computeAlertTag(
    taskNum: number,
    metrics: Record<string, any>,
    students: Student[],
    studentStatuses: Map<string, string>,
  ): string | null {
    // Priority 1: stuck students at this step >= 5
    const stuckAtStep = students.filter(
      s => s.currentTask === taskNum && studentStatuses.get(s.id) === 'stuck',
    ).length;
    if (stuckAtStep >= 5) return `${stuckAtStep} 人卡住`;

    // Priority 2: any dimension with wrong >= 30%
    const byDim = metrics.byDimension || {};
    for (const [dimName, dim] of Object.entries(byDim) as [string, { wrong: number }][]) {
      if (dim.wrong >= 30) return `${dimName} 错误偏高`;
    }

    // Priority 2.5: any dimension walkthroughRate >= 50%
    const am = metrics.attemptMetrics || {};
    for (const [dimName, m] of Object.entries(am) as [string, { walkthroughRate: number }][]) {
      if (m.walkthroughRate >= 50) return `${dimName} 半数需提示`;
    }

    // Priority 3: any issue with count >= 5
    const issues: string[] = metrics.issues || [];
    for (const issue of issues) {
      const m = issue.match(/^(\d+) 人/);
      if (m && parseInt(m[1]) >= 5) return issue;
    }

    return null;
  }

  /** Derive result label from score: correct (100), partial (1-99), wrong (0) */
  deriveResult(score: any): string {
    if (!score || typeof score.total !== 'number') return 'partial';
    if (score.total === 100) return 'correct';
    if (score.total === 0) return 'wrong';
    return 'partial';
  }

  /** Format duration in seconds to m:ss string (e.g. 250 -> '4:10') */
  formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  /** Rule-driven issue detection using resolved observe issueRules */
  private detectIssuesByRules(
    rules: ResolvedObserve['issueRules'],
    dimensionAgg: Record<string, { good: number; partial: number; wrong: number; total: number }>,
    nameMap: Record<string, string>,
  ): string[] {
    const results: string[] = [];

    for (const rule of rules) {
      const isWildcard = rule.dimension.includes('*');
      const matchingDims = isWildcard
        ? Object.keys(dimensionAgg).filter(k => this.matchWildcard(rule.dimension, k))
        : dimensionAgg[rule.dimension] ? [rule.dimension] : [];

      for (const dim of matchingDims) {
        const agg = dimensionAgg[dim];
        if (!agg || agg.total === 0) continue;
        const label = nameMap[dim] || dim;
        let triggered = false;
        let count = 0;

        switch (rule.condition) {
          case 'wrong_pct_gte': {
            const wrongPct = Math.round((agg.wrong / agg.total) * 100);
            if (wrongPct >= rule.threshold) {
              triggered = true;
              count = agg.wrong;
            }
            break;
          }
          case 'count_lt': {
            if (agg.total < rule.threshold) {
              triggered = true;
              count = agg.total;
            }
            break;
          }
          case 'score_lt': {
            const avgScore = agg.total > 0
              ? Math.round(((agg.good * 100 + agg.partial * 50) / agg.total))
              : 0;
            if (avgScore < rule.threshold) {
              triggered = true;
              count = agg.wrong + agg.partial;
            }
            break;
          }
        }

        if (triggered) {
          results.push(
            rule.template.replace('{count}', String(count)).replace('{label}', label),
          );
        }
      }
    }

    return results;
  }

  /** Match a wildcard pattern like "*_placed" against a key (simple prefix/suffix only) */
  private matchWildcard(pattern: string, key: string): boolean {
    if (pattern === '*') return true;
    if (pattern.startsWith('*') && pattern.endsWith('*')) {
      return key.includes(pattern.slice(1, -1));
    }
    if (pattern.startsWith('*')) {
      return key.endsWith(pattern.slice(1));
    }
    if (pattern.endsWith('*')) {
      return key.startsWith(pattern.slice(0, -1));
    }
    return pattern === key;
  }

  /** Build surface data from student submissions for a step */
  buildSurfaces(
    taskNum: number,
    subsByStudent: Map<string, Record<number, { step: number; data: any; score: any; submittedAt: string }>>,
    stepIdx: number,
    surfaces: ObserveSurface[],
    students: Array<{ id: string; name: string }>,
  ): Record<string, any[]> {
    const result: Record<string, any[]> = {};
    const studentNameMap = new Map(students.map(s => [s.id, s.name]));

    for (const surface of surfaces) {
      const items: any[] = [];

      for (const [studentId, subs] of subsByStudent.entries()) {
        const sub = subs[stepIdx];
        if (!sub) continue;
        const studentName = studentNameMap.get(studentId) || studentId;

        const value = this.getNestedValue(sub, surface.source);
        if (value == null) continue;

        switch (surface.type) {
          case 'reasoning': {
            if (typeof value === 'object' && !Array.isArray(value)) {
              for (const [itemId, text] of Object.entries(value)) {
                if (text) items.push({ studentId, studentName, itemId, text });
              }
            } else if (Array.isArray(value)) {
              for (const entry of value) {
                items.push({ studentId, studentName, ...entry });
              }
            }
            break;
          }
          case 'llmFeedback': {
            items.push({ studentId, studentName, feedback: value });
            break;
          }
          case 'llmItems': {
            if (Array.isArray(value)) {
              items.push({ studentId, studentName, items: value });
            }
            break;
          }
          case 'positions': {
            if (typeof value === 'object' && !Array.isArray(value)) {
              for (const [itemId, coords] of Object.entries(value)) {
                if (Array.isArray(coords) && coords.length >= 2) {
                  items.push({ studentId, studentName, itemId, x: coords[0], y: coords[1] });
                } else if (typeof coords === 'object' && coords) {
                  items.push({ studentId, studentName, itemId, ...(coords as object) });
                }
              }
            }
            break;
          }
          case 'raw': {
            items.push({ studentId, studentName, value });
            break;
          }
        }
      }

      if (!result[surface.type]) result[surface.type] = [];
      result[surface.type].push(...items);
    }

    return result;
  }

  /** Resolve dot-separated path like "data.reasons" or "score.llmFeedback" */
  private getNestedValue(obj: any, path: string): any {
    let current = obj;
    for (const key of path.split('.')) {
      if (current == null || typeof current !== 'object') return undefined;
      if (!Object.prototype.hasOwnProperty.call(current, key)) return undefined;
      current = current[key];
    }
    return current;
  }

  /** G1: Map code dimension keys to human-readable names based on answerKey structure */
  private getDimensionNameMap(answerKey: any): Record<string, string> {
    const map: Record<string, string> = {};
    if (!answerKey) return map;

    switch (answerKey.type) {
      case 'quiz':
        for (const a of answerKey.answers || []) {
          map[`q${a.questionIdx}`] = a.label || `Q${a.questionIdx + 1}`;
        }
        break;
      case 'match':
        for (const a of answerKey.answers || []) {
          map[`p${a.pairIdx}`] = a.left ? `${a.left}→${a.correct}` : `P${a.pairIdx + 1}`;
        }
        break;
      case 'matrix':
        map['place'] = 'Where';
        map['practice'] = 'What';
        map['reason'] = 'Why';
        break;
      case 'stance':
        map['position'] = 'Position';
        map['evidence'] = 'Evidence';
        break;
      case 'order':
        map['correct'] = 'Correct';
        break;
    }
    return map;
  }

  /** Map answerKey type to Chinese description */
  private getStepTypeDesc(answerKey: any): string {
    if (!answerKey) return '';
    const typeMap: Record<string, string> = {
      quiz: '选择题',
      match: '结构匹配',
      matrix: '信息矩阵',
      stance: '立场+论据',
      order: '策略排序',
    };
    return typeMap[answerKey.type] || answerKey.type || '';
  }

  /** G7: Detect common wrong answer patterns for a step */
  private detectIssues(
    stepIdx: number,
    subsByStudent: Map<string, Record<number, { step: number; data: any; score: any; submittedAt: string }>>,
    answerKey: any,
  ): string[] {
    if (!answerKey) return [];

    const submissions: { data: any; score: any }[] = [];
    for (const subs of subsByStudent.values()) {
      if (subs[stepIdx]) {
        submissions.push({ data: subs[stepIdx].data, score: subs[stepIdx].score });
      }
    }
    if (submissions.length === 0) return [];

    const wrongCounts = new Map<string, number>();

    switch (answerKey.type) {
      case 'quiz': {
        const answers = answerKey.answers || [];
        for (const sub of submissions) {
          const studentAnswers = sub.data?.answers || [];
          for (const a of answers) {
            const studentAnswer = studentAnswers[a.questionIdx];
            if (studentAnswer != null && studentAnswer !== a.correct) {
              const label = a.label || `Q${a.questionIdx + 1}`;
              const key = `${label} 选了 ${studentAnswer}（应为 ${a.correct}）`;
              wrongCounts.set(key, (wrongCounts.get(key) || 0) + 1);
            }
          }
        }
        break;
      }
      case 'match': {
        const answers = answerKey.answers || [];
        for (const sub of submissions) {
          const pairs = sub.data?.pairs || sub.data?.answers || [];
          for (const a of answers) {
            const raw = pairs[a.pairIdx];
            const studentValue = typeof raw === 'string' ? raw : raw?.value;
            if (studentValue != null && studentValue.toLowerCase() !== a.correct.toLowerCase()) {
              const label = a.left || `P${a.pairIdx + 1}`;
              const key = `${label} 匹配为 ${studentValue}（应为 ${a.correct}）`;
              wrongCounts.set(key, (wrongCounts.get(key) || 0) + 1);
            }
          }
        }
        break;
      }
      case 'matrix': {
        const answers = (answerKey.answers || []).filter((a: any) => !a.isDemo);
        const colNames: Record<string, string> = { place: 'Where', practice: 'What', reason: 'Why' };
        for (const sub of submissions) {
          const studentRows = sub.data?.rows || [];
          for (const a of answers) {
            const studentRow = studentRows[a.rowIdx] || {};
            for (const col of ['place', 'practice', 'reason']) {
              const correct = (a[col] || '').toLowerCase().trim();
              const student = (studentRow[col] || '').toLowerCase().trim();
              if (student && correct && !student.includes(correct) && !correct.includes(student)) {
                const key = `${colNames[col] || col} 写 ${studentRow[col]} 而非 ${a[col]}`;
                wrongCounts.set(key, (wrongCounts.get(key) || 0) + 1);
              }
            }
          }
        }
        break;
      }
      case 'stance': {
        const validPositions: string[] = answerKey.validPositions || [];
        const minEvidence: number = answerKey.minEvidence || 2;
        for (const sub of submissions) {
          const position = (sub.data?.position || '').toLowerCase();
          const evidence = sub.data?.evidence || [];
          if (position && !validPositions.includes(position)) {
            const key = `立场为 ${sub.data.position}（有效立场：${validPositions.join('/')}）`;
            wrongCounts.set(key, (wrongCounts.get(key) || 0) + 1);
          }
          if (Array.isArray(evidence) && evidence.length > 0 && evidence.length < minEvidence) {
            const key = `论据不足（仅 ${evidence.length} 条，需 ${minEvidence} 条）`;
            wrongCounts.set(key, (wrongCounts.get(key) || 0) + 1);
          }
        }
        break;
      }
      case 'order': {
        const orderItems: string[] = answerKey.items || [];
        const correctOrderIdx: number[] = answerKey.correctOrder || [];
        const correctLabels = correctOrderIdx.map((idx: number) => orderItems[idx] ?? String(idx));
        for (const sub of submissions) {
          const studentOrder = sub.data?.order || [];
          if (studentOrder.length === 0) continue;
          for (let i = 0; i < correctLabels.length; i++) {
            const expected = correctLabels[i];
            const got = typeof studentOrder[i] === 'string' ? studentOrder[i] : studentOrder[i]?.label;
            if (got && got.toLowerCase() !== expected.toLowerCase()) {
              const key = `位置 ${i + 1} 放了 ${got}（应为 ${expected}）`;
              wrongCounts.set(key, (wrongCounts.get(key) || 0) + 1);
            }
          }
        }
        break;
      }
    }

    return Array.from(wrongCounts.entries())
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([desc, count]) => `${count} 人${desc}`);
  }
}
