import { Controller, Post, Param, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ClassroomService } from '../classroom.service';
import { AiAskService } from './ai-ask.service';
import { AiAskDto } from './dto/ai-ask.dto';
import { validateCode } from '../validate-code';

@ApiTags('classroom')
@Controller('classroom')
export class AiAskController {
  constructor(
    private readonly classroomService: ClassroomService,
    private readonly aiAskService: AiAskService,
  ) {}

  @Post(':code/ai/ask')
  async aiAsk(@Param('code') code: string, @Body() dto: AiAskDto) {
    const session = await this.classroomService.resolveActiveSession(validateCode(code));
    const result = await this.aiAskService.aiAsk(session, dto.studentId, dto.step, dto.question);
    this.classroomService.broadcast(session.id);
    return { answer: result.answer, category: result.category };
  }
}
