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
import { ExerciseService } from '../exercise/exercise.service';
import type { ExerciseSpec } from '../../schemas';

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
    private readonly exerciseService: ExerciseService,
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

  async getExerciseSpec(code: string): Promise<ExerciseSpec & { step: number }> {
    const session = await this.resolveSession(code);
    const spec = await this.exerciseService.getExerciseSpec(session, session.currentStep);
    return { ...spec, step: session.currentStep };
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

    const nextAttempt = (await this.attemptRepo.maxAttempt(session.id, studentId)) + 1;
    const saved = await this.attemptRepo.insert({
      sessionId: session.id,
      lessonId: session.lessonId,
      studentId,
      step,
      attempt: nextAttempt,
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
