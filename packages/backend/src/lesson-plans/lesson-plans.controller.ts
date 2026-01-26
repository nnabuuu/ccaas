/**
 * LessonPlansController
 *
 * REST API controller for lesson plan operations.
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { LessonPlansService } from './lesson-plans.service';
import { CreateLessonPlanDto } from './dto/create-lesson-plan.dto';
import { UpdateLessonPlanDto } from './dto/update-lesson-plan.dto';
import { UpdateFieldDto } from './dto/update-field.dto';
import { TenantId } from '../auth/decorators';
import { Auth } from '../auth/decorators';

@Controller('api/v1/lesson-plans')
export class LessonPlansController {
  constructor(private readonly service: LessonPlansService) {}

  /**
   * Create a new lesson plan
   */
  @Post()
  @Auth('skills:write') // Using skills scope for now
  async create(
    @TenantId() tenantId: string,
    @Body() dto: CreateLessonPlanDto,
  ) {
    return this.service.create(tenantId, dto);
  }

  /**
   * Get all lesson plans
   */
  @Get()
  @Auth('skills:read')
  async findAll(
    @TenantId() tenantId: string,
    @Query('status') status?: string,
    @Query('subject') subject?: string,
    @Query('gradeLevel') gradeLevel?: string,
  ) {
    const options: Record<string, string> = {};
    if (status) options.status = status;
    if (subject) options.subject = subject;
    if (gradeLevel) options.gradeLevel = gradeLevel;

    return this.service.findAll(tenantId, options);
  }

  /**
   * Get a single lesson plan
   */
  @Get(':id')
  @Auth('skills:read')
  async findOne(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.findOne(tenantId, id);
  }

  /**
   * Update a lesson plan
   */
  @Put(':id')
  @Auth('skills:write')
  async update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateLessonPlanDto,
  ) {
    return this.service.update(tenantId, id, dto);
  }

  /**
   * Delete a lesson plan
   */
  @Delete(':id')
  @Auth('skills:delete')
  async delete(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.delete(tenantId, id);
  }

  /**
   * Duplicate a lesson plan
   */
  @Post(':id/duplicate')
  @Auth('skills:write')
  async duplicate(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.duplicate(tenantId, id);
  }

  /**
   * Update a single field (for AI sync)
   */
  @Patch(':id/field')
  @Auth('skills:write')
  async updateField(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateFieldDto,
  ) {
    return this.service.updateField(tenantId, id, dto.field, dto.value);
  }
}
