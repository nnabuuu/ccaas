import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomInt } from 'crypto';
import {
  CLASSROOM_SESSION_REPO_PORT,
  type ClassroomSessionRepoPort,
} from '../../domain/ports/classroom-session-repo.port';
import { STUDENT_REPO_PORT, type StudentRepoPort } from '../../domain/ports/student-repo.port';
import {
  TASK_DEMO_ATTEMPT_REPO_PORT,
  type RespondentSummary,
  type TaskDemoAttemptRecord,
  type TaskDemoAttemptRepoPort,
} from '../../domain/ports/task-demo-attempt-repo.port';
import { LESSON_REPO_PORT, type LessonRepoPort } from '../../domain/ports/lesson-repo.port';
import { ExerciseService } from '../exercise/exercise.service';
import { ExerciseTypeRegistry } from '../exercise/exercise-type-registry';
import { GradingService } from '../exercise/grading.service';
import { ManifestCacheService } from '../classroom/manifest-cache.service';
import { computeScaffoldResponse, type ScaffoldResponse } from '../../domain/exercise-types/rich-content-quiz/scaffold-logic';
import { computeRcqAggregateScore } from '../../domain/exercise-types/rich-content-quiz/aggregate-score';
import type { ExerciseSpec, RichContentPart, RichContentQuizAnswerKey } from '../../schemas';

// Shared with ClassroomService (same alphabet — 30 chars, no 0/O/1/I/L).
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

export interface CreateTaskDemoResult {
  code: string;
  sessionId: string;
  lessonId: string;
  step: number;
}

export interface ClaimResult {
  studentId: string;
  name: string;
}

export interface SubmitTaskDemoResult {
  attempt: number;
  score: Record<string, any> | null;
  allCorrect: boolean;
  items: Array<Record<string, any>>;
  submittedAt: string;
  // ── rich-content-quiz parts flow only (omitted for other types) ──
  partId?: string;
  scaffold?: ScaffoldResponse | null;
  nextPartId?: string | null;
  sampleSolution?: string | null;
}

export interface Respondent extends RespondentSummary {
  name: string;
}

export interface ReplayEntry {
  attempt: number;
  data: Record<string, any>;
  score: Record<string, any> | null;
  checkItems: Array<Record<string, any>>;
  submittedAt: string;
}

@Injectable()
export class TaskDemoService {
  private readonly logger = new Logger(TaskDemoService.name);

  constructor(
    @Inject(CLASSROOM_SESSION_REPO_PORT)
    private readonly sessionRepo: ClassroomSessionRepoPort,
    @Inject(STUDENT_REPO_PORT)
    private readonly studentRepo: StudentRepoPort,
    @Inject(TASK_DEMO_ATTEMPT_REPO_PORT)
    private readonly attemptRepo: TaskDemoAttemptRepoPort,
    @Inject(LESSON_REPO_PORT)
    private readonly lessonRepo: LessonRepoPort,
    private readonly exerciseService: ExerciseService,
    private readonly manifestCache: ManifestCacheService,
    private readonly exerciseRegistry: ExerciseTypeRegistry,
    private readonly gradingService: GradingService,
  ) {}

  // ── Lifecycle ──

