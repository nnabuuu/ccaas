import { Controller, Post, Param, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ClassroomService } from '../../application/classroom/classroom.service';
import { AiAskService } from '../../application/ai/ai-ask.service';
import { AiAskDto } from './dto/ai-ask.dto';
import { validateCode } from '../../domain/classroom/validate-code';

@ApiTags('classroom')
@Controller('classroom')
export class AiAskController {
  constructor(
    private readonly classroomService: ClassroomService,
    private readonly aiAskService: AiAskService,
  ) {}

  @Post(':code/ai/ask')
  async aiAsk(@Param('code') code: string, @Body() dto: AiAskDto) {
    const session = await this.classroomService.resolveStartedSession(validateCode(code));
    const result = await this.aiAskService.aiAsk(session, dto.studentId, dto.step, dto.question, dto.messages);
    this.classroomService.broadcast(session.id);
    return { answer: result.answer, category: result.category };
  }
}
