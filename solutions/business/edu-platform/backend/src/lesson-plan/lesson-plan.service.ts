import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LessonPlan } from '../entities/lesson-plan.entity';
import { ContentBlock } from '../entities/content-block.entity';
import { LessonPlanTemplate } from '../entities/lesson-plan-template.entity';
import { TemplateBlock } from '../entities/template-block.entity';
import { ActivityService } from '../activity/activity.service';
import { CreateLessonPlanDto } from './dto/create-lesson-plan.dto';
import { UpdateLessonPlanDto } from './dto/update-lesson-plan.dto';
import {
  resolveSubjectName,
  resolveSubjectId,
  resolveClassName,
  resolveClassId,
} from '../shared/lookup-maps';

@Injectable()
export class LessonPlanService {
  constructor(
    @InjectRepository(LessonPlan)
    private readonly lpRepo: Repository<LessonPlan>,
    @InjectRepository(ContentBlock)
    private readonly blockRepo: Repository<ContentBlock>,
    @InjectRepository(LessonPlanTemplate)
    private readonly templateRepo: Repository<LessonPlanTemplate>,
    @InjectRepository(TemplateBlock)
    private readonly tplBlockRepo: Repository<TemplateBlock>,
    private readonly activityService: ActivityService,
  ) {}

  // ── Response Transformation ──────────────────────────────

  private buildRequirement(lp: LessonPlan) {
    if (!lp.requirement_id || !lp.requirement_snapshot) return undefined;
    return {
      id: lp.requirement_id,
      code: lp.requirement_snapshot.code,
      text: lp.requirement_snapshot.text,
      version: lp.requirement_snapshot.version,
    };
  }

  private toListItem(lp: LessonPlan) {
    return {
      id: lp.id,
      title: lp.title,
      class_name: resolveClassName(lp.class_id),
      subject: resolveSubjectName(lp.subject_id),
      lesson_type: lp.lesson_type,
      duration: lp.duration_minutes,
      status: lp.status,
      requirement: this.buildRequirement(lp),
      updated_at: lp.updated_at,
    };
  }

  private toDetail(lp: LessonPlan) {
    return {
      id: lp.id,
      title: lp.title,
      class_name: resolveClassName(lp.class_id),
      subject: resolveSubjectName(lp.subject_id),
      lesson_type: lp.lesson_type,
      duration: lp.duration_minutes,
      status: lp.status,
      blocks: (lp.blocks || []).map((b) => ({
        id: b.id,
        type: b.type,
        content: b.content,
        sort_order: b.sort_order,
      })),
      source_template_id: lp.source_template_id || undefined,
      requirement: this.buildRequirement(lp),
      created_at: lp.created_at,
      updated_at: lp.updated_at,
    };
  }

  /** Resolve frontend display names to DB IDs for create/update */
  private resolveInputIds(dto: CreateLessonPlanDto | UpdateLessonPlanDto) {
    const resolved: { subject_id?: string; class_id?: string; duration_minutes?: number } = {};
    if (dto.subject_id) {
      resolved.subject_id = dto.subject_id;
    } else if (dto.subject) {
      resolved.subject_id = resolveSubjectId(dto.subject);
    }
    if (dto.class_id) {
      resolved.class_id = dto.class_id;
    } else if (dto.class_name) {
      resolved.class_id = resolveClassId(dto.class_name);
    }
    if (dto.duration_minutes != null) {
      resolved.duration_minutes = dto.duration_minutes;
    } else if (dto.duration != null) {
      resolved.duration_minutes = dto.duration;
    }
    return resolved;
  }

  // ── Internal (raw entity) ────────────────────────────────

  private async findOneRaw(id: string): Promise<LessonPlan> {
    const lp = await this.lpRepo.findOne({
      where: { id, is_deleted: false },
      relations: ['blocks'],
    });
    if (!lp) throw new NotFoundException(`LessonPlan ${id} not found`);
    lp.blocks = (lp.blocks || []).sort((a, b) => a.sort_order - b.sort_order);
    return lp;
  }

  // ── Public API ───────────────────────────────────────────

