import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TaskDemoService } from '../../application/task-demo/task-demo.service';
import { validateCode } from '../../domain/classroom/validate-code';
import { CreateTaskDemoDto, ClaimTaskDemoDto, SubmitTaskDemoDto } from './dto/task-demo.dto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateStudentId(value: string): string {
  if (!UUID_RE.test(value)) throw new BadRequestException('Invalid student id');
  return value;
}

@ApiTags('task-demo')
@Controller('task-demo')
export class TaskDemoController {
  constructor(private readonly service: TaskDemoService) {}

  @Post('create')
  create(@Body() dto: CreateTaskDemoDto) {
    return this.service.create(dto.lessonId, dto.step);
  }

  @Post(':code/claim')
  claim(@Param('code') code: string, @Body() dto: ClaimTaskDemoDto) {
    return this.service.claim(validateCode(code), dto.user);
  }

  @Get(':code/exercise')
  exercise(@Param('code') code: string) {
    // Step is read from session.currentStep (set at create-time).
    return this.service.getExerciseSpec(validateCode(code));
  }

  @Post(':code/submit')
  submit(@Param('code') code: string, @Body() dto: SubmitTaskDemoDto) {
    return this.service.submit(validateCode(code), validateStudentId(dto.studentId), dto.data);
  }

  @Get(':code/respondents')
  respondents(@Param('code') code: string) {
    return this.service.listRespondents(validateCode(code));
  }

  @Get(':code/replay/:studentId')
  replay(@Param('code') code: string, @Param('studentId') studentId: string) {
    return this.service.getReplay(validateCode(code), validateStudentId(studentId));
  }
}
