import { Test, TestingModule } from '@nestjs/testing';
import { SchedulerController } from './scheduler.controller';
import { SchedulerService } from './scheduler.service';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { ScopesGuard } from '../auth/guards/scopes.guard';

describe('SchedulerController', () => {
  let controller: SchedulerController;
  let service: any;

  const mockTask = {
    id: 'task-1',
    tenantId: 'tenant-1',
    name: 'Test Task',
    message: 'Hello',
    scheduleType: 'cron',
    scheduleValue: '0 4 * * *',
    status: 'active',
  };

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue(mockTask),
      findAll: jest.fn().mockResolvedValue({ data: [mockTask], total: 1 }),
      findOne: jest.fn().mockResolvedValue(mockTask),
      update: jest.fn().mockResolvedValue(mockTask),
      softDelete: jest.fn().mockResolvedValue({ ...mockTask, status: 'deleted' }),
      pause: jest.fn().mockResolvedValue({ ...mockTask, status: 'paused' }),
      resume: jest.fn().mockResolvedValue(mockTask),
      trigger: jest.fn().mockResolvedValue({ id: 'exec-1', status: 'running' }),
      findExecutions: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      findExecution: jest.fn().mockResolvedValue({ id: 'exec-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SchedulerController],
      providers: [
        { provide: SchedulerService, useValue: service },
      ],
    })
      .overrideGuard(ApiKeyGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ScopesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SchedulerController>(SchedulerController);
  });

  describe('POST /', () => {
    it('should create a scheduled task', async () => {
      const dto = {
        tenantId: 'tenant-1',
        name: 'Daily Summary',
        message: 'Summarize',
        scheduleType: 'cron' as const,
        scheduleValue: '0 4 * * *',
      };

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockTask);
    });
  });

  describe('GET /', () => {
    it('should list tasks with filters', async () => {
      const result = await controller.findAll('tenant-1', 'active', '1', '20');

      expect(service.findAll).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        status: 'active',
        page: 1,
        limit: 20,
      });
      expect(result.total).toBe(1);
    });
  });

  describe('GET /:id', () => {
    it('should return task detail', async () => {
      const result = await controller.findOne('task-1');

      expect(service.findOne).toHaveBeenCalledWith('task-1');
      expect(result.id).toBe('task-1');
    });
  });

  describe('PUT /:id', () => {
    it('should update task', async () => {
      const dto = { name: 'Updated Name' };
      await controller.update('task-1', dto);

      expect(service.update).toHaveBeenCalledWith('task-1', dto);
    });
  });

  describe('DELETE /:id', () => {
    it('should soft delete task', async () => {
      const result = await controller.remove('task-1');

      expect(service.softDelete).toHaveBeenCalledWith('task-1');
      expect(result.status).toBe('deleted');
    });
  });

  describe('POST /:id/pause', () => {
    it('should pause task', async () => {
      const result = await controller.pause('task-1');

      expect(service.pause).toHaveBeenCalledWith('task-1');
      expect(result.status).toBe('paused');
    });
  });

  describe('POST /:id/resume', () => {
    it('should resume task', async () => {
      await controller.resume('task-1');

      expect(service.resume).toHaveBeenCalledWith('task-1');
    });
  });

  describe('POST /:id/trigger', () => {
    it('should manually trigger task', async () => {
      const result = await controller.trigger('task-1');

      expect(service.trigger).toHaveBeenCalledWith('task-1');
      expect(result.status).toBe('running');
    });
  });

  describe('GET /:id/executions', () => {
    it('should list executions', async () => {
      const result = await controller.findExecutions('task-1', '1', '10');

      expect(service.findExecutions).toHaveBeenCalledWith('task-1', {
        page: 1,
        limit: 10,
        status: undefined,
      });
    });
  });

  describe('GET /:id/executions/:execId', () => {
    it('should return execution detail', async () => {
      const result = await controller.findExecution('task-1', 'exec-1');

      expect(service.findExecution).toHaveBeenCalledWith('task-1', 'exec-1');
      expect(result.id).toBe('exec-1');
    });
  });
});
