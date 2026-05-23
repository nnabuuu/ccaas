import { Controller, Get, Post, Param, Body, ParseIntPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ClassroomService } from '../classroom.service';
import { PersonalizationService } from './personalization.service';
import { PersonalTouchDto } from './dto/personal-touch.dto';
import { BonusCheckDto } from './dto/bonus-check.dto';
import { validateCode } from '../../domain/classroom/validate-code';

@ApiTags('classroom')
@Controller('classroom')
export class PersonalTouchController {
  constructor(
    private readonly classroomService: ClassroomService,
    private readonly personalization: PersonalizationService,
  ) {}

  @Post(':code/personal-touch')
  async personalTouch(@Param('code') code: string, @Body() dto: PersonalTouchDto) {
    const session = await this.classroomService.resolveStartedSession(validateCode(code));
    return this.personalization.getPersonalTouch(session, dto.studentId);
  }

  @Get(':code/students/:studentId/recap')
  async getStudentRecap(
    @Param('code') code: string,
    @Param('studentId') studentId: string,
  ) {
    const session = await this.classroomService.resolveStartedSession(validateCode(code));
    return this.personalization.getStudentRecap(session, studentId);
  }

  @Get(':code/bonus/:bonusStep/exercise')
  async getBonusExercise(
    @Param('code') code: string,
    @Param('bonusStep', ParseIntPipe) bonusStep: number,
  ) {
    const session = await this.classroomService.resolveStartedSession(validateCode(code));
    return this.personalization.getBonusExercise(session, bonusStep);
  }

  @Post(':code/bonus/:bonusStep/check')
  async checkBonusAnswer(
    @Param('code') code: string,
    @Param('bonusStep', ParseIntPipe) bonusStep: number,
    @Body() dto: BonusCheckDto,
  ) {
    const session = await this.classroomService.resolveStartedSession(validateCode(code));
    return this.personalization.checkBonusAnswer(session, dto.studentId, bonusStep, dto.data);
  }
}
