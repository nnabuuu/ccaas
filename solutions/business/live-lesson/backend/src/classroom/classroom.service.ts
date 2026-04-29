import { Injectable, Inject, Logger, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not, MoreThan } from 'typeorm';
import { randomInt } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Student } from '../entities/student.entity';
import { Submission } from '../entities/submission.entity';
import { ClassroomSession } from '../entities/classroom-session.entity';
import { AiQuestion } from '../entities/ai-question.entity';
import { Lesson } from '../entities/lesson.entity';
import { ObservationService } from './observation.service';
import { GradingService } from './grading.service';
import { sanitizeAnswerKey } from '../schemas/manifest.utils';
import { PersonalTouchSchema, BonusArticleSchema, BonusStepSchema } from '../schemas';
import type { ExerciseSpec, GradeResult, TaskMap, PersonalTouch } from '../schemas';
import { AiPromptBuilder } from './ai-prompt-builder';
import { MetricsAggregator } from './metrics-aggregator';
import { OBSERVER_ENGINE, type ObserverEngine } from '@kedge-agentic/observer-engine';
import type { Response } from 'express';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 30 chars, no 0/O/1/I/L
const CODE_LENGTH = 6;

/** Build TaskMap from manifest. Fallback: steps with answerKey are tasks. */
function buildTaskMap(manifest: any): TaskMap {
  const readingSteps: any[] = manifest?.readingSteps || [];
  const taskDefs = readingSteps
    .filter((s: any) => s.type === 'task' || (!s.type && s.answerKey))
    .sort((a: any, b: any) => a.idx - b.idx);

  const stepToTask: Record<number, number> = {};
  const taskToStep: Record<number, number> = {};
  const taskSteps: number[] = [];

  taskDefs.forEach((def: any, i: number) => {
    const taskNum = i + 1;
    stepToTask[def.idx] = taskNum;
    taskToStep[taskNum] = def.idx;
    taskSteps.push(def.idx);
  });

  return { stepToTask, taskToStep, taskSteps, maxTask: taskDefs.length };
}