  async create(lessonId: string, step: number): Promise<CreateTaskDemoResult> {
    // Auto-active so the existing `resolveActiveSession` invariant holds and
    // /claim + /submit don't need a separate "start" call from the caller.
    // Store the task's step in currentStep so /exercise + /submit recover it
    // without needing a new column.
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = generateCode();
      try {
        const saved = await this.sessionRepo.insert({ code, lessonId, status: 'active' });
        await this.sessionRepo.update(saved.id, { currentStep: step });
        this.logger.log(`task-demo session created: ${saved.code} (lesson=${lessonId}, step=${step})`);
        return { code: saved.code, sessionId: saved.id, lessonId: saved.lessonId, step };
      } catch (err: any) {
        if (err?.message?.includes('UNIQUE') || err?.code === 'SQLITE_CONSTRAINT') continue;
        throw err;
      }
    }
    throw new ConflictException('Failed to generate unique session code');
  }

  // ── Per-respondent flows ──

  async claim(code: string, user: string): Promise<ClaimResult> {
    const session = await this.resolveSession(code);
    const name = normalizeName(user);
    const existing = await this.studentRepo.findBySessionAndName(session.id, name);
    if (existing) {
      return { studentId: existing.id, name: existing.name };
    }
    const created = await this.studentRepo.insert({
      sessionId: session.id,
      lessonId: session.lessonId,
      name,
    });
    return { studentId: created.id, name: created.name };
  }

  async getExerciseSpec(code: string): Promise<
    ExerciseSpec & {
      step: number;
      lessonId: string;
      /**
       * Full sanitized lesson manifest. Frontend decides what to render in
       * the right panel: manifest.article → TextPanel; manifest.boardData
       * → BoardInline; readingSteps[step].studentView → instruction header;
       * etc. Returning the whole manifest (sanitized) is cheaper than
       * shipping a custom shape per task type.
       */
      manifest: Record<string, unknown>;
    }
  > {
    const session = await this.resolveSession(code);
    const spec = await this.exerciseService.getExerciseSpec(session, session.currentStep);

    const rawManifest = await this.manifestCache.getManifest(session.lessonId, this.lessonRepo);
    if (!rawManifest) {
      // Should never happen — getExerciseSpec above would have thrown first.
      throw new Error('Lesson manifest not found');
    }
    const sanitized = this.exerciseRegistry.sanitizeManifest(rawManifest) as Record<string, unknown>;

    return {
      ...spec,
      step: session.currentStep,
      lessonId: session.lessonId,
      manifest: sanitized,
    };
  }

  async submit(
    code: string,
    studentId: string,
    data: Record<string, unknown>,
  ): Promise<SubmitTaskDemoResult> {
    const session = await this.resolveSession(code);

    // Validate the student belongs to this session before recording anything.
    const student = await this.studentRepo.findBySessionAndId(session.id, studentId);
    if (!student) throw new NotFoundException('Student not found in this session');

    // Rich-content-quiz parts flow — multi-part scaffold-driven grading.
    // Mirror of StudentSubmissionService.submit() dispatch (`student-
    // submission.service.ts:64-74`): partId in payload → submitPart;
    // partId + _pass → passPart (acknowledge scaffold and proceed).
    const partId = typeof data.partId === 'string' ? data.partId : undefined;
    if (partId) {
      if (data._pass === true) {
        return this.passPart(session, studentId, partId);
      }
      return this.submitPart(session, studentId, data, partId);
    }

    const step = session.currentStep;
    // Reuse production grading path — sanitize/registry/grader all unchanged.
    const checkResult = await this.exerciseService.checkAnswer(session, studentId, step, data);

    // Derive a per-item % from checkItems so partial credit shows up in the
    // replay timeline (e.g. 2/3 → 67%, not 0%). For types where the grader
    // didn't return items, fall back to allCorrect ? 100 : 0.
    const items = (checkResult.items ?? []) as Array<{ correct?: boolean }>;
    const total = items.length > 0
      ? Math.round((items.filter((i) => i.correct === true).length / items.length) * 100)
      : (checkResult.allCorrect ? 100 : 0);

    // Race-guarded append (helper handles UNIQUE-violation retry).
    const saved = await this.insertWithRetry({
      sessionId: session.id,
      lessonId: session.lessonId,
      studentId,
      step,
      dataJson: data as Record<string, any>,
      scoreJson: { total },
      checkItemsJson: (checkResult.items ?? []) as Array<Record<string, any>>,
    });

    return {
      attempt: saved.attempt,
      score: saved.scoreJson,
      allCorrect: checkResult.allCorrect,
      items: checkResult.items ?? [],
      submittedAt: saved.submittedAt.toISOString(),
    };
  }

  // ── Rich-content-quiz parts flow ──

  /**
   * Per-part submission. Mirrors StudentSubmissionService.submitPart but
   * writes to task_demo_attempts (append-only) instead of reading_submissions
   * (UPSERT). Prior partsProgress is recovered from the most recent attempt
   * for (session, student); the new attempt carries the merged state forward.
   */
  private async submitPart(
    session: { id: string; lessonId: string; currentStep: number },
    studentId: string,
    data: Record<string, unknown>,
    partId: string,
  ): Promise<SubmitTaskDemoResult> {
    const step = session.currentStep;
    const partDef = await this.resolvePartDef(session.lessonId, step, partId);

    // Recover prior partsProgress from the most recent attempt for this
    // student (task_demo_attempts is append-only — every submit is its own
    // row, the latest row carries the most up-to-date progress).
    const prior = await this.attemptRepo.findLatestByStudent(session.id, studentId);
    const priorParts = (prior?.dataJson?.parts as Record<string, any> | undefined) ?? {};
    const partProgress = priorParts[partId] ?? { attempts: 0, completed: false, scaffoldLevel: -1 };

    // Grade by constructing a synthetic image-upload key from this part —
    // identical to production submitPart so the same plugin grader (vision
    // LLM for handwriting/photos) runs.
    const syntheticKey: Record<string, unknown> = {
      type: 'image-upload',
      prompt: partDef.prompt,
      rubric: partDef.rubric,
      sampleSolution: partDef.sampleSolution,
      aiSystemPrompt: partDef.aiSystemPrompt,
      accepts: partDef.accepts,
    };
    const partScore = (await this.gradingService.grade(syntheticKey, data)) ?? {
      total: 0,
      byDimension: {},
    };

    partProgress.attempts = (partProgress.attempts ?? 0) + 1;
    if (!partProgress.attemptsHistory) partProgress.attemptsHistory = [];
    partProgress.attemptsHistory.push({
      version: partProgress.attempts,
      images: data.images as string[] | undefined,
      method: (data.method as string | undefined) ?? 'photo',
      score: partScore,
      submittedAt: new Date().toISOString(),
    });
    partProgress.images = data.images;
    partProgress.score = partScore;

    // Use shared scaffold helper (same call as production submitPart).
    const isCorrect = partScore.total >= 100;
    const scaffoldOut = computeScaffoldResponse({
      partDef,
      prevScaffoldLevel: partProgress.scaffoldLevel,
      isCorrect,
      llmFeedback: partScore.llmFeedback,
    });
    partProgress.scaffoldLevel = scaffoldOut.nextScaffoldLevel;
    partProgress.completed = scaffoldOut.completed;
    if (partProgress.completed && partDef.sampleSolution) {
      partProgress.sampleSolution = partDef.sampleSolution;
    }

    const partsProgress = { ...priorParts, [partId]: partProgress };

    const allParts = await this.resolveAllParts(session.lessonId, step);
    const nextPartId = this.computeNextPartId(allParts, partsProgress, partId, partProgress.completed);
    const allCompleted = allParts.every((p) => partsProgress[p.id]?.completed);
    const aggregate = allCompleted ? computeRcqAggregateScore(allParts, partsProgress) : null;

    const mergedData: Record<string, any> = {
      ...data,
      parts: partsProgress,
      currentPartId: partProgress.completed ? (nextPartId ?? partId) : partId,
    };

    const saved = await this.insertWithRetry({
      sessionId: session.id,
      lessonId: session.lessonId,
      studentId,
      step,
      dataJson: mergedData,
      scoreJson: (allCompleted ? aggregate : partScore) as Record<string, any>,
      checkItemsJson: null,
    });

    return {
      attempt: saved.attempt,
      score: saved.scoreJson,
      allCorrect: allCompleted && (aggregate?.total ?? 0) === 100,
      items: [],
      submittedAt: saved.submittedAt.toISOString(),
      partId,
      scaffold: scaffoldOut.scaffold,
      nextPartId: partProgress.completed ? nextPartId : null,
      sampleSolution: partProgress.completed ? (partDef.sampleSolution ?? null) : null,
    };
  }

  /** Student saw a scaffold and chose to skip — mark this part completed
   *  without grading. Guard: only valid AFTER at least one scaffold was
   *  shown (matches production passPart). */
  private async passPart(
    session: { id: string; lessonId: string; currentStep: number },
    studentId: string,
    partId: string,
  ): Promise<SubmitTaskDemoResult> {
    const step = session.currentStep;
    const partDef = await this.resolvePartDef(session.lessonId, step, partId);

    const prior = await this.attemptRepo.findLatestByStudent(session.id, studentId);
    const priorParts = (prior?.dataJson?.parts as Record<string, any> | undefined) ?? {};
    const partProgress = priorParts[partId];
    if (!partProgress || (partProgress.scaffoldLevel ?? -1) < 0) {
      throw new BadRequestException('Cannot pass a part before any scaffold has been shown');
    }

    partProgress.completed = true;
    if (partDef.sampleSolution) partProgress.sampleSolution = partDef.sampleSolution;
    const partsProgress = { ...priorParts, [partId]: partProgress };

    const allParts = await this.resolveAllParts(session.lessonId, step);
    const nextPartId = this.computeNextPartId(allParts, partsProgress, partId, true);
    const allCompleted = allParts.every((p) => partsProgress[p.id]?.completed);
    const aggregate = allCompleted ? computeRcqAggregateScore(allParts, partsProgress) : null;

    const mergedData: Record<string, any> = {
      partId,
      _pass: true,
      parts: partsProgress,
      currentPartId: nextPartId ?? partId,
    };

    const saved = await this.insertWithRetry({
      sessionId: session.id,
      lessonId: session.lessonId,
      studentId,
      step,
      dataJson: mergedData,
      scoreJson: (allCompleted ? aggregate : (partProgress.score ?? null)) as Record<string, any> | null,
      checkItemsJson: null,
    });

    return {
      attempt: saved.attempt,
      score: saved.scoreJson,
      allCorrect: allCompleted && (aggregate?.total ?? 0) === 100,
      items: [],
      submittedAt: saved.submittedAt.toISOString(),
      partId,
      nextPartId,
      sampleSolution: partDef.sampleSolution ?? null,
    };
  }

  private async resolvePartDef(lessonId: string, step: number, partId: string): Promise<RichContentPart> {
    const manifest = await this.manifestCache.getManifest(lessonId, this.lessonRepo);
    if (!manifest) throw new NotFoundException('Lesson not found');
    const steps: Array<Record<string, unknown>> = (manifest.readingSteps ?? []) as any;
    const stepDef = steps.find((s) => s.idx === step);
    const ak = stepDef?.answerKey as RichContentQuizAnswerKey | undefined;
    if (!ak || ak.type !== 'rich-content-quiz' || !ak.parts) {
      throw new BadRequestException('Step does not declare a rich-content-quiz with parts');
    }
    const partDef = ak.parts.find((p) => p.id === partId);
    if (!partDef) throw new NotFoundException(`Part "${partId}" not found at step ${step}`);
    return partDef;
  }

  private async resolveAllParts(lessonId: string, step: number): Promise<RichContentPart[]> {
    const manifest = await this.manifestCache.getManifest(lessonId, this.lessonRepo);
    const steps: Array<Record<string, unknown>> = (manifest?.readingSteps ?? []) as any;
    const stepDef = steps.find((s) => s.idx === step);
    const ak = stepDef?.answerKey as RichContentQuizAnswerKey | undefined;
    return ak?.parts ?? [];
  }

  private computeNextPartId(
    allParts: RichContentPart[],
    partsProgress: Record<string, any>,
    currentPartId: string,
    currentCompleted: boolean,
  ): string | null {
    if (!currentCompleted) return null;
    const ids = allParts.map((p) => p.id);
    const idx = ids.indexOf(currentPartId);
    for (let i = idx + 1; i < ids.length; i++) {
      if (!partsProgress[ids[i]]?.completed) return ids[i];
    }
    return null;
  }

  /** Insert a new TaskDemoAttempt row using the existing race-guarded retry
   *  loop (same as the main submit path) — shared between the
   *  single-shot and parts flows. */
  private async insertWithRetry(rec: {
    sessionId: string;
    lessonId: string;
    studentId: string;
    step: number;
    dataJson: Record<string, any>;
    scoreJson: Record<string, any> | null;
    checkItemsJson: Array<Record<string, any>> | null;
  }) {
    for (let tries = 0; tries < 5; tries++) {
      const nextAttempt = (await this.attemptRepo.maxAttempt(rec.sessionId, rec.studentId)) + 1;
      try {
        return await this.attemptRepo.insert({ ...rec, attempt: nextAttempt });
      } catch (err: any) {
        const isUniqueViolation = err?.message?.includes('UNIQUE')
          || err?.code === 'SQLITE_CONSTRAINT'
          || err?.code === '23505';
        if (!isUniqueViolation) throw err;
      }
    }
    throw new ConflictException('Could not record submission — too many concurrent attempts');
  }

  // ── Admin / replay views ──

  async listRespondents(code: string): Promise<Respondent[]> {
    const session = await this.resolveSession(code);
    const summaries = await this.attemptRepo.summarizeBySession(session.id);

    // Hydrate names from Student (one lookup per respondent — fine for demo scale).
    const out: Respondent[] = [];
    for (const s of summaries) {
      const student = await this.studentRepo.findBySessionAndId(session.id, s.studentId);
      out.push({ ...s, name: student?.name ?? '(unknown)' });
    }
    return out;
  }

  async getReplay(code: string, studentId: string): Promise<ReplayEntry[]> {
    const session = await this.resolveSession(code);
    const attempts = await this.attemptRepo.findByStudent(session.id, studentId);
    return attempts.map(toReplayEntry);
  }

  // ── Helpers ──

  private async resolveSession(code: string) {
    const session = await this.sessionRepo.findByCode(code);
    if (!session) throw new NotFoundException('Session not found');
    if (session.status === 'ended') throw new BadRequestException('Session has ended');
    return session;
  }
}

function generateCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[randomInt(CODE_CHARS.length)];
  }
  return code;
}

/** Normalize before lookup so "Alice" and "alice" map to the same student. */
function normalizeName(user: string): string {
  return user.trim().toLowerCase().slice(0, 40);
}

function toReplayEntry(rec: TaskDemoAttemptRecord): ReplayEntry {
  return {
    attempt: rec.attempt,
    data: rec.dataJson,
    score: rec.scoreJson,
    checkItems: rec.checkItemsJson ?? [],
    submittedAt: rec.submittedAt.toISOString(),
  };
}