  async findAll(query: {
    page?: number;
    limit?: number;
    subject_id?: string;
    status?: string;
    class_id?: string;
    has_requirement?: string;
    q?: string;
  }) {
    const page = query.page || 1;
    const limit = query.limit || 20;

    let qb = this.lpRepo.createQueryBuilder('lp')
      .where('lp.is_deleted = :deleted', { deleted: false });

    if (query.subject_id) qb = qb.andWhere('lp.subject_id = :sid', { sid: query.subject_id });
    if (query.status) qb = qb.andWhere('lp.status = :status', { status: query.status });
    if (query.class_id) qb = qb.andWhere('lp.class_id = :cid', { cid: query.class_id });
    if (query.q) qb = qb.andWhere('lp.title LIKE :q', { q: `%${query.q}%` });
    if (query.has_requirement === 'true') {
      qb = qb.andWhere('lp.requirement_id IS NOT NULL');
    } else if (query.has_requirement === 'false') {
      qb = qb.andWhere('lp.requirement_id IS NULL');
    }

    const [data, total] = await qb
      .orderBy('lp.updated_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items: data.map((lp) => this.toListItem(lp)),
      total,
      page,
      page_size: limit,
    };
  }

  async findOne(id: string) {
    const lp = await this.findOneRaw(id);
    return this.toDetail(lp);
  }

  async create(dto: CreateLessonPlanDto) {
    const userId = dto.user_id || 'default_user';
    const ids = this.resolveInputIds(dto);

    const lp = this.lpRepo.create({
      title: dto.title,
      subject_id: ids.subject_id || 'math',
      class_id: ids.class_id || 'class_802',
      lesson_type: dto.lesson_type || 'new',
      duration_minutes: ids.duration_minutes || 45,
      source_template_id: dto.source_template_id || null,
      source: dto.source_template_id ? 'template' : 'manual',
      requirement_id: dto.requirement_id || null,
      user_id: userId,
      status: 'draft',
    });

    const saved = await this.lpRepo.save(lp);

    // Fork logic: copy template blocks
    if (dto.source_template_id) {
      const template = await this.templateRepo.findOne({
        where: { id: dto.source_template_id },
        relations: ['blocks'],
      });
      if (template && template.blocks) {
        const sortedBlocks = template.blocks.sort((a, b) => a.sort_order - b.sort_order);
        for (const tb of sortedBlocks) {
          const block = this.blockRepo.create({
            lesson_plan_id: saved.id,
            type: tb.type,
            content: tb.content && Object.keys(tb.content).length > 0
              ? tb.content
              : { text: tb.placeholder || '' },
            sort_order: tb.sort_order,
          });
          await this.blockRepo.save(block);
        }
        // Increment usage count
        await this.templateRepo.increment({ id: template.id }, 'usage_count', 1);
      }
    }

    await this.activityService.record({
      user_id: userId,
      entity_type: 'lesson_plan',
      entity_id: saved.id,
      entity_display_name: saved.title,
      action: 'created',
      detail: dto.source_template_id
        ? { source: 'template', template_id: dto.source_template_id }
        : null,
    });

    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdateLessonPlanDto) {
    const lp = await this.findOneRaw(id);
    const ids = this.resolveInputIds(dto);

    if (dto.title !== undefined) lp.title = dto.title;
    if (ids.subject_id) lp.subject_id = ids.subject_id;
    if (ids.class_id) lp.class_id = ids.class_id;
    if (dto.lesson_type !== undefined) lp.lesson_type = dto.lesson_type;
    if (ids.duration_minutes != null) lp.duration_minutes = ids.duration_minutes;

    await this.lpRepo.save(lp);

    await this.activityService.record({
      user_id: lp.user_id,
      entity_type: 'lesson_plan',
      entity_id: lp.id,
      entity_display_name: lp.title,
      action: 'updated',
    });

    return this.findOne(lp.id);
  }

  async softDelete(id: string): Promise<void> {
    const lp = await this.findOneRaw(id);
    lp.is_deleted = true;
    await this.lpRepo.save(lp);

    await this.activityService.record({
      user_id: lp.user_id,
      entity_type: 'lesson_plan',
      entity_id: lp.id,
      entity_display_name: lp.title,
      action: 'deleted',
    });
  }

