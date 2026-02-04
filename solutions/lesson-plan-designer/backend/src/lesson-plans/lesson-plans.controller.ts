import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Headers,
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
  AddAttachmentDto,
} from './lesson-plans.types';

@Controller('lesson-plans')
export class LessonPlansController {
  constructor(private readonly lessonPlansService: LessonPlansService) {}

  @Get()
  findAll() {
    return this.lessonPlansService.findAll();
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
    if (!dto.title) {
      throw new BadRequestException('title is required');
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

  // Attachment endpoints
  @Post(':id/attachments')
  async addAttachment(
    @Param('id') id: string,
    @Headers('x-session-id') sessionId: string,
    @Body() dto: AddAttachmentDto,
  ) {
    // Case 1: MCP metadata with _originalPath (from session workspace)
    if (dto._originalPath && sessionId) {
      return this.lessonPlansService.addAttachmentFromMcp(id, sessionId, dto);
    }

    // Case 2: Legacy addAttachment (for backward compatibility)
    if (!dto._originalPath) {
      return this.lessonPlansService.addAttachment(id, dto);
    }

    throw new BadRequestException('Either provide _originalPath + sessionId, or use legacy format');
  }

  @Delete(':id/attachments/:attachmentId')
  @HttpCode(HttpStatus.OK)
  removeAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.lessonPlansService.removeAttachment(id, attachmentId);
  }

  @Get(':id/attachments')
  getAttachments(@Param('id') id: string) {
    return this.lessonPlansService.getAttachments(id);
  }
}
