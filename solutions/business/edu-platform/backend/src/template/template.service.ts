import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LessonPlanTemplate } from '../entities/lesson-plan-template.entity';
import { TemplateBlock } from '../entities/template-block.entity';
import { TemplatePromotion } from '../entities/template-promotion.entity';
import { ActivityService } from '../activity/activity.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Injectable()
export class TemplateService {
  constructor(
    @InjectRepository(LessonPlanTemplate)
    private readonly templateRepo: Repository<LessonPlanTemplate>,
    @InjectRepository(TemplateBlock)
    private readonly blockRepo: Repository<TemplateBlock>,
    @InjectRepository(TemplatePromotion)
    private readonly promotionRepo: Repository<TemplatePromotion>,
    private readonly activityService: ActivityService,
  ) {}

  async findAll(query: {
    page?: number;
    limit?: number;
    scope?: string;
    subject_id?: string;
    lesson_type?: string;
    q?: string;
  }) {
    const page = query.page || 1;
    const limit = query.limit || 20;

    let qb = this.templateRepo.createQueryBuilder('t')
      .where('t.is_deleted = :deleted', { deleted: false });

    if (query.scope) qb = qb.andWhere('t.scope = :scope', { scope: query.scope });
    if (query.lesson_type) qb = qb.andWhere('t.lesson_type = :lt', { lt: query.lesson_type });
    if (query.q) qb = qb.andWhere('t.name LIKE :q', { q: `%${query.q}%` });
    if (query.subject_id) {
      qb = qb.andWhere('t.subject_ids LIKE :sid', { sid: `%${query.subject_id}%` });
    }

    const [data, total] = await qb
      .orderBy('t.updated_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<LessonPlanTemplate> {
    const tpl = await this.templateRepo.findOne({
      where: { id, is_deleted: false },
      relations: ['blocks'],
    });
    if (!tpl) throw new NotFoundException(`Template ${id} not found`);
    tpl.blocks = (tpl.blocks || []).sort((a, b) => a.sort_order - b.sort_order);
    return tpl;
  }

  async create(dto: CreateTemplateDto): Promise<LessonPlanTemplate> {
    const userId = dto.user_id || 'default_user';
    const template = this.templateRepo.create({
      name: dto.name,
      description: dto.description || '',
      lesson_type: dto.lesson_type || 'new',
      subject_ids: dto.subject_ids || [],
      scope: dto.scope || 'teacher',
      user_id: userId,
    });
    const saved = await this.templateRepo.save(template);

    if (dto.blocks && dto.blocks.length > 0) {
      for (const b of dto.blocks) {
        const block = this.blockRepo.create({
          template_id: saved.id,
          type: b.type,
          placeholder: b.placeholder || '',
          content: b.content || {},
          is_required: b.is_required || false,
          sort_order: b.sort_order,
        });
        await this.blockRepo.save(block);
      }
    }

    await this.activityService.record({
      user_id: userId,
      entity_type: 'template',
      entity_id: saved.id,
      entity_display_name: saved.name,
      action: 'created',
    });

    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdateTemplateDto): Promise<LessonPlanTemplate> {
    const tpl = await this.findOne(id);

    if (dto.name !== undefined) tpl.name = dto.name;
    if (dto.description !== undefined) tpl.description = dto.description;
    if (dto.lesson_type !== undefined) tpl.lesson_type = dto.lesson_type;
    if (dto.subject_ids !== undefined) tpl.subject_ids = dto.subject_ids;

    const saved = await this.templateRepo.save(tpl);

    // Replace blocks if provided
    if (dto.blocks) {
      await this.blockRepo.delete({ template_id: id });
      for (const b of dto.blocks) {
        const block = this.blockRepo.create({
          template_id: id,
          type: b.type,
          placeholder: b.placeholder || '',
          content: b.content || {},
          is_required: b.is_required || false,
          sort_order: b.sort_order,
        });
        await this.blockRepo.save(block);
      }
    }

    await this.activityService.record({
      user_id: tpl.user_id,
      entity_type: 'template',
      entity_id: id,
      entity_display_name: tpl.name,
      action: 'updated',
    });

    return this.findOne(id);
  }

  async softDelete(id: string): Promise<void> {
    const tpl = await this.findOne(id);
    tpl.is_deleted = true;
    await this.templateRepo.save(tpl);

    await this.activityService.record({
      user_id: tpl.user_id,
      entity_type: 'template',
      entity_id: id,
      entity_display_name: tpl.name,
      action: 'deleted',
    });
  }

  async promote(
    id: string,
    body: { target_scope: string; reason?: string },
  ): Promise<TemplatePromotion> {
    const tpl = await this.findOne(id);

    const promotion = this.promotionRepo.create({
      template_id: id,
      from_scope: tpl.scope,
      to_scope: body.target_scope,
      submitter_id: tpl.user_id,
      status: 'pending',
      reason: body.reason || '',
    });
    const saved = await this.promotionRepo.save(promotion);

    tpl.promotion_status = 'pending';
    await this.templateRepo.save(tpl);

    await this.activityService.record({
      user_id: tpl.user_id,
      entity_type: 'template',
      entity_id: id,
      entity_display_name: tpl.name,
      action: 'submitted',
      detail: { target_scope: body.target_scope },
    });

    return saved;
  }

  async getPromotions(status?: string) {
    const where: any = {};
    if (status) where.status = status;

    return this.promotionRepo.find({
      where,
      relations: ['template'],
      order: { created_at: 'DESC' },
    });
  }

  async reviewPromotion(
    promotionId: string,
    body: { action: string; comment?: string },
  ) {
    const promotion = await this.promotionRepo.findOne({
      where: { id: promotionId },
      relations: ['template'],
    });
    if (!promotion) throw new NotFoundException(`Promotion ${promotionId} not found`);

    const template = await this.findOne(promotion.template_id);

    if (body.action === 'approve') {
      promotion.status = 'approved';
      promotion.review_comment = body.comment || '';
      await this.promotionRepo.save(promotion);

      // Create new template with target scope
      const newTemplate = this.templateRepo.create({
        name: template.name,
        description: template.description,
        lesson_type: template.lesson_type,
        subject_ids: template.subject_ids,
        scope: promotion.to_scope,
        user_id: template.user_id,
        source_template_id: template.id,
        promotion_status: 'approved',
      });
      const savedNewTpl = await this.templateRepo.save(newTemplate);

      // Copy blocks
      if (template.blocks) {
        for (const b of template.blocks) {
          const block = this.blockRepo.create({
            template_id: savedNewTpl.id,
            type: b.type,
            placeholder: b.placeholder,
            content: b.content,
            is_required: b.is_required,
            sort_order: b.sort_order,
          });
          await this.blockRepo.save(block);
        }
      }

      template.promotion_status = 'approved';
      await this.templateRepo.save(template);

      await this.activityService.record({
        user_id: template.user_id,
        entity_type: 'template',
        entity_id: savedNewTpl.id,
        entity_display_name: template.name,
        action: 'promoted',
        detail: { from_scope: promotion.from_scope, to_scope: promotion.to_scope },
      });

      return { promotion, new_template: savedNewTpl };
    } else if (body.action === 'reject') {
      promotion.status = 'rejected';
      promotion.review_comment = body.comment || '';
      await this.promotionRepo.save(promotion);

      template.promotion_status = 'rejected';
      await this.templateRepo.save(template);

      return { promotion };
    } else if (body.action === 'revision_requested') {
      promotion.status = 'revision_requested';
      promotion.review_comment = body.comment || '';
      await this.promotionRepo.save(promotion);

      template.promotion_status = 'none';
      await this.templateRepo.save(template);

      return { promotion };
    }

    return { promotion };
  }
}
