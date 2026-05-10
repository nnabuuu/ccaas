import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Student } from '../entities/student.entity';
import { Submission } from '../entities/submission.entity';
import { ClassroomSession } from '../entities/classroom-session.entity';
import { AiQuestion } from '../entities/ai-question.entity';
import { Lesson } from '../entities/lesson.entity';
import { ObservationQueryService } from './observation/observation-query.service';
import { MetricsAggregator } from './metrics-aggregator';
import { ClusterAggregator } from './socratic-discuss/cluster-aggregator';
import { CoachingService } from './coaching.service';
import { ManifestCacheService } from './manifest-cache.service';
import { buildTaskMap } from './task-map.utils';
import { resolveObserve, buildRegistry, resolveGlobalObservations, type ResolvedObserve, type ObservationDef } from '../schemas';
import type {
  ClassroomStateResponse,
} from '../schemas/classroom';

/**
 * State aggregation layer for the classroom.
 * Owns getState(), getSurfaces(), and the in-memory maps they depend on.
 */
@Injectable()
export class ClassroomStateService {
  private readonly logger = new Logger(ClassroomStateService.name);
  private activeNotificationsMap = new Map<string, Map<string, { id: string; message: string; notifyType: string; timestamp: string }>>();
  private observeRegistryCache = new Map<string, Record<string, ObservationDef>>();

  constructor(
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Submission)
    private readonly submissionRepo: Repository<Submission>,
    @InjectRepository(ClassroomSession)
    private readonly sessionRepo: Repository<ClassroomSession>,
    @InjectRepository(AiQuestion)
    private readonly aiQuestionRepo: Repository<AiQuestion>,
    private readonly metricsAggregator: MetricsAggregator,
    private readonly clusterAggregator: ClusterAggregator,
    private readonly observationQuery: ObservationQueryService,
    private readonly coachingService: CoachingService,
    private readonly manifestCache: ManifestCacheService,
  ) {}

  private get lessonRepo(): Repository<Lesson> {
    return this.sessionRepo.manager.getRepository(Lesson);
  }

  // ── Notification map operations ──

  toggleNotification(sessionId: string, id: string, message: string, notifyType: string): boolean {
    if (!this.activeNotificationsMap.has(sessionId)) {
      this.activeNotificationsMap.set(sessionId, new Map());
    }
    const sessionNotifs = this.activeNotificationsMap.get(sessionId)!;

    if (sessionNotifs.has(id)) {
      sessionNotifs.delete(id);
      return false; // was active, now revoked
    } else {
      const timestamp = new Date().toISOString();
      sessionNotifs.set(id, { id, message, notifyType, timestamp });
      return true; // newly activated
    }
  }

  getActiveNotifications(sessionId: string): Array<{ id: string; message: string; notifyType: string; timestamp: string }> {
    return Array.from(
      (this.activeNotificationsMap.get(sessionId) ?? new Map()).values(),
    );
  }

  clearNotifications(sessionId: string): void {
    this.activeNotificationsMap.delete(sessionId);
  }

  // ── Session cleanup (aggregated) ──

  cleanupSession(sessionId: string, lessonId: string): void {
    this.activeNotificationsMap.delete(sessionId);
    this.observationQuery.clearSession(sessionId);
    this.clusterAggregator.cleanupSession(sessionId);
    this.coachingService.cleanupSession(sessionId);
    this.observeRegistryCache.delete(lessonId);
  }

  // ── State aggregation ──

  async getState(sessionId: string, currentStep?: number): Promise<ClassroomStateResponse> {
    const students = await this.studentRepo.find({
      where: { sessionId },
      order: { joinedAt: 'ASC' },
    });

    const submissions = await this.submissionRepo.find({
      where: { sessionId, phase: 'exercise' },
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
      try {
        manifest = await this.manifestCache.getManifest(session.lessonId, this.lessonRepo);
      } catch (e) {
        this.logger.error(`Failed to load manifest for lesson ${session.lessonId}: ${e}`);
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

    // Cluster stats per task step
    const clusterStats: Record<number, { definitions: Array<{ id: string; label: string }>; clusters: ReturnType<ClusterAggregator['getClusterStats']> }> = {};
    for (let taskNum = 1; taskNum <= taskMap.maxTask; taskNum++) {
      const stepIdx = taskMap.taskToStep[taskNum];
      const stepDef = readingSteps.find((s) => s.idx === stepIdx) as Record<string, any> | undefined;
      const defs: Array<{ id: string; label: string; description: string }> = stepDef?.discuss?.clusters || [];
      const stats = this.clusterAggregator.getClusterStats(sessionId, taskNum);
      if (defs.length > 0 || stats.length > 0) {
        clusterStats[taskNum] = {
          definitions: defs.map(d => ({ id: d.id, label: d.label })),
          clusters: stats,
        };
      }
    }

    return {
      sessionStatus: session?.status ?? 'active',
      currentStep: stepToCheck,
      activeNotifications: this.getActiveNotifications(sessionId),
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

        const bonusSubs = [101, 102].filter(step => subs[step]);
        const bonusStatus: 'none' | 'active' | 'completed' =
          bonusSubs.length === 0 ? 'none'
          : bonusSubs.length >= 2 ? 'completed'
          : 'active';

        return {
          id: s.id,
          name: s.name,
          currentTask: s.currentTask,
          currentPhase: s.currentPhase,
          stepStartedAt: s.stepStartedAt,
          status,
          submissions: enrichedSubs,
          stepHistory,
          discussMeta: s.discussMeta ?? null,
          bonusStatus,
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
        ...(await this.observationQuery.getObservationDashboard(sessionId)),
        indicators: this.observationQuery.getIndicators(sessionId),
      },
      clusterStats,
      coaching: {
        highlights: this.coachingService.getHighlights(sessionId),
        llmInsights: this.coachingService.getCached(sessionId),
      },
    };
  }

  // ── Surfaces (on-demand observe data) ──

  async getSurfaces(sessionId: string, taskNum: number) {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');

    let manifest: Record<string, unknown> | null = null;
    if (session.lessonId) {
      try {
        manifest = await this.manifestCache.getManifest(session.lessonId, this.lessonRepo);
      } catch (e) {
        this.logger.error(`Failed to load manifest for lesson ${session.lessonId}: ${e}`);
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
    const submissions = await this.submissionRepo.find({ where: { sessionId, phase: 'exercise' } });
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

  // ── Init observation (called by ClassroomService) ──

  async initObservation(sessionId: string, lessonId: string): Promise<void> {
    try {
      let manifest = await this.manifestCache.getManifest(lessonId, this.lessonRepo);
      if (!manifest) return;

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
        } catch (e) { this.logger.warn(`Disk manifest read failed for ${lessonId}: ${e}`); }
      }

      const indicators = resolveGlobalObservations(manifest)
        .filter((d): d is typeof d & { id: string; label: string; type: 'knowledge' | 'misconception'; description: string } =>
          !!d.id && !!d.label && !!d.type && !!d.description,
        );

      if (indicators.length > 0) {
        this.observationQuery.setIndicators(sessionId, indicators);
      }

      this.observeRegistryCache.set(lessonId, buildRegistry(manifest));
    } catch (e) {
      this.logger.warn(`Observation init parse/setup failed for ${lessonId}: ${e}`);
    }
  }
}
