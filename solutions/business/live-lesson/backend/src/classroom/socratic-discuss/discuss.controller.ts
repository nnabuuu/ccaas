import { Controller, Get, Post, Param, Body, Query, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ClassroomService } from '../../application/classroom/classroom.service';
import { DiscussService } from '../../application/ai/discuss.service';
import { AiDiscussDto, DiscussCompleteDto } from './dto/ai-discuss.dto';
import { validateCode } from '../../domain/classroom/validate-code';

@ApiTags('classroom')
@Controller('classroom')
export class DiscussController {
  constructor(
    private readonly classroomService: ClassroomService,
    private readonly discussService: DiscussService,
  ) {}

  @Get(':code/discuss-progress')
  async getDiscussProgress(
    @Param('code') code: string,
    @Query('studentId') studentId: string,
    @Query('taskNum') taskNumStr: string,
  ) {
    if (!studentId) throw new BadRequestException('studentId is required');
    const taskNum = parseInt(taskNumStr, 10);
    if (isNaN(taskNum)) throw new BadRequestException('taskNum must be a number');
    const session = await this.classroomService.resolveStartedSession(validateCode(code));
    return this.discussService.getDiscussProgress(session, studentId, taskNum);
  }

  @Post(':code/ai/discuss')
  async aiDiscuss(@Param('code') code: string, @Body() dto: AiDiscussDto) {
    const session = await this.classroomService.resolveStartedSession(validateCode(code));
    const result = await this.discussService.aiDiscuss(
      session,
      dto.studentId,
      dto.taskNum,
      dto.messages,
      dto.round,
      dto.timeUsedSeconds,
    );
    this.classroomService.broadcast(session.id);
    return result;
  }

  @Post(':code/ai/discuss-complete')
  async discussComplete(@Param('code') code: string, @Body() dto: DiscussCompleteDto) {
    const session = await this.classroomService.resolveStartedSession(validateCode(code));
    const result = await this.discussService.discussComplete(
      session,
      dto.studentId,
      dto.taskNum,
      dto.completionType,
      dto.roundsUsed,
      dto.timeUsedSeconds,
      dto.mcSelectedIndex,
    );
    this.classroomService.broadcast(session.id);
    return result;
  }
}
