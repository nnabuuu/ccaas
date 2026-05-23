import { Controller, Get, Inject, Post, Param, Body, Res, Query, BadRequestException, NotFoundException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response } from 'express';
import { ClassroomService } from '../../application/classroom/classroom.service';
import { StudentSubmissionService } from '../../application/classroom/student-submission.service';
import { ObserveRegistry } from '../../application/observation/observe-registry';
import { Lesson } from '../../adapters/persistence/entities/lesson.entity';
import { LESSON_REPO_PORT, type LessonRepoPort } from '../../domain/ports/lesson-repo.port';
import { CreateSessionDto } from './dto/create-session.dto';
import { JoinDto } from './dto/join.dto';
import { SubmitDto } from './dto/submit.dto';
import { PhaseDto } from './dto/phase.dto';
import { StepDto } from './dto/step.dto';
import { NotifyDto } from './dto/notify.dto';
import { validateCode } from '../../domain/classroom/validate-code';
import { ManifestCacheService } from '../../application/classroom/manifest-cache.service';
import { buildTaskMap } from '../../domain/classroom/task-map.utils';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateCodeOrId(value: string): string {
  if (value.length > 6) {
    if (!UUID_RE.test(value)) throw new BadRequestException('Invalid session identifier');
    return value;
  }
  return validateCode(value);
}

@ApiTags('classroom')
@Controller('classroom')
export class ClassroomController {
  constructor(
    private readonly classroomService: ClassroomService,
    private readonly studentSubmission: StudentSubmissionService,
    private readonly observeRegistry: ObserveRegistry,
    private readonly manifestCache: ManifestCacheService,
    @Inject(LESSON_REPO_PORT)
    private readonly lessonRepo: LessonRepoPort,
  ) {}

  // ── Session lifecycle ──

  @Post('sessions')
  createSession(@Body() dto: CreateSessionDto) {
    return this.classroomService.createSession(dto.lessonId);
  }

  @Post('sessions/batch-check')
  batchCheck(@Body() body: { sessionIds: string[]; status?: 'waiting' | 'active' }) {
    const ids = (body.sessionIds || []).filter(id => UUID_RE.test(id)).slice(0, 50);
    return this.classroomService.batchCheckSessions(ids, body.status);
  }

  @Get('sessions')
  listSessions(
    @Query('status') status?: string,
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
  ) {
    const valid = ['waiting', 'active', 'ended'] as const;
    const filtered = valid.find(v => v === status);
    const limit = Math.min(Math.max(parseInt(limitStr || '50', 10) || 50, 1), 200);
    const offset = Math.max(parseInt(offsetStr || '0', 10) || 0, 0);
    return this.classroomService.listSessions(filtered, limit, offset);
  }

  @Get('sessions/:code')
  getSession(@Param('code') code: string) {
    return this.classroomService.getSessionInfo(validateCodeOrId(code));
  }

  @Post('sessions/:code/start')
  startSession(@Param('code') code: string) {
    return this.classroomService.startSession(validateCode(code));
  }

  @Post('sessions/:code/end')
  endSession(@Param('code') code: string) {
    return this.classroomService.endSession(validateCode(code));
  }

  // ── Classroom operations (by session code) ──

  @Post(':code/join')
  async join(@Param('code') code: string, @Body() dto: JoinDto) {
    // join uses resolveActiveSession (not resolveStartedSession) intentionally:
    // students must be able to join during the 'waiting' lobby phase
    const session = await this.classroomService.resolveActiveSession(validateCode(code));
    const { _broadcast, ...result } = await this.studentSubmission.join(session, dto.name);
    if (_broadcast) this.classroomService.broadcast(session.id);
    return result;
  }

  @Post(':code/submit')
  async submit(@Param('code') code: string, @Body() dto: SubmitDto) {
    const session = await this.classroomService.resolveStartedSession(validateCode(code));
    const result = await this.studentSubmission.submit(session, dto.studentId, dto.step, dto.data);
    this.classroomService.broadcast(session.id);
    return result;
  }

  @Post(':code/phase')
  async updatePhase(@Param('code') code: string, @Body() dto: PhaseDto) {
    const session = await this.classroomService.resolveStartedSession(validateCode(code));
    await this.studentSubmission.updatePhase(session, dto.studentId, dto.task, dto.phase);
    this.classroomService.broadcast(session.id);
    return { ok: true };
  }

  @Get(':code/students/:studentId/submissions/:step')
  async getSubmission(
    @Param('code') code: string,
    @Param('studentId') studentId: string,
    @Param('step') step: string,
  ) {
    if (!studentId || !UUID_RE.test(studentId)) {
      throw new BadRequestException('studentId must be a valid UUID');
    }
    const parsedStep = parseInt(step, 10);
    if (isNaN(parsedStep) || parsedStep < 0) {
      throw new BadRequestException('step must be a non-negative number');
    }
    const session = await this.classroomService.resolveSession(validateCodeOrId(code));
    return this.studentSubmission.getSubmission(session, studentId, parsedStep);
  }