@Injectable()
export class ClassroomService {
  private readonly logger = new Logger(ClassroomService.name);
  private subscribers = new Map<string, Set<Response>>();
  private heartbeatTimers = new Map<Response, NodeJS.Timeout>();
  private activeNotificationsMap = new Map<string, Map<string, { id: string; message: string; notifyType: string; timestamp: string }>>();
  private taskMapCache = new Map<string, TaskMap>();

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Submission)
    private readonly submissionRepo: Repository<Submission>,
    @InjectRepository(ClassroomSession)
    private readonly sessionRepo: Repository<ClassroomSession>,
    @InjectRepository(AiQuestion)
    private readonly aiQuestionRepo: Repository<AiQuestion>,
    private readonly observationService: ObservationService,
    private readonly gradingService: GradingService,
    private readonly aiPromptBuilder: AiPromptBuilder,
    private readonly metricsAggregator: MetricsAggregator,
    @Inject(OBSERVER_ENGINE) private readonly engine: ObserverEngine,
  ) {}

  private get lessonRepo(): Repository<Lesson> {
    return this.sessionRepo.manager.getRepository(Lesson);
  }

  private async getTaskMap(lessonId: string): Promise<TaskMap> {
    const cached = this.taskMapCache.get(lessonId);
    if (cached) return cached;

    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId } });
    let manifest: any = null;
    if (lesson) {
      try { manifest = JSON.parse(lesson.manifestJson); } catch {}
    }
    const taskMap = buildTaskMap(manifest);
    this.taskMapCache.set(lessonId, taskMap);
    return taskMap;
  }

  // ── Session lifecycle ──

  async createSession(lessonId: string) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = this.generateCode();
      try {
        const session = this.sessionRepo.create({ code, lessonId, status: 'waiting' });
        const saved = await this.sessionRepo.save(session);
        this.logger.log(`Session created: ${saved.code} for lesson ${lessonId}`);
        await this.initObservation(saved.id, lessonId);
        return { sessionId: saved.id, code: saved.code, lessonId: saved.lessonId, status: saved.status };
      } catch (err: any) {
        if (err?.message?.includes('UNIQUE') || err?.code === 'SQLITE_CONSTRAINT') continue;
        throw err;
      }
    }
    throw new ConflictException('Failed to generate unique session code');
  }

  async resolveSession(codeOrId: string): Promise<ClassroomSession> {
    const session = codeOrId.length > 6
      ? await this.sessionRepo.findOne({ where: { id: codeOrId } })
      : await this.sessionRepo.findOne({ where: { code: codeOrId } });
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    return session;
  }

  async resolveActiveSession(code: string): Promise<ClassroomSession> {
    const session = await this.resolveSession(code);
    if (session.status === 'ended') {
      throw new BadRequestException('Session has ended');
    }
    return session;
  }

  async getSessionInfo(code: string) {
    const session = await this.resolveSession(code);
    return {
      sessionId: session.id,
      code: session.code,
      lessonId: session.lessonId,
      status: session.status,
      startedAt: session.startedAt,
      createdAt: session.createdAt,
    };
  }

  /** Batch-check sessions by ID list; return only resumable ones with lesson title.
   *  A session expires 60 min after creation (one class period). */
  async batchCheckSessions(sessionIds: string[], statusFilter?: 'waiting' | 'active') {
    if (!sessionIds.length) return [];

    const SESSION_TTL_MS = 60 * 60 * 1000; // 60 min
    const cutoff = new Date(Date.now() - SESSION_TTL_MS);

    const whereClauses = [];
    if (!statusFilter || statusFilter === 'waiting') {
      whereClauses.push({ id: In(sessionIds), status: 'waiting' as const, createdAt: MoreThan(cutoff) });
    }
    if (!statusFilter || statusFilter === 'active') {
      whereClauses.push({ id: In(sessionIds), status: 'active' as const, createdAt: MoreThan(cutoff) });
    }

    const sessions = await this.sessionRepo.find({ where: whereClauses });
    if (!sessions.length) return [];

    const lessonIds = [...new Set(sessions.map(s => s.lessonId))];
    const lessons = await this.lessonRepo.find({ where: { id: In(lessonIds) } });
    const titleMap = new Map(lessons.map(l => [l.id, l.title]));

    return sessions.map(s => ({
      sessionId: s.id,
      code: s.code,
      lessonId: s.lessonId,
      status: s.status,
      title: titleMap.get(s.lessonId) || s.lessonId,
    }));
  }

  async startSession(code: string) {
    const session = await this.resolveSession(code);
    if (session.status === 'ended') {
      throw new BadRequestException('Session has ended');
    }
    if (session.status === 'active') {
      return { ok: true, status: 'active', startedAt: session.startedAt };
    }
    session.status = 'active';
    session.startedAt = new Date();
    await this.sessionRepo.save(session);

    // Initialize observation system with anchors from manifest
    this.initObservation(session.id, session.lessonId).catch(e =>
      this.logger.warn(`Observation init failed: ${e}`),
    );

    this.broadcast(session.id);
    this.logger.log(`Session started: ${code}`);
    return { ok: true, status: 'active', startedAt: session.startedAt };
  }

  async endSession(code: string) {
    const session = await this.resolveSession(code);
    if (session.status === 'ended') {
      return { ok: true, status: 'ended' };
    }
    session.status = 'ended';
    session.endedAt = new Date();
    await this.sessionRepo.save(session);
    this.activeNotificationsMap.delete(session.id);

    // Persist observation data
    this.observationService.cleanupSession(session.id).catch(e =>
      this.logger.warn(`Observation cleanup failed: ${e}`),
    );

    // Observer engine: clear session metadata
    this.engine.clearSessionMeta(session.id);

    this.logger.log(`Session ended: ${code}`);
    return { ok: true, status: 'ended' };
  }

  // ── Classroom operations (session-scoped) ──

  async join(session: ClassroomSession, name: string) {
    const existing = await this.studentRepo.findOne({
      where: { sessionId: session.id, name },
    });
    if (existing) {
      this.broadcast(session.id);
      return { studentId: existing.id, name: existing.name, lessonId: session.lessonId };
    }

    const student = this.studentRepo.create({
      sessionId: session.id,
      lessonId: session.lessonId,
      name,
    });
    const saved = await this.studentRepo.save(student);

    // Observation: student join event
    this.observationService.addSystemEvent(
      session.id, saved.id, saved.name, 'join', {}, `${saved.name} 加入课堂`,
    );

    // Observer engine: student join
    this.engine.dispatch({
      type: 'student_join',
      sessionId: session.id,
      entityId: saved.id,
      tenantId: session.lessonId,
      payload: { studentName: saved.name },
    }).catch(err => this.logger.error(`Observer dispatch student_join failed: ${err}`));

    this.broadcast(session.id);
    return { studentId: saved.id, name: saved.name, lessonId: session.lessonId };
  }

  async submit(session: ClassroomSession, studentId: string, step: number, data: Record<string, unknown>) {
    const student = await this.studentRepo.findOne({
      where: { id: studentId, sessionId: session.id },
    });
    if (!student) {
      throw new NotFoundException('Student not found in this session');
    }

    // Auto-grade against manifest answer key
    const score = await this.gradeSubmission(session.lessonId, step, data);

    const existing = await this.submissionRepo.findOne({
      where: { sessionId: session.id, studentId, step },
    });
    if (existing) {
      existing.dataJson = data;
      existing.scoreJson = score;
      await this.submissionRepo.save(existing);
    } else {
      const submission = this.submissionRepo.create({
        sessionId: session.id,
        lessonId: session.lessonId,
        studentId,
        step,
        dataJson: data,
        scoreJson: score,
      });
      await this.submissionRepo.save(submission);
    }

    // Update student progress — only advance on perfect score or open-ended (no rubric).
    // Guard: only process progress for current task or prior re-submissions (taskNum <= currentTask).
    // This prevents a student at task 1 from skipping to task 5 by submitting step 9.
    const taskMap = await this.getTaskMap(session.lessonId);
    const taskNum = taskMap.stepToTask[step];
    if (taskNum !== undefined && taskNum <= student.currentTask) {
      const isComplete = !score || score.total === 100;
      if (isComplete) {
        const nextTask = taskNum + 1;
        if (nextTask <= taskMap.maxTask && (student.currentTask === taskNum)) {
          student.currentTask = nextTask;
          student.currentPhase = 'listen';
          student.stepStartedAt = new Date().toISOString();
        } else if (student.currentTask === taskNum) {
          student.currentTask = taskNum;
          student.currentPhase = 'completed';
        }
        await this.studentRepo.save(student);
      }
    }

    // Observation: exercise result event (await for sync persistence)
    await this.observationService.addSystemEvent(
      session.id, studentId, student.name, 'exercise_result',
      { step, score: score?.total ?? null },
      `提交 Step ${step} 答案${score ? `，得分 ${score.total}%` : ''}`,
    );

    // Observer engine: exercise result
    this.engine.dispatch({
      type: 'exercise_result',
      sessionId: session.id,
      entityId: studentId,
      tenantId: session.lessonId,
      payload: { step, score: score?.total ?? null },
    }).catch(err => this.logger.error(`Observer dispatch exercise_result failed: ${err}`));

    // Observation: step_complete event when student advances
    const currentTask = student.currentTask;
    if (taskNum !== undefined && currentTask > taskNum) {
      await this.observationService.addSystemEvent(
        session.id, studentId, student.name, 'step_complete',
        { step, taskNum, nextTask: currentTask },
        `完成 Task ${taskNum}，进入 Task ${currentTask}`,
      );

      // Observer engine: step complete
      this.engine.dispatch({
        type: 'step_complete',
        sessionId: session.id,
        entityId: studentId,
        tenantId: session.lessonId,
        payload: { step, taskNum, nextTask: currentTask },
      }).catch(err => this.logger.error(`Observer dispatch step_complete failed: ${err}`));
    }

    // Observation: observeTurn with enriched context
    const exerciseCorrectRate = score?.total ?? 0;
    await this.observationService.observeTurn(
      session.id, studentId, student.name,
      { student: JSON.stringify(data), ai: `得分 ${exerciseCorrectRate}%` },
      { currentStep: `step-${step}`, exerciseCorrectRate, idleSeconds: 0 },
    ).catch(e => this.logger.warn(`Observation observeTurn after submit failed: ${e}`));

    // Observer engine: chat turn (exercise submit as a turn)
    this.engine.dispatch({
      type: 'chat_turn',
      sessionId: session.id,
      entityId: studentId,
      tenantId: session.lessonId,
      payload: { student: JSON.stringify(data), ai: `得分 ${exerciseCorrectRate}%`, step },
    }).catch(err => this.logger.error(`Observer dispatch chat_turn failed: ${err}`));

    this.broadcast(session.id);
    return { ok: true, score, currentTask: student.currentTask, currentPhase: student.currentPhase };
  }

  async getState(sessionId: string, currentStep?: number) {
    const students = await this.studentRepo.find({
      where: { sessionId },
      order: { joinedAt: 'ASC' },
    });

    const submissions = await this.submissionRepo.find({
      where: { sessionId },
    });

    const subsByStudent = new Map<string, Record<number, { step: number; data: any; score: any; submittedAt: string }>>();
    for (const sub of submissions) {
      if (!subsByStudent.has(sub.studentId)) {
        subsByStudent.set(sub.studentId, {});
      }
      subsByStudent.get(sub.studentId)![sub.step] = {
        step: sub.step,
        data: sub.dataJson,
        score: sub.scoreJson ?? null,
        submittedAt: sub.submittedAt instanceof Date
          ? sub.submittedAt.toISOString()
          : String(sub.submittedAt),
      };
    }

    // Always fetch session for status + currentStep
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    const stepToCheck = currentStep ?? session?.currentStep ?? 0;

    // Load manifest for G1/G4/G5/G7 enrichment
    let manifest: any = null;
    if (session?.lessonId) {
      const lesson = await this.lessonRepo.findOne({ where: { id: session.lessonId } });
      if (lesson) {
        try { manifest = JSON.parse(lesson.manifestJson); } catch {}
      }
    }
    const taskMap = buildTaskMap(manifest);

    const total = students.length;
    let submitted = 0;
    for (const s of students) {
      const subs = subsByStudent.get(s.id);
      if (subs && subs[stepToCheck]) {
        submitted++;
      }
    }

    // Fetch AI questions (needed for step metrics)
    const questions = await this.aiQuestionRepo.find({
      where: { sessionId },
      order: { askedAt: 'ASC' },
    });

    // G2: per-student per-step durations
    const studentDurations = this.metricsAggregator.computeStudentDurations(students, subsByStudent, taskMap);

    // Build enriched stepMetrics with byDimension, timing, AI stats, issues, questionAggregates
    const stepMetrics = this.metricsAggregator.buildStepMetrics(total, students, subsByStudent, questions, studentDurations, manifest, taskMap);

    // G3: extract median times for stuck detection
    const medianTimes = this.metricsAggregator.extractMedianTimes(stepMetrics);

    // Compute student statuses once (G3)
    const studentStatuses = new Map<string, string>();
    for (const s of students) {
      studentStatuses.set(s.id, this.metricsAggregator.computeStudentStatus(s, subsByStudent.get(s.id), medianTimes, taskMap));
    }

    // G4: enrich stepMetrics with alertTag (needs studentStatuses computed above)
    for (let taskNum = 1; taskNum <= taskMap.maxTask; taskNum++) {
      stepMetrics[taskNum].alertTag = this.metricsAggregator.computeAlertTag(
        taskNum, stepMetrics[taskNum], students, studentStatuses,
      );
    }

    // G6: health cards
    const healthCards = this.metricsAggregator.computeHealthCards(students, studentStatuses, questions, taskMap.maxTask);

    const questionRecords = questions.map(q => ({
      studentId: q.studentId,
      studentName: q.studentName,
      step: q.step,
      question: q.question,
      answer: q.answer,
      category: q.category,
      timestamp: q.askedAt instanceof Date ? q.askedAt.toISOString() : String(q.askedAt),
    }));

    return {
      sessionStatus: session?.status ?? 'active',
      currentStep: stepToCheck,
      students: students.map(s => {
        const subs = subsByStudent.get(s.id) || {};
        const durations = studentDurations.get(s.id) || {};
        const status = studentStatuses.get(s.id) || 'prog';

        // G2: Enrich submissions with duration and aiRoundsCount
        const enrichedSubs: Record<number, any> = {};
        for (const [stepStr, sub] of Object.entries(subs)) {
          const stepNum = Number(stepStr);
          const dur = durations[stepNum] ?? null;
          enrichedSubs[stepNum] = {
            ...sub,
            duration: dur,
            timeFormatted: dur != null ? this.metricsAggregator.formatDuration(dur) : null,
            result: this.metricsAggregator.deriveResult(sub.score),
            aiRoundsCount: questions.filter(q => q.studentId === s.id && q.step === stepNum).length,
          };
        }

          // Build stepHistory (task-number-keyed) for student modal
        const stepHistory: Record<number, any> = {};
        for (let taskNum = 1; taskNum <= taskMap.maxTask; taskNum++) {
          const taskStepIdx = taskMap.taskToStep[taskNum];
          const sub = subs[taskStepIdx];
          const aiCount = questions.filter(q => q.studentId === s.id && q.step === taskStepIdx).length;

          if (sub && (s.currentTask > taskNum || s.currentPhase === 'completed')) {
            // Passed this step (submitted and advanced beyond it)
            const score = sub.score;
            const dur = durations[taskStepIdx];
            stepHistory[taskNum] = {
              status: 'done',
              result: this.metricsAggregator.deriveResult(score),
              time: dur != null ? this.metricsAggregator.formatDuration(dur) : null,
              aiRounds: aiCount,
            };
          } else if (s.currentTask === taskNum) {
            // Current step — may have a failed submission
            const isStuck = studentStatuses.get(s.id) === 'stuck';
            const score = sub?.score;
            const dur = sub ? durations[taskStepIdx] : undefined;
            stepHistory[taskNum] = {
              status: isStuck ? 'stuck' : (s.currentPhase === 'listen' ? 'reading' : 'prog'),
              aiRounds: aiCount,
              ...(sub ? { result: this.metricsAggregator.deriveResult(score), time: dur != null ? this.metricsAggregator.formatDuration(dur) : null } : {}),
            };
          } else if (s.currentTask > taskNum || s.currentPhase === 'completed') {
            // Past step without submission (edge case)
            stepHistory[taskNum] = { status: 'done', aiRounds: aiCount };
          } else {
            // Future step
            stepHistory[taskNum] = { status: 'future' };
          }
        }

        return {
          id: s.id,
          name: s.name,
          currentTask: s.currentTask,
          currentPhase: s.currentPhase,
          stepStartedAt: s.stepStartedAt,
          status,
          submissions: enrichedSubs,
          stepHistory,
        };
      }),
      metrics: {
        total,
        submitted,
        inProgress: total - submitted,
      },
      stepMetrics,
      healthCards,
      questions: questionRecords,
      observation: {
        logs: this.observationService.getStudentLogs(sessionId),
        alerts: this.observationService.generateAlerts(sessionId),
        indicatorStats: this.observationService.computeIndicatorStats(sessionId),
        indicators: this.observationService.getIndicators(sessionId),
      },
    };
  }

  subscribe(sessionId: string, res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    if (!this.subscribers.has(sessionId)) {
      this.subscribers.set(sessionId, new Set());
    }
    this.subscribers.get(sessionId)!.add(res);

    this.getState(sessionId).then(state => {
      const activeNotifications = Array.from(
        (this.activeNotificationsMap.get(sessionId) ?? new Map()).values(),
      );
      res.write(`data: ${JSON.stringify({ ...state, activeNotifications })}\n\n`);
    }).catch(e => {
      this.logger.error(`Failed to send initial SSE state: ${e}`);
    });

    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 30000);
    this.heartbeatTimers.set(res, heartbeat);

    res.on('close', () => {
      this.subscribers.get(sessionId)?.delete(res);
      const timer = this.heartbeatTimers.get(res);
      if (timer) {
        clearInterval(timer);
        this.heartbeatTimers.delete(res);
      }
      this.logger.debug(`SSE subscriber disconnected for session ${sessionId}`);
    });

    this.logger.debug(`SSE subscriber connected for session ${sessionId}`);
  }

  async setStep(sessionId: string, step: number) {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (session) {
      session.currentStep = step;
      await this.sessionRepo.save(session);
    }
    const state = await this.getState(sessionId, step);
    this.broadcastNamed(sessionId, 'step_sync', { currentStep: step, ...state });
    return { ok: true, currentStep: step };
  }

  notify(sessionId: string, message: string, type?: string) {
    const notifyType = type || 'general';
    const id = `${notifyType}::${message}`;

    if (!this.activeNotificationsMap.has(sessionId)) {
      this.activeNotificationsMap.set(sessionId, new Map());
    }
    const sessionNotifs = this.activeNotificationsMap.get(sessionId)!;

    if (sessionNotifs.has(id)) {
      sessionNotifs.delete(id);
      this.broadcastNamed(sessionId, 'notification_revoke', { id });
      return { ok: true, active: false, id };
    } else {
      const timestamp = new Date().toISOString();
      sessionNotifs.set(id, { id, message, notifyType, timestamp });
      this.broadcastNamed(sessionId, 'notification', { id, message, notifyType, timestamp });
      return { ok: true, active: true, id };
    }
  }

  async aiAsk(session: ClassroomSession, studentId: string, step: number, question: string): Promise<{ answer: string; category: string }> {
    const student = await this.studentRepo.findOne({
      where: { id: studentId, sessionId: session.id },
    });
    if (!student) {
      throw new NotFoundException('Student not found in this session');
    }

    let rawAnswer: string;
    try {
      const systemPrompt = await this.buildAiSystemPrompt(session.lessonId, step);
      rawAnswer = await this.aiPromptBuilder.callGlm(systemPrompt, question);
    } catch (e) {
      this.logger.warn(`AI call failed: ${e}`);
      rawAnswer = '【其他】AI 助教暂时无法回答，请稍后再试。';
    }

    const parsed = this.aiPromptBuilder.parseCategoryFromResponse(rawAnswer);

    // Persist to DB
    const aiQuestion = this.aiQuestionRepo.create({
      sessionId: session.id,
      studentId,
      studentName: student.name,
      step,
      question,
      answer: parsed.answer,
      category: parsed.category,
    });
    await this.aiQuestionRepo.save(aiQuestion);

    // Observation: await GLM observe before broadcast so SSE includes results
    const latestSub = await this.submissionRepo.findOne({
      where: { sessionId: session.id, studentId },
      order: { submittedAt: 'DESC' },
    });
    const correctRate = latestSub?.scoreJson?.total ?? 0;
    await this.observationService.observeTurn(
      session.id, studentId, student.name,
      { student: question, ai: parsed.answer },
      { currentStep: `step-${step}`, exerciseCorrectRate: correctRate, idleSeconds: 0 },
    ).catch(e => this.logger.warn(`Observation observeTurn failed: ${e}`));

    // Observer engine: chat turn
    this.engine.dispatch({
      type: 'chat_turn',
      sessionId: session.id,
      entityId: studentId,
      tenantId: session.lessonId,
      payload: { student: question, ai: parsed.answer, step },
    }).catch(err => this.logger.error(`Observer dispatch chat_turn failed: ${err}`));

    this.broadcast(session.id);
    return { answer: parsed.answer, category: parsed.category };
  }

  // ── AI Discuss (structured teaching dialogue) ──

  async aiDiscuss(
    session: ClassroomSession,
    studentId: string,
    taskNum: number,
    interactionType: 'probeReply' | 'followUpReply',
    studentResponse: string,
  ): Promise<{ reply: string; followUpQuestion?: string; quality: 'pass' | 'retry'; depth?: 'surface' | 'partial' | 'deep' }> {
    const student = await this.studentRepo.findOne({
      where: { id: studentId, sessionId: session.id },
    });
    if (!student) {
      throw new NotFoundException('Student not found in this session');
    }

    try {
      const systemPrompt = await this.buildDiscussSystemPrompt(
        session, studentId, taskNum, interactionType,
      );
      const rawResponse = await this.aiPromptBuilder.callGlm(systemPrompt, studentResponse, {
        maxTokens: 512,
        temperature: 0.75,
        responseFormat: { type: 'json_object' },
      });
      const parsed = await this.aiPromptBuilder.parseOrRepairDiscussResponse(rawResponse, interactionType);

      // Persist to reading_ai_questions so teacher dashboard aiRounds/aiPeople includes discuss
      const lesson = await this.lessonRepo.findOne({ where: { id: session.lessonId } });
      const taskMap = lesson ? buildTaskMap(JSON.parse(lesson.manifestJson)) : null;
      const stepIdx = taskMap?.taskToStep[taskNum] ?? taskNum;
      await this.aiQuestionRepo.save(this.aiQuestionRepo.create({
        sessionId: session.id,
        studentId,
        studentName: student.name,
        step: stepIdx,
        question: `[discuss:${interactionType}] ${studentResponse}`,
        answer: parsed.reply,
        category: 'discuss',
      }));

      // Observation: await GLM observe before returning so state is up-to-date
      const latestDiscussSub = await this.submissionRepo.findOne({
        where: { sessionId: session.id, studentId },
        order: { submittedAt: 'DESC' },
      });
      const discussCorrectRate = latestDiscussSub?.scoreJson?.total ?? 0;
      await this.observationService.observeTurn(
        session.id, studentId, student.name,
        { student: studentResponse, ai: parsed.reply },
        { currentStep: `task-${taskNum}`, exerciseCorrectRate: discussCorrectRate, idleSeconds: 0 },
      ).catch(e => this.logger.warn(`Observation observeTurn failed: ${e}`));

      // Store discuss_depth system event for teacher dashboard visibility (await so state is up-to-date for SSE)
      if (parsed.depth) {
        await this.observationService.addSystemEvent(
          session.id, studentId, student.name, 'discuss_depth',
          { taskNum, depth: parsed.depth, interactionType },
          `Discuss depth: ${parsed.depth}`,
        );
      }

      // Observer engine: chat turn (discuss)
      this.engine.dispatch({
        type: 'chat_turn',
        sessionId: session.id,
        entityId: studentId,
        tenantId: session.lessonId,
        payload: { student: studentResponse, ai: parsed.reply, taskNum, interactionType },
      }).catch(err => this.logger.error(`Observer dispatch chat_turn failed: ${err}`));

      // Push updated state to teacher dashboard (observation + questions changed)
      this.broadcast(session.id);

      return parsed;
    } catch (e) {
      this.logger.warn(`AI discuss call failed: ${e}`);
      return {
        reply: 'AI tutor is temporarily unavailable. Please try again later.',
        quality: 'pass' as const,
        ...(interactionType === 'probeReply'
          ? { followUpQuestion: 'Can you tell me more about what you found in the text?' }
          : {}),
      };
    }
  }

  // ── Personal Touch + Bonus ──

  async getPersonalTouch(session: ClassroomSession, studentId: string) {
    const student = await this.studentRepo.findOne({
      where: { id: studentId, sessionId: session.id },
    });
    if (!student) throw new NotFoundException('Student not found in this session');

    const lesson = await this.lessonRepo.findOne({ where: { id: session.lessonId } });
    if (!lesson) throw new NotFoundException('Lesson not found');

    const manifest = JSON.parse(lesson.manifestJson);
    const taskMap = await this.getTaskMap(session.lessonId);

    // Validate personalTouch config via Zod
    const ptParsed = PersonalTouchSchema.safeParse(manifest.personalTouch);
    if (!ptParsed.success) {
      this.logger.warn(`personalTouch schema invalid: ${ptParsed.error.message}`);
      return { strategies: [], tier: { label: '', labelEn: '', tone: 'neutral' }, aiComment: '', bonusUnlocked: false };
    }
    const personalTouch: PersonalTouch = ptParsed.data;

    // Batch-fetch all submissions for this student (avoids N+1)
    const allSubs = await this.submissionRepo.find({
      where: { sessionId: session.id, studentId },
    });
    const subsByStep = new Map(allSubs.map(s => [s.step, s]));

    // Collect task 1-4 scores
    const strategies: Array<{ task: number; strategy: string; score: number; attempts: number }> = [];
    for (const sl of personalTouch.strategyLabels) {
      const stepNum = taskMap.taskToStep[sl.taskIdx];
      if (stepNum === undefined) continue;
      const sub = subsByStep.get(stepNum);
      const score = sub?.scoreJson?.total ?? 0;
      const attempts = sub?.scoreJson?.attemptCounts
        ? Math.max(...Object.values(sub.scoreJson.attemptCounts as Record<string, number>))
        : 1;
      strategies.push({ task: sl.taskIdx, strategy: sl.strategy, score, attempts });
    }

    // Compute average score → tier (sort descending to ensure correct matching)
    const avg = strategies.length > 0
      ? strategies.reduce((sum, s) => sum + s.score, 0) / strategies.length
      : 0;
    const sortedTiers = [...personalTouch.tiers].sort((a, b) => b.minScore - a.minScore);
    const tier = sortedTiers.find(t => avg >= t.minScore) || { label: '', labelEn: '', tone: 'neutral' as const };

    // AI comment
    let aiComment = '';
    try {
      const { system, user } = this.aiPromptBuilder.buildPersonalTouchPrompt(strategies);
      aiComment = await this.aiPromptBuilder.callGlm(system, user, { maxTokens: 256, temperature: 0.8 });
    } catch (e) {
      this.logger.warn(`Personal touch AI comment failed: ${e}`);
      aiComment = '你完成了所有阅读策略练习，继续保持！';
    }

    // Bonus unlock: teacher hasn't reached step 5 yet (student finished ahead)
    const currentSession = await this.sessionRepo.findOne({ where: { id: session.id } });
    const bonusUnlocked = (currentSession?.currentStep ?? 0) < 5;

    return { strategies, tier, aiComment, bonusUnlocked };
  }

  async getBonusExercise(session: ClassroomSession, bonusStep: number) {
    const lesson = await this.lessonRepo.findOne({ where: { id: session.lessonId } });
    if (!lesson) throw new NotFoundException('Lesson not found');

    const manifest = JSON.parse(lesson.manifestJson);
    const rawBonusSteps: unknown[] = manifest.bonusSteps || [];

    if (bonusStep < 1 || bonusStep > rawBonusSteps.length) {
      throw new BadRequestException(`bonusStep must be between 1 and ${rawBonusSteps.length}`);
    }

    // Validate the specific bonus step with Zod
    const parsed = BonusStepSchema.safeParse(rawBonusSteps[bonusStep - 1]);
    if (!parsed.success) {
      throw new NotFoundException(`Invalid bonus exercise definition at step ${bonusStep}`);
    }
    const stepDef = parsed.data;

    const spec = sanitizeAnswerKey(stepDef.answerKey, stepDef.exerciseLabel);
    if (!spec) throw new NotFoundException(`Unsupported bonus exercise type`);

    // Validate bonus article if present
    const articleParsed = BonusArticleSchema.safeParse(manifest.bonusArticle);

    return {
      exercise: spec,
      article: articleParsed.success ? articleParsed.data : null,
      label: stepDef.labelEn || stepDef.label,
      strategy: stepDef.strategy || '',
    };
  }

  async checkBonusAnswer(
    session: ClassroomSession,
    studentId: string,
    bonusStep: number,
    data: Record<string, unknown>,
  ) {
    const student = await this.studentRepo.findOne({
      where: { id: studentId, sessionId: session.id },
    });
    if (!student) throw new NotFoundException('Student not found in this session');

    const lesson = await this.lessonRepo.findOne({ where: { id: session.lessonId } });
    if (!lesson) throw new NotFoundException('Lesson not found');

    const manifest = JSON.parse(lesson.manifestJson);
    const rawBonusSteps: unknown[] = manifest.bonusSteps || [];

    if (bonusStep < 1 || bonusStep > rawBonusSteps.length) {
      throw new BadRequestException(`bonusStep must be between 1 and ${rawBonusSteps.length}`);
    }

    const parsed = BonusStepSchema.safeParse(rawBonusSteps[bonusStep - 1]);
    if (!parsed.success) {
      throw new NotFoundException(`Invalid bonus exercise definition at step ${bonusStep}`);
    }
    const stepDef = parsed.data;

    const gradeResult = await this.gradingService.grade(stepDef.answerKey, data);

    // Virtual step range 101+ reserved for bonus exercises
    const BONUS_STEP_OFFSET = 100;
    const virtualStep = BONUS_STEP_OFFSET + bonusStep;
    const existing = await this.submissionRepo.findOne({
      where: { sessionId: session.id, studentId, step: virtualStep },
    });
    if (existing) {
      existing.dataJson = data;
      existing.scoreJson = gradeResult;
      await this.submissionRepo.save(existing);
    } else {
      const submission = this.submissionRepo.create({
        sessionId: session.id,
        lessonId: session.lessonId,
        studentId,
        step: virtualStep,
        dataJson: data,
        scoreJson: gradeResult,
      });
      await this.submissionRepo.save(submission);
    }

    // Build per-item check feedback
    const ak = stepDef.answerKey as Record<string, unknown>;
    const items = gradeResult ? this.buildCheckItems(ak, data, gradeResult) : [];
    const allCorrect = gradeResult ? gradeResult.total === 100 : false;

    return { type: stepDef.answerKey.type, allCorrect, items };
  }

  // ── Exercise API (session-scoped, answer-safe) ──

  // NOTE: select-evidence spec intentionally includes correctFunction/kind/why
  // because grading happens client-side. Server-side grade (via /submit) is the
  // source of truth. TODO: migrate to server-side /check grading to avoid exposing answers.
  async getExerciseSpec(session: ClassroomSession, step: number): Promise<ExerciseSpec> {
    const lesson = await this.lessonRepo.findOne({ where: { id: session.lessonId } });
    if (!lesson) throw new NotFoundException('Lesson not found');

    const manifest = JSON.parse(lesson.manifestJson);
    const steps: Array<Record<string, unknown>> = manifest.readingSteps || [];
    const stepDef = steps.find((s) => s.idx === step);
    if (!stepDef?.answerKey) {
      throw new NotFoundException(`No exercise found at step ${step}`);
    }

    const spec = sanitizeAnswerKey(stepDef.answerKey, stepDef.exerciseLabel as string | undefined);
    if (!spec) throw new NotFoundException(`Unsupported exercise type at step ${step}`);
    return spec;
  }

  async checkAnswer(
    session: ClassroomSession,
    studentId: string,
    step: number,
    data: Record<string, unknown>,
  ): Promise<{ type: string; allCorrect: boolean; items: Array<Record<string, unknown>> }> {
    const student = await this.studentRepo.findOne({
      where: { id: studentId, sessionId: session.id },
    });
    if (!student) throw new NotFoundException('Student not found in this session');

    const lesson = await this.lessonRepo.findOne({ where: { id: session.lessonId } });
    if (!lesson) throw new NotFoundException('Lesson not found');

    const manifest = JSON.parse(lesson.manifestJson);
    const steps: Array<Record<string, unknown>> = manifest.readingSteps || [];
    const stepDef = steps.find((s) => s.idx === step);
    if (!stepDef?.answerKey) {
      throw new NotFoundException(`No exercise found at step ${step}`);
    }

    const ak = stepDef.answerKey as Record<string, unknown>;
    const gradeResult = await this.gradingService.grade(ak, data as Record<string, unknown>);

    // Build per-item feedback from gradeResult + answerKey hints
    const items = gradeResult ? this.buildCheckItems(ak, data, gradeResult) : [];
    const allCorrect = gradeResult ? gradeResult.total === 100 : false;

    return { type: ak.type as string, allCorrect, items };
  }

  private buildCheckItems(
    ak: Record<string, unknown>,
    data: Record<string, unknown>,
    gradeResult: GradeResult,
  ): Array<Record<string, unknown>> {
    const dimOk = (val: unknown): boolean => val === true || val === 100;
    const answers = ak.answers as Array<Record<string, unknown>> | undefined;
    const sections = ak.sections as Array<Record<string, unknown>> | undefined;

    switch (ak.type) {
      case 'quiz':
        return (answers || []).map((a) => {
          const correct = dimOk(gradeResult.byDimension?.[`q${a.questionIdx}`]);
          return {
            idx: a.questionIdx,
            correct,
            ...(!correct && a.hint && { hint: a.hint }),
            ...(!correct && a.hintZh && { hintZh: a.hintZh }),
            ...(!correct && a.walkthrough && { walkthrough: a.walkthrough }),
            ...(!correct && a.walkthroughZh && { walkthroughZh: a.walkthroughZh }),
          };
        });

      case 'match':
        return (answers || []).map((a) => {
          const correct = dimOk(gradeResult.byDimension?.[`p${a.pairIdx}`]);
          return {
            idx: a.pairIdx,
            correct,
            ...(!correct && a.hint && { hint: a.hint }),
            ...(!correct && a.hintZh && { hintZh: a.hintZh }),
            ...(!correct && a.walkthrough && { walkthrough: a.walkthrough }),
            ...(!correct && a.walkthroughZh && { walkthroughZh: a.walkthroughZh }),
          };
        });

      case 'matrix':
        return (answers || []).filter((a) => !a.isDemo).map((a) => {
          const place = gradeResult.byDimension?.place ?? 0;
          const practice = gradeResult.byDimension?.practice ?? 0;
          const reason = gradeResult.byDimension?.reason ?? 0;
          const correct = dimOk(place) && dimOk(practice) && dimOk(reason);
          return {
            idx: a.rowIdx,
            correct,
            ...(!correct && a.hint && { hint: a.hint }),
            ...(!correct && a.hintZh && { hintZh: a.hintZh }),
          };
        });

      case 'stance': {
        const posCorrect = dimOk(gradeResult.byDimension?.position);
        const evCorrect = dimOk(gradeResult.byDimension?.evidence);
        return [
          { idx: 'position', correct: posCorrect },
          { idx: 'evidence', correct: evCorrect },
        ];
      }

      case 'order': {
        const orderItems = ak.items as string[];
        const correctOrder = (ak.correctOrder || []) as number[];
        const studentOrder = (data.order || []) as unknown[];
        return correctOrder.map((expectedIdx, pos) => {
          const expectedLabel = (orderItems[expectedIdx] ?? '').toLowerCase();
          const raw = studentOrder[pos];
          const studentLabel = typeof raw === 'string' ? raw.toLowerCase()
            : typeof raw === 'number' ? (orderItems[raw] ?? '').toLowerCase() : '';
          return { idx: pos, correct: studentLabel === expectedLabel };
        });
      }

      case 'select-evidence':
        return (sections || []).map((s) => {
          const sectionData = (data?.sections as Record<string, Record<string, unknown>> | undefined)?.[s.id as string];
          const functionCorrect = (sectionData?.function as string)?.toLowerCase() === (s.correctFunction as string)?.toLowerCase();
          return {
            idx: s.id,
            correct: functionCorrect,
            ...(!functionCorrect && s.hint && { hint: s.hint }),
            ...(!functionCorrect && s.hintZh && { hintZh: s.hintZh }),
            ...(functionCorrect && s.aiCorrect && { aiMessage: s.aiCorrect }),
            ...(!functionCorrect && s.aiPartial && { aiMessage: s.aiPartial }),
          };
        });

      case 'map': {
        const mapItems = ak.items as Array<Record<string, unknown>> | undefined;
        const result: Array<Record<string, unknown>> = (mapItems || []).map((it) => {
          const id = it.id as string;
          const placed = gradeResult.byDimension?.[`${id}_placed`] === true;
          const reasoned = gradeResult.byDimension?.[`${id}_reasoned`] === true;
          const posScore = (gradeResult.byDimension?.[`${id}_positionScore`] as number) ?? 0;
          return { idx: id, correct: placed && reasoned && posScore >= 50 };
        });
        if (gradeResult.llmFeedback) {
          result.push({ idx: '_llm', correct: true, hint: gradeResult.llmFeedback });
        }
        return result;
      }

      default:
        return [];
    }
  }

  // ── Private helpers ──

  private async gradeSubmission(lessonId: string, step: number, data: Record<string, unknown>): Promise<GradeResult | null> {
    try {
      const lesson = await this.lessonRepo.findOne({ where: { id: lessonId } });
      if (!lesson) return null;

      const manifest = JSON.parse(lesson.manifestJson);
      const readingSteps = manifest.readingSteps || [];

      // Find the step with matching idx
      const stepDef = readingSteps.find((s: any) => s.idx === step);
      if (!stepDef || !stepDef.answerKey) return null;

      return await this.gradingService.grade(stepDef.answerKey, data);
    } catch (e) {
      this.logger.warn(`Grading failed for step ${step}: ${e}`);
      return null;
    }
  }

  private async buildAiSystemPrompt(lessonId: string, step: number): Promise<string> {
    try {
      const lesson = await this.lessonRepo.findOne({ where: { id: lessonId } });
      if (!lesson) {
        return this.aiPromptBuilder.buildFallbackPrompt();
      }

      const manifest = JSON.parse(lesson.manifestJson);
      return this.aiPromptBuilder.buildAskSystemPrompt(manifest, step);
    } catch {
      return this.aiPromptBuilder.buildFallbackPrompt();
    }
  }

  private async buildDiscussSystemPrompt(
    session: ClassroomSession,
    studentId: string,
    taskNum: number,
    interactionType: 'probeReply' | 'followUpReply',
  ): Promise<string> {
    const lesson = await this.lessonRepo.findOne({ where: { id: session.lessonId } });
    if (!lesson) return this.aiPromptBuilder.buildDiscussFallbackPrompt(interactionType);

    const manifest = JSON.parse(lesson.manifestJson);
    const readingSteps = manifest.readingSteps || [];
    const taskMap = buildTaskMap(manifest);
    const stepIdx = taskMap.taskToStep[taskNum] ?? taskNum;
    const stepDef = readingSteps.find((s: any) => s.idx === stepIdx);

    // Load submission for L4 context
    const submission = await this.submissionRepo.findOne({
      where: { sessionId: session.id, studentId, step: stepIdx },
    });

    // L4.5: Prior observation context — inject recent LLM observations for this student
    // Strip anchor codes since the discuss LLM has no indicator definitions
    const studentLog = this.observationService.getStudentLog(session.id, studentId);
    let priorObservationContext: string | null = null;
    if (studentLog?.events.length) {
      const relevantEvents = studentLog.events
        .filter(e => e.source === 'llm')
        .slice(-3)
        .map(e => `- ${e.gist}`)
        .join('\n');
      if (relevantEvents) {
        priorObservationContext = relevantEvents;
      }
    }

    return this.aiPromptBuilder.buildDiscussSystemPrompt(
      manifest, stepDef, submission, interactionType, priorObservationContext,
    );
  }

  private async initObservation(sessionId: string, lessonId: string): Promise<void> {
    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId } });
    if (!lesson) return;
    try {
      const manifest = JSON.parse(lesson.manifestJson);
      let indicators = manifest.observationIndicators || [];

      // Fallback: read indicators from filesystem manifest if DB manifest lacks them
      if (indicators.length === 0) {
        try {
          const diskPath = path.resolve(process.cwd(), '../data/lessons', lessonId, 'manifest.json');
          if (fs.existsSync(diskPath)) {
            const diskManifest = JSON.parse(fs.readFileSync(diskPath, 'utf-8'));
            indicators = diskManifest.observationIndicators || [];
          }
        } catch { /* disk read failed, continue without indicators */ }
      }

      if (indicators.length > 0) {
        this.observationService.initSession(sessionId, indicators);
      }

      // Observer engine: set session metadata
      this.engine.setSessionMeta(sessionId, { indicators, lessonId });
    } catch { /* noop */ }
  }

  private generateCode(): string {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_CHARS[randomInt(CODE_CHARS.length)];
    }
    return code;
  }

  private async broadcast(sessionId: string) {
    const subs = this.subscribers.get(sessionId);
    if (!subs || subs.size === 0) return;

    const state = await this.getState(sessionId);
    const payload = `data: ${JSON.stringify(state)}\n\n`;

    for (const res of subs) {
      try {
        res.write(payload);
      } catch {
        subs.delete(res);
        const timer = this.heartbeatTimers.get(res);
        if (timer) {
          clearInterval(timer);
          this.heartbeatTimers.delete(res);
        }
      }
    }
  }

  broadcastNamed(sessionId: string, eventName: string, payload: any) {
    const subs = this.subscribers.get(sessionId);
    if (!subs || subs.size === 0) return;

    const message = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;

    for (const res of subs) {
      try {
        res.write(message);
      } catch {
        subs.delete(res);
        const timer = this.heartbeatTimers.get(res);
        if (timer) {
          clearInterval(timer);
          this.heartbeatTimers.delete(res);
        }
      }
    }
  }
}
