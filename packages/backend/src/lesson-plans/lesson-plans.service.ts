/**
 * LessonPlansService
 *
 * Service for lesson plan CRUD operations.
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LessonPlanEntity } from './entities/lesson-plan.entity';
import { CreateLessonPlanDto } from './dto/create-lesson-plan.dto';
import { UpdateLessonPlanDto } from './dto/update-lesson-plan.dto';
import { LESSON_PLAN_SYNC_FIELDS, type LessonPlanSyncField } from '@ccaas/common';

interface FindAllOptions {
  status?: string;
  subject?: string;
  gradeLevel?: string;
}

@Injectable()
export class LessonPlansService {
  constructor(
    @InjectRepository(LessonPlanEntity)
    private readonly repository: Repository<LessonPlanEntity>,
  ) {}

  /**
   * Create a new lesson plan
   */
  async create(tenantId: string, dto: CreateLessonPlanDto): Promise<LessonPlanEntity> {
    const plan = this.repository.create({
      tenantId,
      title: dto.title,
      subject: dto.subject,
      gradeLevel: dto.gradeLevel,
      duration: dto.duration,
      objectives: dto.objectives || [],
      standards: dto.standards || [],
      materials: dto.materials || [],
      activities: dto.activities || [],
      assessment: dto.assessment || { formative: [], summative: [] },
      differentiation: dto.differentiation || { struggling: [], onLevel: [], advanced: [] },
      status: 'draft',
      metadata: dto.metadata,
    });

    return this.repository.save(plan);
  }

  /**
   * Find all lesson plans for a tenant
   */
  async findAll(tenantId: string, options: FindAllOptions = {}): Promise<LessonPlanEntity[]> {
    const where: Record<string, unknown> = { tenantId };

    if (options.status) {
      where.status = options.status;
    }
    if (options.subject) {
      where.subject = options.subject;
    }
    if (options.gradeLevel) {
      where.gradeLevel = options.gradeLevel;
    }

    return this.repository.find({
      where,
      order: { updatedAt: 'DESC' },
    });
  }

  /**
   * Find a single lesson plan by ID
   */
  async findOne(tenantId: string, id: string): Promise<LessonPlanEntity> {
    const plan = await this.repository.findOne({
      where: { id, tenantId },
    });

    if (!plan) {
      throw new NotFoundException(`Lesson plan with ID "${id}" not found`);
    }

    return plan;
  }

  /**
   * Update a lesson plan
   */
  async update(
    tenantId: string,
    id: string,
    dto: UpdateLessonPlanDto,
  ): Promise<LessonPlanEntity> {
    const plan = await this.findOne(tenantId, id);

    // Apply updates but never change tenantId
    const { tenantId: _, ...updates } = dto as UpdateLessonPlanDto & { tenantId?: string };

    Object.assign(plan, updates);

    return this.repository.save(plan);
  }

  /**
   * Delete a lesson plan
   */
  async delete(tenantId: string, id: string): Promise<void> {
    // Verify the plan exists and belongs to tenant
    await this.findOne(tenantId, id);

    await this.repository.delete({ id, tenantId });
  }

  /**
   * Duplicate a lesson plan
   */
  async duplicate(tenantId: string, id: string): Promise<LessonPlanEntity> {
    const original = await this.findOne(tenantId, id);

    // Generate new IDs for nested items
    const newObjectives = original.objectives.map((obj) => ({
      ...obj,
      id: this.generateId(),
    }));

    const newStandards = original.standards.map((std) => ({
      ...std,
      id: this.generateId(),
    }));

    const newMaterials = original.materials.map((mat) => ({
      ...mat,
      id: this.generateId(),
    }));

    const newActivities = original.activities.map((act) => ({
      ...act,
      id: this.generateId(),
    }));

    const duplicated = this.repository.create({
      tenantId,
      title: `${original.title} (副本)`,
      subject: original.subject,
      gradeLevel: original.gradeLevel,
      duration: original.duration,
      objectives: newObjectives,
      standards: newStandards,
      materials: newMaterials,
      activities: newActivities,
      assessment: { ...original.assessment },
      differentiation: { ...original.differentiation },
      status: 'draft', // Always reset to draft
      metadata: original.metadata,
    });

    return this.repository.save(duplicated);
  }

  /**
   * Update a single field (for output_update sync)
   */
  async updateField(
    tenantId: string,
    id: string,
    field: string,
    value: unknown,
  ): Promise<LessonPlanEntity> {
    // Validate field is allowed to be updated
    const allowedFields = LESSON_PLAN_SYNC_FIELDS as readonly string[];

    if (!allowedFields.includes(field)) {
      throw new BadRequestException(`Field "${field}" is not allowed to be updated`);
    }

    // Prevent updating protected fields
    if (field === 'id' || field === 'tenantId') {
      throw new BadRequestException(`Field "${field}" cannot be updated`);
    }

    const plan = await this.findOne(tenantId, id);

    // Update the specific field
    (plan as unknown as Record<string, unknown>)[field] = value;

    return this.repository.save(plan);
  }

  /**
   * Generate a simple UUID
   */
  private generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
