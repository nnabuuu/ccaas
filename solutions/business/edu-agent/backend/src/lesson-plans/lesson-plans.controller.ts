import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { LessonPlansService } from './lesson-plans.service';
import {
  CreateLessonPlanDto,
  UpdateLessonPlanDto,
  PatchFieldDto,
  SYNC_FIELDS,
} from './lesson-plans.types';

@Controller('lesson-plans')
export class LessonPlansController {
  constructor(private readonly lessonPlansService: LessonPlansService) {}

  @Get()
  findAll(@Query('tenantId') tenantId?: string) {
    return this.lessonPlansService.findAll(tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    const plan = this.lessonPlansService.findById(id);
    if (!plan) {
      throw new NotFoundException('Lesson plan not found');
    }
    return plan;
  }

  @Post()
  create(@Body() dto: CreateLessonPlanDto) {
    if (!dto.tenantId || !dto.title) {
      throw new BadRequestException('tenantId and title are required');
    }
    return this.lessonPlansService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLessonPlanDto) {
    return this.lessonPlansService.update(id, dto);
  }

  @Patch(':id/field')
  patchField(@Param('id') id: string, @Body() dto: PatchFieldDto) {
    const validFields: readonly string[] = SYNC_FIELDS;
    if (!validFields.includes(dto.field)) {
      throw new BadRequestException(`Invalid field: ${dto.field}`);
    }
    return this.lessonPlansService.patchField(id, dto.field, dto.value);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id') id: string) {
    const deleted = this.lessonPlansService.delete(id);
    if (!deleted) {
      throw new NotFoundException('Lesson plan not found');
    }
  }
}
