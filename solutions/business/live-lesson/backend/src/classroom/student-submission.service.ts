import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../entities/student.entity';
import { Submission } from '../entities/submission.entity';
import { ClassroomSession } from '../entities/classroom-session.entity';
import { Lesson } from '../entities/lesson.entity';
import { GradingService } from './exercise/grading.service';
import { ManifestCacheService } from './manifest-cache.service';
import { StateCacheService } from './state-cache.service';
import { OBSERVER_ENGINE, type ObserverEngine } from '@kedge-agentic/observer-engine';
import type { GradeResult, RichContentQuizAnswerKey, RichContentPart } from '../schemas';
import { getCachedTaskMap } from './task-map.utils';
import { buildCheckItems } from './exercise/build-check-items';
import type { JoinResponse, SubmitResponse, SubmissionResponse, StudentProgressResponse } from '../schemas/classroom';

@Injectable()
export class StudentSubmissionService {
  private readonly logger = new Logger(StudentSubmissionService.name);

  constructor(
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Submission)
    private readonly submissionRepo: Repository<Submission>,
    private readonly gradingService: GradingService,
    private readonly manifestCache: ManifestCacheService,
    private readonly stateCache: StateCacheService,
    @Inject(OBSERVER_ENGINE) private readonly engine: ObserverEngine,
  ) {}

  private get lessonRepo(): Repository<Lesson> {
    return this.studentRepo.manager.getRepository(Lesson);
  }

  async join(session: ClassroomSession, name: string): Promise<JoinResponse> {
    const existing = await this.studentRepo.findOne({
      where: { sessionId: session.id, name },
    });
    if (existing) {
      return { studentId: existing.id, name: existing.name, lessonId: session.lessonId, _broadcast: true };
    }

    const student = this.studentRepo.create({
      sessionId: session.id,
      lessonId: session.lessonId,
      name,
    });
    const saved = await this.studentRepo.save(student);
    this.stateCache.markDirty(session.id);

    this.engine.dispatch({
      type: 'student_join',
      sessionId: session.id,
      entityId: saved.id,
      tenantId: session.lessonId,
      payload: { studentName: saved.name },
    }).catch(err => this.logger.error(`Observer dispatch student_join failed: ${err}`));

    return { studentId: saved.id, name: saved.name, lessonId: session.lessonId, _broadcast: true };
  }

  async submit(session: ClassroomSession, studentId: string, step: number, data: Record<string, unknown>): Promise<SubmitResponse> {
    const student = await this.studentRepo.findOne({
      where: { id: studentId, sessionId: session.id },
    });
    if (!student) {
      throw new NotFoundException('Student not found in this session');
    }

    const phase = data?.phase === 'discuss' ? 'discuss' : 'exercise';

    // Check for parts-based submission
    const partId = typeof data?.partId === 'string' ? data.partId : undefined;
    if (phase === 'exercise' && partId) {
      // Pass shortcut: student acknowledged scaffold and wants to proceed
      if (data._pass) {
        return this.passPart(session, student, step, partId);
      }
      return this.submitPart(session, student, step, data, partId);
    }

    const score = phase === 'exercise'
      ? await this.gradeSubmission(session.lessonId, step, data)
      : null;

    await this.submissionRepo.upsert(
      {
        sessionId: session.id,
        lessonId: session.lessonId,
        studentId,
        step,
        phase,
        dataJson: data as any,
        scoreJson: score as any,
      },
      ['sessionId', 'studentId', 'step', 'phase'],
    );
    this.stateCache.markDirty(session.id);

    // Observation events only for exercise submissions — discuss has its own events in DiscussService
    if (phase === 'exercise') {
      this.dispatchExerciseEvents(session, studentId, step, score, data);

      // Auto-advance: if advanceOn === 'submit' and score is 100%, advance to discuss
      const taskMap = await getCachedTaskMap(session.lessonId, this.lessonRepo);
      const taskNum = taskMap.stepToTask[step];
      if (score?.total === 100 && taskMap.advanceOn[step] === 'submit' && taskNum !== undefined) {
        await this.updatePhase(session, studentId, taskNum, 'discuss');
        const updated = await this.studentRepo.findOne({ where: { id: studentId, sessionId: session.id } });
        return { ok: true, score, currentTask: updated?.currentTask ?? taskNum, currentPhase: updated?.currentPhase ?? 'discuss' };
      }
    }

    return { ok: true, score, currentTask: student.currentTask, currentPhase: student.currentPhase };
  }

  /**
   * Handle a part-level submission for rich-content-quiz with parts.
   * Grades only the specified part, manages scaffold attempts, merges into submission.
   */
  private async submitPart(
    session: ClassroomSession,
    student: Student,
    step: number,
    data: Record<string, unknown>,
    partId: string,
  ): Promise<SubmitResponse> {
    const manifest = await this.manifestCache.getManifest(session.lessonId, this.lessonRepo);
    if (!manifest) {
      return { ok: false, score: null, currentTask: student.currentTask, currentPhase: student.currentPhase };
    }
    const readingSteps = manifest.readingSteps || [];
    const stepDef = readingSteps.find((s: any) => s.idx === step);
    const answerKey = stepDef?.answerKey as RichContentQuizAnswerKey | undefined;
    if (!answerKey?.parts || answerKey.type !== 'rich-content-quiz') {
      return { ok: false, score: null, currentTask: student.currentTask, currentPhase: student.currentPhase };
    }

    const partDef = answerKey.parts.find(p => p.id === partId);
    if (!partDef) {
      return { ok: false, score: null, currentTask: student.currentTask, currentPhase: student.currentPhase };
    }

    // Load existing submission to get parts progress
    const existingSub = await this.submissionRepo.findOne({
      where: { sessionId: session.id, studentId: student.id, step, phase: 'exercise' },
    });
    const existingData = (existingSub?.dataJson as Record<string, unknown>) ?? {};
    const partsProgress: Record<string, any> = (existingData.parts as Record<string, any>) ?? {};
    const partProgress = partsProgress[partId] ?? { attempts: 0, completed: false, scaffoldLevel: -1 };

    // Grade this part by constructing a synthetic image-upload answer key
    const syntheticKey = {
      type: 'image-upload' as const,
      prompt: partDef.prompt,
      rubric: partDef.rubric,
      sampleSolution: partDef.sampleSolution,
      aiSystemPrompt: partDef.aiSystemPrompt ?? answerKey.aiSystemPrompt,
    };
    const partScore = await this.gradingService.grade(syntheticKey, data) ?? { total: 0, byDimension: {} };

    partProgress.attempts += 1;

    // Preserve attempt history for teacher review (Gap 1 + Gap 5: method tracking)
    if (!partProgress.attemptsHistory) partProgress.attemptsHistory = [];
    partProgress.attemptsHistory.push({
      version: partProgress.attempts,
      images: data.images as string[],
      method: (data.method as string) ?? 'photo',
      score: partScore,
      submittedAt: new Date().toISOString(),
    });

    partProgress.images = data.images;     // latest (backward compat)
    partProgress.score = partScore;        // latest

    // Check scaffold
    let scaffoldResponse: SubmitResponse['scaffold'] = null;
    if (partDef.scaffold && partScore.total <= partDef.scaffold.threshold) {
      const nextLevel = partProgress.scaffoldLevel + 1;
      if (nextLevel < partDef.scaffold.levels.length) {
        partProgress.scaffoldLevel = nextLevel;
        partProgress.completed = false;
        const isLastLevel = nextLevel === partDef.scaffold.levels.length - 1;
        scaffoldResponse = {
          level: nextLevel,
          hintZh: partDef.scaffold.levels[nextLevel].hintZh,
          hintImage: partDef.scaffold.levels[nextLevel].hintImage,
          canRetry: !isLastLevel,
        };
      } else {
        // All scaffold levels exhausted — mark as completed
        partProgress.completed = true;
      }
    } else {
      partProgress.completed = true;
    }

    // Update parts progress
    partsProgress[partId] = partProgress;

    // Determine next part
    const partIds = answerKey.parts.map(p => p.id);
    const currentIdx = partIds.indexOf(partId);
    let nextPartId: string | null = null;
    if (partProgress.completed) {
      for (let i = currentIdx + 1; i < partIds.length; i++) {
        if (!partsProgress[partIds[i]]?.completed) {
          nextPartId = partIds[i];
          break;
        }
      }
    }

    // Compute aggregate score across all completed parts
    const aggregateScore = this.computeAggregateScore(answerKey.parts, partsProgress);

    // Merge data for storage — only pick known fields from user data
    const mergedData: Record<string, unknown> = {
      ...existingData,
      images: data.images,
      method: data.method,
      parts: partsProgress,
      currentPartId: partProgress.completed ? (nextPartId ?? partId) : partId,
    };

    const allCompleted = answerKey.parts.every(p => partsProgress[p.id]?.completed);

    await this.submissionRepo.upsert(
      {
        sessionId: session.id,
        lessonId: session.lessonId,
        studentId: student.id,
        step,
        phase: 'exercise',
        dataJson: mergedData as any,
        scoreJson: (allCompleted ? aggregateScore : partScore) as any,
      },
      ['sessionId', 'studentId', 'step', 'phase'],
    );
    this.stateCache.markDirty(session.id);

    if (allCompleted) {
      this.dispatchExerciseEvents(session, student.id, step, aggregateScore, mergedData);

      const taskMap = await getCachedTaskMap(session.lessonId, this.lessonRepo);
      const taskNum = taskMap.stepToTask[step];
      if (aggregateScore.total === 100 && taskMap.advanceOn[step] === 'submit' && taskNum !== undefined) {
        await this.updatePhase(session, student.id, taskNum, 'discuss');
        const updated = await this.studentRepo.findOne({ where: { id: student.id, sessionId: session.id } });
        return {
          ok: true, score: aggregateScore,
          currentTask: updated?.currentTask ?? taskNum, currentPhase: updated?.currentPhase ?? 'discuss',
          partId, nextPartId: null,
        };
      }
    }

    return {
      ok: true,
      score: partScore,
      currentTask: student.currentTask,
      currentPhase: student.currentPhase,
      partId,
      ...(scaffoldResponse && { scaffold: scaffoldResponse }),
      nextPartId: partProgress.completed ? nextPartId : null,
    };
  }

  /**
   * Handle a pass action — student acknowledged scaffold and wants to proceed.
   * Marks the part as completed without grading.
   */
  private async passPart(
    session: ClassroomSession,
    student: Student,
    step: number,
    partId: string,
  ): Promise<SubmitResponse> {
    const manifest = await this.manifestCache.getManifest(session.lessonId, this.lessonRepo);
    if (!manifest) {
      return { ok: false, score: null, currentTask: student.currentTask, currentPhase: student.currentPhase };
    }
    const readingSteps = manifest.readingSteps || [];
    const stepDef = readingSteps.find((s: any) => s.idx === step);
    const answerKey = stepDef?.answerKey as RichContentQuizAnswerKey | undefined;
    if (!answerKey?.parts || answerKey.type !== 'rich-content-quiz') {
      return { ok: false, score: null, currentTask: student.currentTask, currentPhase: student.currentPhase };
    }

    // Load existing submission
    const existingSub = await this.submissionRepo.findOne({
      where: { sessionId: session.id, studentId: student.id, step, phase: 'exercise' },
    });
    const existingData = (existingSub?.dataJson as Record<string, unknown>) ?? {};
    const partsProgress: Record<string, any> = (existingData.parts as Record<string, any>) ?? {};
    const partProgress = partsProgress[partId] ?? { attempts: 0, completed: false, scaffoldLevel: -1 };

    // Guard: only allow pass if student has actually seen a scaffold
    if (partProgress.scaffoldLevel < 0) {
      return { ok: false, score: null, currentTask: student.currentTask, currentPhase: student.currentPhase };
    }

    // Mark as completed without incrementing attempts
    partProgress.completed = true;
    partsProgress[partId] = partProgress;

    // Determine next part
    const partIds = answerKey.parts.map(p => p.id);
    const currentIdx = partIds.indexOf(partId);
    let nextPartId: string | null = null;
    for (let i = currentIdx + 1; i < partIds.length; i++) {
      if (!partsProgress[partIds[i]]?.completed) {
        nextPartId = partIds[i];
        break;
      }
    }

    const allCompleted = answerKey.parts.every(p => partsProgress[p.id]?.completed);
    const aggregateScore = this.computeAggregateScore(answerKey.parts, partsProgress);

    const mergedData: Record<string, unknown> = {
      ...existingData,
      parts: partsProgress,
      currentPartId: nextPartId ?? partId,
    };

    await this.submissionRepo.upsert(
      {
        sessionId: session.id,
        lessonId: session.lessonId,
        studentId: student.id,
        step,
        phase: 'exercise',
        dataJson: mergedData as any,
        scoreJson: (allCompleted ? aggregateScore : (partProgress.score ?? null)) as any,
      },
      ['sessionId', 'studentId', 'step', 'phase'],
    );
    this.stateCache.markDirty(session.id);

    if (allCompleted) {
      this.dispatchExerciseEvents(session, student.id, step, aggregateScore, mergedData);

      const taskMap = await getCachedTaskMap(session.lessonId, this.lessonRepo);
      const taskNum = taskMap.stepToTask[step];
      if (aggregateScore.total === 100 && taskMap.advanceOn[step] === 'submit' && taskNum !== undefined) {
        await this.updatePhase(session, student.id, taskNum, 'discuss');
        const updated = await this.studentRepo.findOne({ where: { id: student.id, sessionId: session.id } });
        return {
          ok: true, score: aggregateScore,
          currentTask: updated?.currentTask ?? taskNum, currentPhase: updated?.currentPhase ?? 'discuss',
          partId, nextPartId: null,
        };
      }
    }

    return {
      ok: true,
      score: partProgress.score ?? null,
      currentTask: student.currentTask,
      currentPhase: student.currentPhase,
      partId,
      nextPartId,
    };
  }

  /** Compute weighted aggregate score from all completed parts. */
  private computeAggregateScore(parts: RichContentPart[], partsProgress: Record<string, any>): GradeResult {
    let totalWeight = 0;
    let weightedSum = 0;
    const byDimension: Record<string, number | boolean> = {};

    for (const part of parts) {
      const pp = partsProgress[part.id];
      if (!pp?.score) continue;

      const partWeight = part.rubric.reduce((sum, r) => sum + r.weight, 0);
      totalWeight += partWeight;
      weightedSum += (pp.score.total / 100) * partWeight;

      // Namespace dimensions by part id
      for (const [key, val] of Object.entries(pp.score.byDimension || {})) {
        byDimension[`${part.id}_${key}`] = val as number | boolean;
      }
    }

    return {
      total: totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 0,
      byDimension,
    };
  }

  /** Dispatch observer events for exercise submission. */
  private dispatchExerciseEvents(
    session: ClassroomSession, studentId: string, step: number,
    score: GradeResult | null, data: Record<string, unknown>,
  ): void {
    this.engine.dispatch({
      type: 'exercise_result',
      sessionId: session.id,
      entityId: studentId,
      tenantId: session.lessonId,
      payload: { step, score: score?.total ?? null },
    }).catch(err => this.logger.error(`Observer dispatch exercise_result failed: ${err}`));

    getCachedTaskMap(session.lessonId, this.lessonRepo).then(taskMap => {
      const taskNum = taskMap.stepToTask[step];
      return this.studentRepo.findOne({ where: { id: studentId, sessionId: session.id } }).then(s => {
        if (s && taskNum !== undefined && s.currentTask > taskNum) {
          return this.engine.dispatch({
            type: 'step_complete',
            sessionId: session.id,
            entityId: studentId,
            tenantId: session.lessonId,
            payload: { step, taskNum, nextTask: s.currentTask },
          });
        }
      });
    }).catch(err => this.logger.error(`Observer dispatch step_complete pipeline failed: ${err}`));

    const exerciseCorrectRate = score?.total ?? 0;
    this.engine.dispatch({
      type: 'chat_turn',
      sessionId: session.id,
      entityId: studentId,
      tenantId: session.lessonId,
      payload: { student: JSON.stringify(data), ai: `得分 ${exerciseCorrectRate}%`, step },
    }).catch(err => this.logger.error(`Observer dispatch chat_turn failed: ${err}`));
  }

  private static readonly PHASE_RANK: Record<string, number> = { listen: 0, practice: 1, discuss: 2, takeaway: 3, completed: 4 };

  /**
   * Compute phase rank dynamically — supports step-level phaseConfig (e.g. practice-1, practice-2).
   * Falls back to lesson-level phaseConfig, then static PHASE_RANK.
   */
  private async getPhaseRank(session: ClassroomSession, task: number, phase: string): Promise<number> {
    const manifest = await this.manifestCache.getManifest(session.lessonId, this.lessonRepo);
    if (manifest) {
      const taskMap = await getCachedTaskMap(session.lessonId, this.lessonRepo);
      const stepIdx = taskMap.taskToStep?.[task];
      if (stepIdx !== undefined) {
        const step = (manifest.readingSteps || []).find((s: any) => s.idx === stepIdx);
        const stepPhases = step?.phaseConfig as Array<{ id: string }> | undefined;
        if (stepPhases?.length) {
          const idx = stepPhases.findIndex(p => p.id === phase);
          if (idx >= 0) return idx;
        }
      }
      const lessonPhases = manifest.phaseConfig as Array<{ id: string }> | undefined;
      if (lessonPhases?.length) {
        const idx = lessonPhases.findIndex(p => p.id === phase);
        if (idx >= 0) return idx;
      }
    }
    return StudentSubmissionService.PHASE_RANK[phase] ?? 0;
  }

  async updatePhase(session: ClassroomSession, studentId: string, task: number, phase: string) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const student = await this.studentRepo.findOne({
        where: { id: studentId, sessionId: session.id },
      });
      if (!student) {
        throw new NotFoundException('Student not found in this session');
      }
      const oldRank = (student.currentTask * 10) + await this.getPhaseRank(session, student.currentTask, student.currentPhase);
      const newRank = (task * 10) + await this.getPhaseRank(session, task, phase);
      if (newRank <= oldRank) return;
      const taskChanged = student.currentTask !== task;
      student.currentTask = task;
      student.currentPhase = phase;
      if (taskChanged) {
        student.stepStartedAt = new Date().toISOString();
        student.discussMeta = null;
      }
      try {
        await this.studentRepo.save(student);
        this.stateCache.markDirty(session.id);
        return;
      } catch (e: any) {
        if (e.name === 'OptimisticLockVersionMismatchError') continue;
        throw e;
      }
    }
    this.logger.warn(`updatePhase failed after 3 retries for student ${studentId}`);
  }

  async getProgress(session: ClassroomSession, studentId: string, includeSubmissions?: boolean): Promise<StudentProgressResponse | null> {
    const student = await this.studentRepo.findOne({
      where: { id: studentId, sessionId: session.id },
    });
    if (!student) return null;

    const result: StudentProgressResponse = { currentTask: student.currentTask, currentPhase: student.currentPhase, discussMeta: student.discussMeta ?? null };
    if (includeSubmissions) {
      result.submissions = await this.buildSubmissionMap(session.id, session.lessonId, studentId);
    }
    return result;
  }

  private async buildSubmissionMap(
    sessionId: string, lessonId: string, studentId: string,
  ): Promise<Record<number, { data: unknown; score: GradeResult | null; checkItems?: Array<Record<string, unknown>> }>> {
    const submissions = await this.submissionRepo.find({
      where: { sessionId, studentId, phase: 'exercise' },
    });

    // Load manifest once to recompute checkItems from persisted data
    const manifest = await this.manifestCache.getManifest(lessonId, this.lessonRepo);
    const readingSteps: Array<Record<string, unknown>> = manifest?.readingSteps || [];

    const map: Record<number, { data: unknown; score: GradeResult | null; checkItems?: Array<Record<string, unknown>> }> = {};
    for (const sub of submissions) {
      const score = (sub.scoreJson as GradeResult) ?? null;
      let checkItems: Array<Record<string, unknown>> | undefined;

      if (score) {
        const stepDef = readingSteps.find((s) => s.idx === sub.step);
        if (stepDef?.answerKey) {
          try {
            checkItems = buildCheckItems(stepDef.answerKey as Record<string, unknown>, sub.dataJson as Record<string, unknown>, score);
          } catch (e) {
            this.logger.debug(`buildCheckItems failed for step ${sub.step}: ${e}`);
          }
        }
      }

      map[sub.step] = { data: sub.dataJson, score, ...(checkItems && { checkItems }) };
    }
    return map;
  }

  async getSubmission(session: ClassroomSession, studentId: string, step: number): Promise<SubmissionResponse | null> {
    const sub = await this.submissionRepo.findOne({
      where: { sessionId: session.id, studentId, step, phase: 'exercise' },
    });
    if (!sub) return null;
    return {
      data: sub.dataJson,
      score: sub.scoreJson ?? null,
      submittedAt: sub.submittedAt instanceof Date
        ? sub.submittedAt.toISOString()
        : String(sub.submittedAt),
    };
  }

  private async gradeSubmission(lessonId: string, step: number, data: Record<string, unknown>): Promise<GradeResult | null> {
    try {
      const manifest = await this.manifestCache.getManifest(lessonId, this.lessonRepo);
      if (!manifest) return null;

      const readingSteps = manifest.readingSteps || [];
      const stepDef = readingSteps.find((s: any) => s.idx === step);
      if (!stepDef || !stepDef.answerKey) return null;

      return await this.gradingService.grade(stepDef.answerKey, data);
    } catch (e) {
      this.logger.warn(`Grading failed for step ${step}: ${e}`);
      return null;
    }
  }
}