  @Get(':code/students/:studentId/progress')
  async getStudentProgress(
    @Param('code') code: string,
    @Param('studentId') studentId: string,
    @Query('include') include?: string,
  ) {
    if (!studentId || !UUID_RE.test(studentId)) {
      throw new BadRequestException('studentId must be a valid UUID');
    }
    const session = await this.classroomService.resolveSession(validateCodeOrId(code));
    return this.studentSubmission.getProgress(session, studentId, include === 'submissions');
  }

  @Get(':code/chat-history')
  async getChatHistory(
    @Param('code') code: string,
    @Query('studentId') studentId: string,
    @Query('threadId') threadId?: string,
  ) {
    if (!studentId) throw new BadRequestException('studentId is required');
    if (threadId && !/^(discuss|continue):\d+$|^translate:\d+:[a-f0-9]{8}$/.test(threadId)) {
      throw new BadRequestException('Invalid threadId format');
    }
    const session = await this.classroomService.resolveSession(validateCode(code));
    return this.classroomService.getChatHistory(session.id, studentId, threadId);
  }

  @Get(':code/snapshots')
  async getSnapshots(@Param('code') code: string) {
    const session = await this.classroomService.resolveSession(validateCode(code));
    return this.classroomService.getSnapshots(session.id);
  }

  @Get(':code/steps/:step/surfaces')
  async getSurfaces(
    @Param('code') code: string,
    @Param('step') step: string,
  ) {
    const parsedStep = parseInt(step, 10);
    if (isNaN(parsedStep) || parsedStep < 1) {
      throw new BadRequestException('step must be a positive number');
    }
    const session = await this.classroomService.resolveSession(validateCode(code));
    return this.classroomService.getSurfaces(session.id, parsedStep);
  }

  @Get(':code/state')
  async getState(
    @Param('code') code: string,
    @Query('step') step?: string,
  ) {
    const session = await this.classroomService.resolveSession(validateCode(code));
    const parsedStep = step ? parseInt(step, 10) : undefined;
    if (parsedStep !== undefined && isNaN(parsedStep)) {
      throw new BadRequestException('step must be a number');
    }
    return this.classroomService.getState(session.id, parsedStep);
  }

  @Get(':code/stream')
  async stream(@Param('code') code: string, @Res() res: Response) {
    const session = await this.classroomService.resolveSession(validateCode(code));
    this.classroomService.subscribe(session.id, res);
  }

  // ── Observe endpoints ──

  @Get(':code/steps/:step/observe/:type')
  async getObserve(
    @Param('code') code: string,
    @Param('step') step: string,
    @Param('type') type: string,
    @Query('view') view?: string,
    @Query('partIds') partIdsRaw?: string,
  ) {
    const parsedStep = parseInt(step, 10);
    if (isNaN(parsedStep) || parsedStep < 1) {
      throw new BadRequestException('step must be a positive number');
    }
    const session = await this.classroomService.resolveSession(validateCode(code));

    // Load manifest to get answerKey
    const { manifest, taskMap } = await this.loadManifestForSession(session);
    const stepIdx = taskMap.taskToStep[parsedStep];
    if (stepIdx == null) throw new NotFoundException('Step not found');

    type StepDef = { idx: number; answerKey?: unknown; discoveryKey?: unknown };
    const readingSteps: StepDef[] = (manifest?.readingSteps as StepDef[]) || [];
    const stepDef = readingSteps.find(s => s.idx === stepIdx);

    // When type='guided-discovery', prefer discoveryKey over answerKey
    let answerKey: import('../../schemas/answer-key.schema').AnswerKey | null;
    if (type === 'guided-discovery' && stepDef?.discoveryKey) {
      answerKey = (stepDef.discoveryKey as import('../../schemas/answer-key.schema').AnswerKey) ?? null;
    } else {
      answerKey = (stepDef?.answerKey as import('../../schemas/answer-key.schema').AnswerKey) ?? null;
    }

    const partIds = partIdsRaw ? partIdsRaw.split(',').filter(Boolean) : undefined;

    const { students, subsByStudent } = await this.observeRegistry.loadObserveData(session.id);

    return this.observeRegistry.compute(type, {
      sessionId: session.id,
      lessonId: session.lessonId,
      students,
      subsByStudent,
      stepIdx,
      answerKey,
      view: view === 'first' ? 'first' : 'latest',
      partIds,
    });
  }

  /** Load manifest helper used by observe endpoint */
  private async loadManifestForSession(session: { lessonId: string }): Promise<{ manifest: Record<string, unknown>; taskMap: ReturnType<typeof buildTaskMap> }> {
    const manifest = await this.manifestCache.getManifest(session.lessonId, this.lessonRepo);
    if (!manifest) throw new NotFoundException('Lesson not found');
    return { manifest, taskMap: buildTaskMap(manifest) };
  }

  @Post(':code/step')
  async setStep(@Param('code') code: string, @Body() dto: StepDto) {
    const session = await this.classroomService.resolveStartedSession(validateCode(code));
    return this.classroomService.setStep(session.id, dto.step);
  }

  @Post(':code/notify')
  async notify(@Param('code') code: string, @Body() dto: NotifyDto) {
    const session = await this.classroomService.resolveStartedSession(validateCode(code));
    return this.classroomService.notify(session.id, dto.message, dto.type);
  }
}
