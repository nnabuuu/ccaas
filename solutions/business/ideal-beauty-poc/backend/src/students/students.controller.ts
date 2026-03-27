import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Param,
  Body,
  Res,
  Query,
} from '@nestjs/common';
import { Response } from 'express';
import { StudentsService } from './students.service';
import { SseService } from '../sse/sse.service';

@Controller('students')
export class StudentsController {
  constructor(
    private studentsService: StudentsService,
    private sseService: SseService,
  ) {}

  @Patch(':sid/scene')
  updateScene(
    @Param('sid') sid: string,
    @Body() body: { sceneIdx: number },
  ) {
    return this.studentsService.updateScene(sid, body.sceneIdx);
  }

  // ─── T1 ───

  @Put(':sid/t1')
  saveT1(
    @Param('sid') sid: string,
    @Body() body: { highlights: Record<string, string> },
  ) {
    return this.studentsService.saveT1(sid, body.highlights);
  }

  @Post(':sid/t1/evaluate')
  evaluateT1(@Param('sid') sid: string) {
    return this.studentsService.evaluateT1(sid);
  }

  // ─── T2 ───

  @Put(':sid/t2')
  saveT2(
    @Param('sid') sid: string,
    @Body() body: { pickedTransitions: string[] },
  ) {
    return this.studentsService.saveT2(sid, body.pickedTransitions);
  }

  @Post(':sid/t2/evaluate')
  evaluateT2(@Param('sid') sid: string) {
    return this.studentsService.evaluateT2(sid);
  }

  // ─── Writing versions ───

  @Get(':sid/versions')
  getVersions(@Param('sid') sid: string) {
    return this.studentsService.getVersions(sid);
  }

  @Post(':sid/versions')
  createVersion(
    @Param('sid') sid: string,
    @Body() body: { text: string; sceneId?: 'T3' | 'T4' },
  ) {
    return this.studentsService.createVersion(
      sid,
      body.text,
      body.sceneId || 'T3',
    );
  }

  @Post(':sid/versions/:vid/evaluate')
  evaluateVersion(
    @Param('sid') sid: string,
    @Param('vid') vid: string,
  ) {
    return this.studentsService.evaluateVersion(sid, vid);
  }

  // ─── Help messages ───

  @Get(':sid/help-messages')
  getHelpMessages(@Param('sid') sid: string) {
    return this.studentsService.getHelpMessages(sid);
  }

  @Post(':sid/help-messages')
  sendHelpMessage(
    @Param('sid') sid: string,
    @Body() body: { content: string; sceneId: string },
  ) {
    return this.studentsService.sendHelpMessage(sid, body.content, body.sceneId);
  }

  // ─── Student SSE stream ───

  @Get(':sid/stream')
  stream(
    @Param('sid') sid: string,
    @Query('classSessionId') classSessionId: string,
    @Res() res: Response,
  ) {
    this.sseService.subscribeStudent(sid, classSessionId, res);
  }
}
