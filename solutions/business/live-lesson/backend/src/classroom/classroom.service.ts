import { Injectable, Inject, Logger, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThan } from 'typeorm';
import { randomInt } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Student } from '../entities/student.entity';
import { Submission } from '../entities/submission.entity';
import { ClassroomSession } from '../entities/classroom-session.entity';
import { AiQuestion } from '../entities/ai-question.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { ClassroomSnapshot } from '../entities/classroom-snapshot.entity';
import { Lesson } from '../entities/lesson.entity';
import { ObservationService } from './observation/observation.service';
import { MetricsAggregator } from './metrics-aggregator';
import { OBSERVER_ENGINE, type ObserverEngine } from '@kedge-agentic/observer-engine';
import { buildTaskMap } from './task-map.utils';
import { resolveObserve, buildRegistry, resolveGlobalObservations, type ResolvedObserve, type ObservationDef } from '../schemas';
import type { Response } from 'express';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 30 chars, no 0/O/1/I/L
const CODE_LENGTH = 6;

@Injectable()
export class ClassroomService {
  private readonly logger = new Logger(ClassroomService.name);
  private subscribers = new Map<string, Set<Response>>();
  private heartbeatTimers = new Map<Response, NodeJS.Timeout>();
  private activeNotificationsMap = new Map<string, Map<string, { id: string; message: string; notifyType: string; timestamp: string }>>();
  private lastSnapshotAt = new Map<string, number>();
  private readonly SNAPSHOT_THROTTLE_MS = 10_000;
  private observeRegistryCache = new Map<string, Record<string, ObservationDef>>();

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
    @InjectRepository(ChatMessage)
    private readonly chatMessageRepo: Repository<ChatMessage>,
    @InjectRepository(ClassroomSnapshot)
    private readonly snapshotRepo: Repository<ClassroomSnapshot>,
    private readonly observationService: ObservationService,
    private readonly metricsAggregator: MetricsAggregator,
    @Inject(OBSERVER_ENGINE) private readonly engine: ObserverEngine,
  ) {}

  private get lessonRepo(): Repository<Lesson> {
    return this.sessionRepo.manager.getRepository(Lesson);
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

  async resolveStartedSession(code: string): Promise<ClassroomSession> {
    const session = await this.resolveSession(code);
    if (session.status !== 'active') {
      throw new BadRequestException(
        session.status === 'ended' ? 'Session has ended' : 'Session has not started yet',
      );
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
    await this.broadcast(session.id);
    this.activeNotificationsMap.delete(session.id);
    this.lastSnapshotAt.delete(session.id);

    this.observationService.cleanupSession(session.id).catch(e =>
      this.logger.warn(`Observation cleanup failed: ${e}`),
    );

    this.engine.clearSessionMeta(session.id);
    this.observeRegistryCache.delete(session.lessonId);

    this.logger.log(`Session ended: ${code}`);
    return { ok: true, status: 'ended' };
  }

  // ── State aggregation ──

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

    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    const stepToCheck = currentStep ?? session?.currentStep ?? 0;

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

    const questions = await this.aiQuestionRepo.find({
      where: { sessionId },
      order: { askedAt: 'ASC' },
    });

    const studentDurations = this.metricsAggregator.computeStudentDurations(students, subsByStudent, taskMap);
    const registry = (session?.lessonId && this.observeRegistryCache.get(session.lessonId)) || buildRegistry(manifest);
    const readingSteps: Array<Record<string, unknown>> = manifest?.readingSteps || [];
    const resolvedObserves: Record<number, ResolvedObserve> = {};
    for (let taskNum = 1; taskNum <= taskMap.maxTask; taskNum++) {
      const stepIdx = taskMap.taskToStep[taskNum];
      const stepDef = readingSteps.find((s) => s.idx === stepIdx);
      resolvedObserves[taskNum] = resolveObserve(stepDef, registry);
    }
    const stepMetrics = this.metricsAggregator.buildStepMetrics(total, students, subsByStudent, questions, studentDurations, manifest, taskMap, resolvedObserves);
    const medianTimes = this.metricsAggregator.extractMedianTimes(stepMetrics);

    const studentStatuses = new Map<string, string>();
    for (const s of students) {
      studentStatuses.set(s.id, this.metricsAggregator.computeStudentStatus(s, subsByStudent.get(s.id), medianTimes, taskMap));
    }

    for (let taskNum = 1; taskNum <= taskMap.maxTask; taskNum++) {
      stepMetrics[taskNum].alertTag = this.metricsAggregator.computeAlertTag(
        taskNum, stepMetrics[taskNum], students, studentStatuses,
      );
    }

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

        const stepHistory: Record<number, any> = {};
        for (let taskNum = 1; taskNum <= taskMap.maxTask; taskNum++) {
          const taskStepIdx = taskMap.taskToStep[taskNum];
          const sub = subs[taskStepIdx];
          const aiCount = questions.filter(q => q.studentId === s.id && q.step === taskStepIdx).length;

          if (sub && (s.currentTask > taskNum || s.currentPhase === 'completed')) {
            const score = sub.score;
            const dur = durations[taskStepIdx];
            stepHistory[taskNum] = {
              status: 'done',
              result: this.metricsAggregator.deriveResult(score),
              time: dur != null ? this.metricsAggregator.formatDuration(dur) : null,
              aiRounds: aiCount,
            };
          } else if (s.currentTask === taskNum) {
            const isStuck = studentStatuses.get(s.id) === 'stuck';
            const score = sub?.score;
            const dur = sub ? durations[taskStepIdx] : undefined;
            stepHistory[taskNum] = {
              status: isStuck ? 'stuck' : (s.currentPhase === 'listen' ? 'reading' : 'prog'),
              aiRounds: aiCount,
              ...(sub ? { result: this.metricsAggregator.deriveResult(score), time: dur != null ? this.metricsAggregator.formatDuration(dur) : null } : {}),
            };
          } else if (s.currentTask > taskNum || s.currentPhase === 'completed') {
            stepHistory[taskNum] = { status: 'done', aiRounds: aiCount };
          } else {
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

  // ── Chat history ──

  async getChatHistory(
    sessionId: string,
    studentId: string,
    threadId?: string,
  ): Promise<Record<string, Array<{ role: string; content: string; seq: number; createdAt: string }>>> {
    const where: { sessionId: string; studentId: string; threadId?: string } = { sessionId, studentId };
    if (threadId) where.threadId = threadId;
    const messages = await this.chatMessageRepo.find({ where, order: { seq: 'ASC' } });
    const grouped: Record<string, Array<{ role: string; content: string; seq: number; createdAt: string }>> = {};
    for (const m of messages) {
      if (!grouped[m.threadId]) grouped[m.threadId] = [];
      grouped[m.threadId].push({
        role: m.role,
        content: m.content,
        seq: m.seq,
        createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : String(m.createdAt),
      });
    }
    return grouped;
  }

  // ── Surfaces (on-demand observe data) ──

  async getSurfaces(sessionId: string, taskNum: number) {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');

    let manifest: Record<string, unknown> | null = null;
    if (session.lessonId) {
      const lesson = await this.lessonRepo.findOne({ where: { id: session.lessonId } });
      if (lesson) {
        try { manifest = JSON.parse(lesson.manifestJson); } catch {}
      }
    }
    const taskMap = buildTaskMap(manifest);
    const stepIdx = taskMap.taskToStep[taskNum];
    if (stepIdx == null) return {};

    const surfaceRegistry = (session.lessonId && this.observeRegistryCache.get(session.lessonId)) || buildRegistry(manifest);
    const readingSteps = (manifest?.readingSteps || []) as Array<Record<string, unknown>>;
    const stepDef = readingSteps.find((s) => s.idx === stepIdx);
    const resolved = resolveObserve(stepDef, surfaceRegistry);
    if (resolved.surfaces.length === 0) return {};

    const students = await this.studentRepo.find({ where: { sessionId } });
    const submissions = await this.submissionRepo.find({ where: { sessionId } });
    const subsByStudent = new Map<string, Record<number, { step: number; data: unknown; score: unknown; submittedAt: string }>>();
    for (const sub of submissions) {
      if (!subsByStudent.has(sub.studentId)) subsByStudent.set(sub.studentId, {});
      subsByStudent.get(sub.studentId)![sub.step] = {
        step: sub.step,
        data: sub.dataJson,
        score: sub.scoreJson ?? null,
        submittedAt: sub.submittedAt instanceof Date ? sub.submittedAt.toISOString() : String(sub.submittedAt),
      };
    }

    return this.metricsAggregator.buildSurfaces(
      taskNum, subsByStudent, stepIdx, resolved.surfaces,
      students.map(s => ({ id: s.id, name: s.name })),
    );
  }

  // ── SSE ──

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

  // ── Teacher control ──

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

  // ── Broadcast (public — called by controller after domain service mutations) ──

  async broadcast(sessionId: string) {
    const subs = this.subscribers.get(sessionId);
    const state = await this.getState(sessionId);

    // Persist snapshot (throttled) regardless of subscriber count
    this.maybePersistSnapshot(sessionId, state);

    if (!subs || subs.size === 0) return;

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

  // ── Snapshots ──

  private maybePersistSnapshot(sessionId: string, state: Record<string, unknown>): void {
    const now = Date.now();
    const last = this.lastSnapshotAt.get(sessionId) || 0;
    if (now - last < this.SNAPSHOT_THROTTLE_MS) return;
    this.lastSnapshotAt.set(sessionId, now);
    this.snapshotRepo.save(
      this.snapshotRepo.create({
        sessionId,
        capturedAt: new Date(now),
        stateJson: JSON.stringify(state),
      }),
    ).catch(e => this.logger.warn(`Snapshot persist failed: ${e}`));
  }

  async getSnapshots(sessionId: string): Promise<Array<{ capturedAt: string; state: Record<string, unknown> }>> {
    const rows = await this.snapshotRepo.find({
      where: { sessionId },
      order: { capturedAt: 'ASC' },
    });
    return rows.reduce<Array<{ capturedAt: string; state: Record<string, unknown> }>>((acc, r) => {
      try {
        acc.push({
          capturedAt: r.capturedAt instanceof Date ? r.capturedAt.toISOString() : String(r.capturedAt),
          state: JSON.parse(r.stateJson),
        });
      } catch {
        this.logger.warn(`Skipping corrupted snapshot ${r.id}`);
      }
      return acc;
    }, []);
  }

  // ── Private helpers ──

  private async initObservation(sessionId: string, lessonId: string): Promise<void> {
    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId } });
    if (!lesson) return;
    try {
      let manifest = JSON.parse(lesson.manifestJson);

      // Fallback: try disk manifest if DB manifest has no observation data
      const hasObsData = manifest.observations || manifest.observationIndicators || manifest.observeDefinitions;
      if (!hasObsData) {
        try {
          const diskPath = path.resolve(process.cwd(), '../data/lessons', lessonId, 'manifest.json');
          if (fs.existsSync(diskPath)) {
            const diskManifest = JSON.parse(fs.readFileSync(diskPath, 'utf-8'));
            const diskHasObs = diskManifest.observations || diskManifest.observationIndicators || diskManifest.observeDefinitions;
            if (diskHasObs) manifest = diskManifest;
          }
        } catch { /* disk read failed, continue */ }
      }

      const indicators = resolveGlobalObservations(manifest)
        .filter((d): d is typeof d & { id: string; label: string; type: 'knowledge' | 'misconception'; description: string } =>
          !!d.id && !!d.label && !!d.type && !!d.description,
        );

      if (indicators.length > 0) {
        this.observationService.initSession(sessionId, indicators);
      }

      this.observeRegistryCache.set(lessonId, buildRegistry(manifest));
      this.engine.setSessionMeta(sessionId, { indicators, lessonId });
    } catch (e) {
      this.logger.warn(`Observation init parse/setup failed for ${lessonId}: ${e}`);
    }
  }

  private generateCode(): string {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_CHARS[randomInt(CODE_CHARS.length)];
    }
    return code;
  }
}
