import { Controller, Get, Post, Param, Body, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ClassroomService } from '../classroom.service';
import { ExerciseService } from './exercise.service';
import { CheckDto } from './dto/check.dto';
import { validateCode } from '../../domain/classroom/validate-code';

@ApiTags('classroom')
@Controller('classroom')
export class ExerciseController {
  constructor(
    private readonly classroomService: ClassroomService,
    private readonly exercise: ExerciseService,
  ) {}

  @Get(':code/steps/:step/exercise')
  async getExercise(
    @Param('code') code: string,
    @Param('step', ParseIntPipe) step: number,
    @Query('studentId') studentId?: string,
    @Query('exerciseType') exerciseType?: string,
  ) {
    const session = await this.classroomService.resolveStartedSession(validateCode(code));
    return this.exercise.getExerciseSpec(session, step, studentId, exerciseType);
  }

  @Post(':code/steps/:step/check')
  async checkAnswer(
    @Param('code') code: string,
    @Param('step', ParseIntPipe) step: number,
    @Body() dto: CheckDto,
  ) {
    const session = await this.classroomService.resolveStartedSession(validateCode(code));
    return this.exercise.checkAnswer(session, dto.studentId, step, dto.data, dto.exerciseType);
  }
}
