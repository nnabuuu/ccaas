import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Res,
  Query,
} from '@nestjs/common';
import { Response } from 'express';
import { v4 as uuid } from 'uuid';
import { SessionsService } from './sessions.service';
import { SseService } from '../sse/sse.service';
import { PRESET_STUDENTS } from '../content/students';

@Controller('sessions')
export class SessionsController {
  constructor(
    private sessionsService: SessionsService,
    private sseService: SseService,
  ) {}

  @Post()
  createSession(@Body() body: { teacherId: string }) {
    return this.sessionsService.createSession(body.teacherId);
  }

  @Get(':id')
  getSession(@Param('id') id: string) {
    return this.sessionsService.getSession(id);
  }

  @Get(':id/roster')
  getRoster() {
    return PRESET_STUDENTS;
  }

  @Post(':id/join')
  joinSession(
    @Param('id') id: string,
    @Body() body: { studentId: string },
  ) {
    // Look up name from preset roster
    const preset = PRESET_STUDENTS.find((s) => s.id === body.studentId);
    const studentName = preset?.name || body.studentId;
    return this.sessionsService.joinSession(id, body.studentId, studentName);
  }

  @Patch(':id/status')
  endSession(@Param('id') id: string) {
    return this.sessionsService.endSession(id);
  }

  @Get(':id/students')
  getStudents(@Param('id') id: string) {
    return this.sessionsService.getStudentsWithProgress(id);
  }

  @Post(':id/broadcast')
  broadcast(
    @Param('id') id: string,
    @Body()
    body: {
      studentSessionId: string;
      artifactType: 'writing' | 't1' | 't2';
      versionId?: string;
    },
  ) {
    return this.sessionsService.broadcast(id, body);
  }

  @Post(':id/broadcast/end')
  endBroadcast(@Param('id') id: string) {
    this.sessionsService.endBroadcast(id);
    return { ok: true };
  }

  @Get(':id/insights/:sceneId')
  getInsights(
    @Param('id') id: string,
    @Param('sceneId') sceneId: string,
  ) {
    return this.sessionsService.getInsights(id, sceneId);
  }

  @Get(':id/stream')
  stream(
    @Param('id') id: string,
    @Query('subscriberId') subscriberId: string,
    @Res() res: Response,
  ) {
    const subId = subscriberId || uuid();
    this.sseService.subscribeTeacher(id, subId, res);
  }
}
