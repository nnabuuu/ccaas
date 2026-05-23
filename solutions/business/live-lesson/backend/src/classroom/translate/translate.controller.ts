import { Controller, Post, Param, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ClassroomService } from '../../application/classroom/classroom.service';
import { TranslateService } from '../../application/ai/translate.service';
import { TranslateDto } from './dto/translate.dto';
import { TranslateChatDto } from './dto/translate-chat.dto';
import { validateCode } from '../../domain/classroom/validate-code';

@ApiTags('classroom')
@Controller('classroom')
export class TranslateController {
  constructor(
    private readonly classroomService: ClassroomService,
    private readonly translateService: TranslateService,
  ) {}

  @Post(':code/translate')
  async translate(@Param('code') code: string, @Body() dto: TranslateDto) {
    const session = await this.classroomService.resolveStartedSession(validateCode(code));
    return this.translateService.translate(
      session, dto.studentId, dto.text, dto.step, dto.sourceContext, dto.phase,
    );
  }

  @Post(':code/translate/chat')
  async translateChat(@Param('code') code: string, @Body() dto: TranslateChatDto) {
    const session = await this.classroomService.resolveStartedSession(validateCode(code));
    return this.translateService.translateChat(
      session, dto.studentId, dto.step, dto.originalText, dto.question, dto.sourceContext,
    );
  }
}