  async updateBlocks(
    id: string,
    blocks: { type: string; content: Record<string, any>; sort_order: number }[],
  ) {
    const lp = await this.findOneRaw(id);

    await this.blockRepo.manager.transaction(async (manager) => {
      await manager.delete(ContentBlock, { lesson_plan_id: id });
      const blockEntities = blocks.map((b) =>
        manager.create(ContentBlock, {
          lesson_plan_id: id,
          type: b.type,
          content: b.content,
          sort_order: b.sort_order,
        }),
      );
      await manager.save(blockEntities);
    });

    await this.activityService.record({
      user_id: lp.user_id,
      entity_type: 'lesson_plan',
      entity_id: id,
      entity_display_name: lp.title,
      action: 'updated',
      detail: { field: 'blocks', count: blocks.length },
    });

    return this.findOne(id);
  }

  async linkRequirement(
    id: string,
    body: {
      requirement_id: string;
      requirement_snapshot: { code: string; text: string; version: string };
    },
  ) {
    const lp = await this.findOneRaw(id);
    lp.requirement_id = body.requirement_id;
    lp.requirement_snapshot = body.requirement_snapshot;
    await this.lpRepo.save(lp);

    await this.activityService.record({
      user_id: lp.user_id,
      entity_type: 'lesson_plan',
      entity_id: id,
      entity_display_name: lp.title,
      action: 'requirement_linked',
      detail: { requirement_id: body.requirement_id },
    });

    return this.findOne(id);
  }

  // CCAAS-AI: mock — future: call curriculum AI to check version diffs
  async getRequirementStatus(id: string) {
    const lp = await this.findOneRaw(id);
    if (!lp.requirement_snapshot) {
      return {
        current_version: null,
        snapshot_version: null,
        has_update: false,
        diff_summary: '未关联学业要求',
      };
    }
    return {
      current_version: lp.requirement_snapshot.version,
      snapshot_version: lp.requirement_snapshot.version,
      has_update: false,
      diff_summary: '当前版本是最新',
    };
  }

  async linkExercises(id: string, exercise_ids: string[]) {
    const lp = await this.findOneRaw(id);
    lp.exercise_ids = exercise_ids;
    await this.lpRepo.save(lp);

    await this.activityService.record({
      user_id: lp.user_id,
      entity_type: 'lesson_plan',
      entity_id: id,
      entity_display_name: lp.title,
      action: 'exercise_linked',
      detail: { exercise_ids },
    });

    return this.findOne(id);
  }

  async publish(id: string) {
    const lp = await this.findOneRaw(id);
    lp.status = 'published';
    await this.lpRepo.save(lp);

    await this.activityService.record({
      user_id: lp.user_id,
      entity_type: 'lesson_plan',
      entity_id: id,
      entity_display_name: lp.title,
      action: 'published',
    });

    const result = await this.findOne(id);
    if (!lp.requirement_id) {
      return { ...result, warning: '未关联学业要求' };
    }
    return result;
  }

  // CCAAS-AI: mock — future: call MCP tool generate_docx
  async exportDocx(id: string) {
    const lp = await this.findOneRaw(id);
    return {
      url: `/exports/${lp.id}.docx`,
      filename: `${lp.title}.docx`,
    };
  }

  async saveAsTemplate(
    id: string,
    body: { name: string; description: string },
  ) {
    const lp = await this.findOneRaw(id);

    const template = this.templateRepo.create({
      name: body.name,
      description: body.description,
      lesson_type: lp.lesson_type,
      subject_ids: [lp.subject_id],
      scope: 'teacher',
      user_id: lp.user_id,
    });
    const savedTpl = await this.templateRepo.save(template);

    // Copy lesson plan blocks to template blocks
    if (lp.blocks) {
      for (const block of lp.blocks) {
        const tb = this.tplBlockRepo.create({
          template_id: savedTpl.id,
          type: block.type,
          content: block.content,
          placeholder: '',
          is_required: false,
          sort_order: block.sort_order,
        });
        await this.tplBlockRepo.save(tb);
      }
    }

    await this.activityService.record({
      user_id: lp.user_id,
      entity_type: 'template',
      entity_id: savedTpl.id,
      entity_display_name: savedTpl.name,
      action: 'created',
      detail: { source: 'lesson_plan', lesson_plan_id: id },
    });

    return { id: savedTpl.id, name: savedTpl.name };
  }
}
