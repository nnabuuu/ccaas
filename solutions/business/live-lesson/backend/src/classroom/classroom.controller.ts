import { Controller, Get, Post, Param, Body, Res, Query, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ClassroomService } from './classroom.service';
import { StudentSubmissionService } from './student-submission.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { JoinDto } from './dto/join.dto';
import { SubmitDto } from './dto/submit.dto';
import { StepDto } from './dto/step.dto';
import { NotifyDto } from './dto/notify.dto';
import { validateCode } from './validate-code';

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
    const session = await this.classroomService.resolveActiveSession(validateCode(code));
    const { _broadcast, ...result } = await this.studentSubmission.join(session, dto.name);
    if (_broadcast) this.classroomService.broadcast(session.id);
    return result;
  }

  @Post(':code/submit')
  async submit(@Param('code') code: string, @Body() dto: SubmitDto) {
    const session = await this.classroomService.resolveActiveSession(validateCode(code));
    const result = await this.studentSubmission.submit(session, dto.studentId, dto.step, dto.data);
    this.classroomService.broadcast(session.id);
    return result;
  }

  @Get(':code/chat-history')
  async getChatHistory(
    @Param('code') code: string,
    @Query('studentId') studentId: string,
    @Query('threadId') threadId?: string,
  ) {
    if (!studentId) throw new BadRequestException('studentId is required');
    if (threadId && !/^(discuss|continue):\d+$/.test(threadId)) {
      throw new BadRequestException('Invalid threadId format');
    }
    const session = await this.classroomService.resolveSession(validateCode(code));
    return this.classroomService.getChatHistory(session.id, studentId, threadId);
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

  @Post(':code/step')
  async setStep(@Param('code') code: string, @Body() dto: StepDto) {
    const session = await this.classroomService.resolveActiveSession(validateCode(code));
    return this.classroomService.setStep(session.id, dto.step);
  }

  @Post(':code/notify')
  async notify(@Param('code') code: string, @Body() dto: NotifyDto) {
    const session = await this.classroomService.resolveActiveSession(validateCode(code));
    return this.classroomService.notify(session.id, dto.message, dto.type);
  }
}
