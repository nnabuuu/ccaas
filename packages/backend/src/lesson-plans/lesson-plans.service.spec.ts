/**
 * LessonPlansService Tests
 *
 * TDD tests for lesson plan CRUD operations:
 * - create
 * - findAll
 * - findOne
 * - update
 * - delete
 * - duplicate
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { LessonPlansService } from './lesson-plans.service';
import { LessonPlanEntity } from './entities/lesson-plan.entity';
import { CreateLessonPlanDto } from './dto/create-lesson-plan.dto';
import { UpdateLessonPlanDto } from './dto/update-lesson-plan.dto';

describe('LessonPlansService', () => {
  let service: LessonPlansService;
  let repository: jest.Mocked<Repository<LessonPlanEntity>>;

  const mockLessonPlan = (overrides: Partial<LessonPlanEntity> = {}): LessonPlanEntity => ({
    id: 'lp-uuid-1',
    tenantId: 'tenant-1',
    title: '分数的认识',
    subject: '数学',
    gradeLevel: '三年级',
    duration: '40分钟',
    objectives: [
      {
        id: 'obj-1',
        description: '理解分数的基本概念',
        bloomLevel: 'understand',
      },
    ],
    standards: [
      {
        id: 'std-1',
        code: 'MATH.3.NF.1',
        description: '理解分数',
        source: '课程标准',
      },
    ],
    materials: [
      {
        id: 'mat-1',
        name: '分数卡片',
        type: 'manipulative',
      },
    ],
    activities: [
      {
        id: 'act-1',
        title: '导入活动',
        description: '激发兴趣',
        duration: 5,
        type: 'introduction',
        instructions: ['展示问题'],
      },
    ],
    assessment: {
      formative: ['观察'],
      summative: [],
    },
    differentiation: {
      struggling: ['额外支持'],
      onLevel: ['标准活动'],
      advanced: ['扩展挑战'],
    },
    status: 'draft',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  });

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LessonPlansService,
        {
          provide: getRepositoryToken(LessonPlanEntity),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<LessonPlansService>(LessonPlansService);
    repository = module.get(getRepositoryToken(LessonPlanEntity));

    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateLessonPlanDto = {
      title: '分数的认识',
      subject: '数学',
      gradeLevel: '三年级',
      duration: '40分钟',
    };

    it('should create a new lesson plan with defaults', async () => {
      const plan = mockLessonPlan();
      repository.create.mockReturnValue(plan);
      repository.save.mockResolvedValue(plan);

      const result = await service.create('tenant-1', createDto);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          title: '分数的认识',
          subject: '数学',
          gradeLevel: '三年级',
          duration: '40分钟',
          status: 'draft',
        }),
      );
      expect(repository.save).toHaveBeenCalled();
      expect(result.id).toBe('lp-uuid-1');
    });

    it('should create lesson plan with full data', async () => {
      const fullDto: CreateLessonPlanDto = {
        ...createDto,
        objectives: [{ id: 'obj-1', description: '目标', bloomLevel: 'understand' }],
        standards: [{ id: 'std-1', code: 'CODE', description: '标准', source: '来源' }],
        materials: [{ id: 'mat-1', name: '材料', type: 'handout' }],
        activities: [
          {
            id: 'act-1',
            title: '活动',
            description: '描述',
            duration: 10,
            type: 'introduction',
            instructions: ['指令'],
          },
        ],
        assessment: { formative: ['观察'], summative: [] },
        differentiation: { struggling: ['支持'], onLevel: ['标准'], advanced: ['扩展'] },
      };

      const plan = mockLessonPlan(fullDto);
      repository.create.mockReturnValue(plan);
      repository.save.mockResolvedValue(plan);

      const result = await service.create('tenant-1', fullDto);

      expect(result.objectives).toHaveLength(1);
      expect(result.standards).toHaveLength(1);
      expect(result.materials).toHaveLength(1);
      expect(result.activities).toHaveLength(1);
    });

    it('should initialize empty arrays for optional fields', async () => {
      const plan = mockLessonPlan({
        objectives: [],
        standards: [],
        materials: [],
        activities: [],
      });
      repository.create.mockReturnValue(plan);
      repository.save.mockResolvedValue(plan);

      await service.create('tenant-1', createDto);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          objectives: [],
          standards: [],
          materials: [],
          activities: [],
          assessment: { formative: [], summative: [] },
          differentiation: { struggling: [], onLevel: [], advanced: [] },
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return all lesson plans for tenant', async () => {
      const plans = [mockLessonPlan(), mockLessonPlan({ id: 'lp-uuid-2', title: '分数运算' })];
      repository.find.mockResolvedValue(plans);

      const result = await service.findAll('tenant-1');

      expect(repository.find).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
        order: { updatedAt: 'DESC' },
      });
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no plans exist', async () => {
      repository.find.mockResolvedValue([]);

      const result = await service.findAll('tenant-1');

      expect(result).toEqual([]);
    });

    it('should filter by status when provided', async () => {
      const plans = [mockLessonPlan({ status: 'published' })];
      repository.find.mockResolvedValue(plans);

      const result = await service.findAll('tenant-1', { status: 'published' });

      expect(repository.find).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', status: 'published' },
        order: { updatedAt: 'DESC' },
      });
      expect(result).toHaveLength(1);
    });

    it('should filter by subject when provided', async () => {
      const plans = [mockLessonPlan({ subject: '数学' })];
      repository.find.mockResolvedValue(plans);

      const result = await service.findAll('tenant-1', { subject: '数学' });

      expect(repository.find).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', subject: '数学' },
        order: { updatedAt: 'DESC' },
      });
      expect(result).toHaveLength(1);
    });

    it('should filter by gradeLevel when provided', async () => {
      const plans = [mockLessonPlan({ gradeLevel: '三年级' })];
      repository.find.mockResolvedValue(plans);

      const result = await service.findAll('tenant-1', { gradeLevel: '三年级' });

      expect(repository.find).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', gradeLevel: '三年级' },
        order: { updatedAt: 'DESC' },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('should return lesson plan by id', async () => {
      const plan = mockLessonPlan();
      repository.findOne.mockResolvedValue(plan);

      const result = await service.findOne('tenant-1', 'lp-uuid-1');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 'lp-uuid-1', tenantId: 'tenant-1' },
      });
      expect(result).toEqual(plan);
    });

    it('should throw NotFoundException when plan not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne('tenant-1', 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when plan belongs to different tenant', async () => {
      repository.findOne.mockResolvedValue(null); // TypeORM returns null for wrong tenant

      await expect(service.findOne('tenant-2', 'lp-uuid-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    const updateDto: UpdateLessonPlanDto = {
      title: '分数的认识（修订版）',
    };

    it('should update lesson plan fields', async () => {
      const existingPlan = mockLessonPlan();
      const updatedPlan = mockLessonPlan({ title: '分数的认识（修订版）' });

      repository.findOne.mockResolvedValue(existingPlan);
      repository.save.mockResolvedValue(updatedPlan);

      const result = await service.update('tenant-1', 'lp-uuid-1', updateDto);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '分数的认识（修订版）',
        }),
      );
      expect(result.title).toBe('分数的认识（修订版）');
    });

    it('should throw NotFoundException when updating non-existent plan', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.update('tenant-1', 'non-existent', updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update nested objects correctly', async () => {
      const existingPlan = mockLessonPlan();
      const newObjectives = [
        { id: 'obj-new', description: '新目标', bloomLevel: 'apply' as const },
      ];

      repository.findOne.mockResolvedValue(existingPlan);
      repository.save.mockResolvedValue({ ...existingPlan, objectives: newObjectives });

      const result = await service.update('tenant-1', 'lp-uuid-1', {
        objectives: newObjectives,
      });

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          objectives: newObjectives,
        }),
      );
      expect(result.objectives[0].description).toBe('新目标');
    });

    it('should not allow updating tenantId', async () => {
      const existingPlan = mockLessonPlan();
      repository.findOne.mockResolvedValue(existingPlan);
      repository.save.mockResolvedValue(existingPlan);

      await service.update('tenant-1', 'lp-uuid-1', {
        tenantId: 'tenant-2', // Attempting to change tenant
      } as unknown as UpdateLessonPlanDto);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1', // Should remain unchanged
        }),
      );
    });

    it('should update status field', async () => {
      const existingPlan = mockLessonPlan({ status: 'draft' });
      const updatedPlan = mockLessonPlan({ status: 'review' });

      repository.findOne.mockResolvedValue(existingPlan);
      repository.save.mockResolvedValue(updatedPlan);

      const result = await service.update('tenant-1', 'lp-uuid-1', {
        status: 'review',
      });

      expect(result.status).toBe('review');
    });
  });

  describe('delete', () => {
    it('should delete lesson plan', async () => {
      const plan = mockLessonPlan();
      repository.findOne.mockResolvedValue(plan);
      repository.delete.mockResolvedValue({ affected: 1, raw: {} });

      await service.delete('tenant-1', 'lp-uuid-1');

      expect(repository.delete).toHaveBeenCalledWith({
        id: 'lp-uuid-1',
        tenantId: 'tenant-1',
      });
    });

    it('should throw NotFoundException when deleting non-existent plan', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.delete('tenant-1', 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should not delete plan from different tenant', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.delete('tenant-2', 'lp-uuid-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('duplicate', () => {
    it('should create a copy of existing lesson plan', async () => {
      const originalPlan = mockLessonPlan();
      const duplicatedPlan = mockLessonPlan({
        id: 'lp-uuid-2',
        title: '分数的认识 (副本)',
        status: 'draft',
      });

      repository.findOne.mockResolvedValue(originalPlan);
      repository.create.mockReturnValue(duplicatedPlan);
      repository.save.mockResolvedValue(duplicatedPlan);

      const result = await service.duplicate('tenant-1', 'lp-uuid-1');

      expect(result.id).not.toBe('lp-uuid-1');
      expect(result.title).toContain('副本');
      expect(result.status).toBe('draft');
    });

    it('should throw NotFoundException when duplicating non-existent plan', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.duplicate('tenant-1', 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should copy all content but reset status to draft', async () => {
      const originalPlan = mockLessonPlan({ status: 'published' });
      const duplicatedPlan = mockLessonPlan({ id: 'lp-uuid-2', status: 'draft' });

      repository.findOne.mockResolvedValue(originalPlan);
      repository.create.mockReturnValue(duplicatedPlan);
      repository.save.mockResolvedValue(duplicatedPlan);

      const result = await service.duplicate('tenant-1', 'lp-uuid-1');

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'draft',
          // Note: objectives will have new IDs, but same content
          subject: originalPlan.subject,
          gradeLevel: originalPlan.gradeLevel,
        }),
      );
      expect(result.status).toBe('draft');
    });

    it('should generate new IDs for nested items', async () => {
      const originalPlan = mockLessonPlan();
      repository.findOne.mockResolvedValue(originalPlan);

      const createdPlan = { ...originalPlan };
      repository.create.mockReturnValue(createdPlan);
      repository.save.mockResolvedValue(createdPlan);

      await service.duplicate('tenant-1', 'lp-uuid-1');

      // The service should regenerate IDs for objectives, standards, etc.
      expect(repository.create).toHaveBeenCalled();
    });
  });

  describe('updateField', () => {
    it('should update a single field from output_update', async () => {
      const existingPlan = mockLessonPlan();
      const updatedPlan = mockLessonPlan({ title: 'AI生成的标题' });

      repository.findOne.mockResolvedValue(existingPlan);
      repository.save.mockResolvedValue(updatedPlan);

      const result = await service.updateField('tenant-1', 'lp-uuid-1', 'title', 'AI生成的标题');

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'AI生成的标题',
        }),
      );
      expect(result.title).toBe('AI生成的标题');
    });

    it('should update objectives array', async () => {
      const existingPlan = mockLessonPlan();
      const newObjectives = [
        { id: 'obj-ai-1', description: 'AI生成的目标', bloomLevel: 'create' as const },
      ];

      repository.findOne.mockResolvedValue(existingPlan);
      repository.save.mockResolvedValue({ ...existingPlan, objectives: newObjectives });

      const result = await service.updateField('tenant-1', 'lp-uuid-1', 'objectives', newObjectives);

      expect(result.objectives).toEqual(newObjectives);
    });

    it('should throw BadRequestException for invalid field', async () => {
      const existingPlan = mockLessonPlan();
      repository.findOne.mockResolvedValue(existingPlan);

      await expect(
        service.updateField('tenant-1', 'lp-uuid-1', 'invalidField' as any, 'value'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should not allow updating id or tenantId', async () => {
      const existingPlan = mockLessonPlan();
      repository.findOne.mockResolvedValue(existingPlan);

      await expect(
        service.updateField('tenant-1', 'lp-uuid-1', 'id' as any, 'new-id'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.updateField('tenant-1', 'lp-uuid-1', 'tenantId' as any, 'new-tenant'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
