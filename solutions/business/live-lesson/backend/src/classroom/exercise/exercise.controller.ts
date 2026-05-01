import { Controller, Get, Post, Param, Body, ParseIntPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ClassroomService } from '../classroom.service';
import { ExerciseService } from './exercise.service';
import { CheckDto } from './dto/check.dto';
import { validateCode } from '../validate-code';

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
  ) {
    const session = await this.classroomService.resolveActiveSession(validateCode(code));
    return this.exercise.getExerciseSpec(session, step);
  }

  @Post(':code/steps/:step/check')
  async checkAnswer(
    @Param('code') code: string,
    @Param('step', ParseIntPipe) step: number,
    @Body() dto: CheckDto,
  ) {
    const session = await this.classroomService.resolveActiveSession(validateCode(code));
    return this.exercise.checkAnswer(session, dto.studentId, step, dto.data);
  }
}
