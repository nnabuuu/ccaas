import { Controller, Post, Param, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ClassroomService } from '../classroom.service';
import { DiscussService } from './discuss.service';
import { AiDiscussDto, DiscussCompleteDto } from './dto/ai-discuss.dto';
import { validateCode } from '../validate-code';

@ApiTags('classroom')
@Controller('classroom')
export class DiscussController {
  constructor(
    private readonly classroomService: ClassroomService,
    private readonly discussService: DiscussService,
  ) {}

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
