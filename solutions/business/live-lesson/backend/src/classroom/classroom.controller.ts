import { Controller, Get, Post, Param, Body, Res, Query, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ClassroomService } from './classroom.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { JoinDto } from './dto/join.dto';
import { SubmitDto } from './dto/submit.dto';
import { StepDto } from './dto/step.dto';
import { NotifyDto } from './dto/notify.dto';
import { AiAskDto } from './dto/ai-ask.dto';

const CODE_RE = /^[A-Z2-9]{6}$/;

function validateCode(code: string): string {
  const upper = code.toUpperCase();
  if (!CODE_RE.test(upper)) {
    throw new BadRequestException('Invalid session code format');
  }
  return upper;
}

@ApiTags('classroom')
@Controller('classroom')
export class ClassroomController {
  constructor(private readonly classroomService: ClassroomService) {}

  // ── Session lifecycle ──

  @Post('sessions')
  createSession(@Body() dto: CreateSessionDto) {
    return this.classroomService.createSession(dto.lessonId);
  }

  @Get('sessions/:code')
  getSession(@Param('code') code: string) {
    return this.classroomService.getSessionInfo(validateCode(code));
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
    return this.classroomService.join(session, dto.name);
  }

  @Post(':code/submit')
  async submit(@Param('code') code: string, @Body() dto: SubmitDto) {
    const session = await this.classroomService.resolveActiveSession(validateCode(code));
    return this.classroomService.submit(session, dto.studentId, dto.step, dto.data);
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

  @Post(':code/ai/ask')
  async aiAsk(@Param('code') code: string, @Body() dto: AiAskDto) {
    const session = await this.classroomService.resolveActiveSession(validateCode(code));
    const result = await this.classroomService.aiAsk(session, dto.studentId, dto.step, dto.question);
    return { answer: result.answer, category: result.category };
  }
}
