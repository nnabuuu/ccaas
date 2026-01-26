/**
 * LessonPlansController Tests
 *
 * TDD tests for lesson plan REST endpoints:
 * - POST /api/v1/lesson-plans
 * - GET /api/v1/lesson-plans
 * - GET /api/v1/lesson-plans/:id
 * - PUT /api/v1/lesson-plans/:id
 * - DELETE /api/v1/lesson-plans/:id
 * - POST /api/v1/lesson-plans/:id/duplicate
 * - PATCH /api/v1/lesson-plans/:id/field
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { LessonPlansController } from './lesson-plans.controller';
import { LessonPlansService } from './lesson-plans.service';
import { CreateLessonPlanDto } from './dto/create-lesson-plan.dto';
import { UpdateLessonPlanDto } from './dto/update-lesson-plan.dto';
import { UpdateFieldDto } from './dto/update-field.dto';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { ScopesGuard } from '../auth/guards/scopes.guard';

describe('LessonPlansController', () => {
  let controller: LessonPlansController;
  let service: jest.Mocked<LessonPlansService>;

  const mockLessonPlan = {
    id: 'lp-uuid-1',
    tenantId: 'tenant-1',
    title: '分数的认识',
    subject: '数学',
    gradeLevel: '三年级',
    duration: '40分钟',
    objectives: [],
    standards: [],
    materials: [],
    activities: [],
    assessment: { formative: [], summative: [] },
    differentiation: { struggling: [], onLevel: [], advanced: [] },
    status: 'draft' as const,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      duplicate: jest.fn(),
      updateField: jest.fn(),
    };

    // Mock guards that always allow
    const mockGuard = { canActivate: jest.fn().mockReturnValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LessonPlansController],
      providers: [
        {
          provide: LessonPlansService,
          useValue: mockService,
        },
        Reflector,
      ],
    })
      .overrideGuard(ApiKeyGuard)
      .useValue(mockGuard)
      .overrideGuard(ScopesGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<LessonPlansController>(LessonPlansController);
    service = module.get(LessonPlansService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateLessonPlanDto = {
      title: '分数的认识',
      subject: '数学',
      gradeLevel: '三年级',
      duration: '40分钟',
    };

    it('should create a new lesson plan', async () => {
      service.create.mockResolvedValue(mockLessonPlan);

      const result = await controller.create('tenant-1', createDto);

      expect(service.create).toHaveBeenCalledWith('tenant-1', createDto);
      expect(result).toEqual(mockLessonPlan);
    });

    it('should pass tenantId from decorator', async () => {
      service.create.mockResolvedValue(mockLessonPlan);

      await controller.create('custom-tenant', createDto);

      expect(service.create).toHaveBeenCalledWith('custom-tenant', createDto);
    });
  });

  describe('findAll', () => {
    it('should return all lesson plans', async () => {
      const plans = [mockLessonPlan, { ...mockLessonPlan, id: 'lp-uuid-2' }];
      service.findAll.mockResolvedValue(plans);

      const result = await controller.findAll('tenant-1');

      expect(service.findAll).toHaveBeenCalledWith('tenant-1', {});
      expect(result).toHaveLength(2);
    });

    it('should pass query filters to service', async () => {
      service.findAll.mockResolvedValue([mockLessonPlan]);

      await controller.findAll('tenant-1', 'published', '数学', '三年级');

      expect(service.findAll).toHaveBeenCalledWith('tenant-1', {
        status: 'published',
        subject: '数学',
        gradeLevel: '三年级',
      });
    });

    it('should handle empty filters', async () => {
      service.findAll.mockResolvedValue([]);

      await controller.findAll('tenant-1', undefined, undefined, undefined);

      expect(service.findAll).toHaveBeenCalledWith('tenant-1', {});
    });
  });

  describe('findOne', () => {
    it('should return lesson plan by id', async () => {
      service.findOne.mockResolvedValue(mockLessonPlan);

      const result = await controller.findOne('tenant-1', 'lp-uuid-1');

      expect(service.findOne).toHaveBeenCalledWith('tenant-1', 'lp-uuid-1');
      expect(result).toEqual(mockLessonPlan);
    });

    it('should propagate NotFoundException from service', async () => {
      service.findOne.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne('tenant-1', 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    const updateDto: UpdateLessonPlanDto = {
      title: '分数的认识（修订版）',
    };

    it('should update lesson plan', async () => {
      const updatedPlan = { ...mockLessonPlan, title: '分数的认识（修订版）' };
      service.update.mockResolvedValue(updatedPlan);

      const result = await controller.update('tenant-1', 'lp-uuid-1', updateDto);

      expect(service.update).toHaveBeenCalledWith('tenant-1', 'lp-uuid-1', updateDto);
      expect(result.title).toBe('分数的认识（修订版）');
    });

    it('should propagate NotFoundException from service', async () => {
      service.update.mockRejectedValue(new NotFoundException());

      await expect(
        controller.update('tenant-1', 'non-existent', updateDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete lesson plan', async () => {
      service.delete.mockResolvedValue(undefined);

      await controller.delete('tenant-1', 'lp-uuid-1');

      expect(service.delete).toHaveBeenCalledWith('tenant-1', 'lp-uuid-1');
    });

    it('should propagate NotFoundException from service', async () => {
      service.delete.mockRejectedValue(new NotFoundException());

      await expect(controller.delete('tenant-1', 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('duplicate', () => {
    it('should duplicate lesson plan', async () => {
      const duplicatedPlan = {
        ...mockLessonPlan,
        id: 'lp-uuid-2',
        title: '分数的认识 (副本)',
      };
      service.duplicate.mockResolvedValue(duplicatedPlan);

      const result = await controller.duplicate('tenant-1', 'lp-uuid-1');

      expect(service.duplicate).toHaveBeenCalledWith('tenant-1', 'lp-uuid-1');
      expect(result.id).toBe('lp-uuid-2');
      expect(result.title).toContain('副本');
    });

    it('should propagate NotFoundException from service', async () => {
      service.duplicate.mockRejectedValue(new NotFoundException());

      await expect(controller.duplicate('tenant-1', 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateField', () => {
    it('should update single field', async () => {
      const updatedPlan = { ...mockLessonPlan, title: 'AI生成的标题' };
      service.updateField.mockResolvedValue(updatedPlan);

      const dto: UpdateFieldDto = {
        field: 'title',
        value: 'AI生成的标题',
      };

      const result = await controller.updateField('tenant-1', 'lp-uuid-1', dto);

      expect(service.updateField).toHaveBeenCalledWith(
        'tenant-1',
        'lp-uuid-1',
        'title',
        'AI生成的标题',
      );
      expect(result.title).toBe('AI生成的标题');
    });

    it('should update objectives array', async () => {
      const newObjectives = [
        { id: 'obj-1', description: 'AI目标', bloomLevel: 'create' as const },
      ];
      const updatedPlan = { ...mockLessonPlan, objectives: newObjectives };
      service.updateField.mockResolvedValue(updatedPlan);

      const dto: UpdateFieldDto = {
        field: 'objectives',
        value: newObjectives,
      };

      const result = await controller.updateField('tenant-1', 'lp-uuid-1', dto);

      expect(service.updateField).toHaveBeenCalledWith(
        'tenant-1',
        'lp-uuid-1',
        'objectives',
        newObjectives,
      );
      expect(result.objectives).toEqual(newObjectives);
    });

    it('should propagate NotFoundException from service', async () => {
      service.updateField.mockRejectedValue(new NotFoundException());

      const dto: UpdateFieldDto = {
        field: 'title',
        value: 'test',
      };

      await expect(
        controller.updateField('tenant-1', 'non-existent', dto),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
