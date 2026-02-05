import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ModuleRef } from '@nestjs/core';
import { SchedulerService } from './scheduler.service';
import { HeadlessExecutionService } from './headless-execution.service';
import { MessagesService } from '../messages/messages.service';
import { ScheduledTask } from './entities/scheduled-task.entity';
import { ScheduledTaskExecution } from './entities/scheduled-task-execution.entity';

describe('SchedulerService', () => {
  let service: SchedulerService;
  let taskRepo: any;
  let executionRepo: any;
  let schedulerRegistry: any;
  let headlessExecution: any;
  let messagesService: any;

  const mockTask: Partial<ScheduledTask> = {
    id: 'task-1',
    tenantId: 'tenant-1',
    name: 'Test Task',
    description: 'A test task',
    message: 'Hello Claude',
    scheduleType: 'cron',
    scheduleValue: '0 4 * * *',
    status: 'active',
    maxConcurrent: 1,
    maxRetries: 0,
    retryDelayMs: 60000,
    timeoutMs: 600000,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    taskRepo = {
      create: jest.fn().mockImplementation((data) => ({ ...data, id: 'new-task-id' })),
      save: jest.fn().mockImplementation((data) => Promise.resolve(data)),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
    };

    executionRepo = {
      create: jest.fn().mockImplementation((data) => ({ ...data, id: 'exec-1' })),
      save: jest.fn().mockImplementation((data) => Promise.resolve(data)),
      count: jest.fn().mockResolvedValue(0),
      findOne: jest.fn().mockResolvedValue(null),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
    };

    schedulerRegistry = {
      addCronJob: jest.fn(),
      addInterval: jest.fn(),
      addTimeout: jest.fn(),
      deleteCronJob: jest.fn(),
      deleteInterval: jest.fn(),
      deleteTimeout: jest.fn(),
      doesExist: jest.fn().mockReturnValue(false),
    };

    headlessExecution = {
      execute: jest.fn().mockResolvedValue({
        resultText: 'Task completed',
        tokenUsage: { input: 100, output: 50, cached: 0 },
        events: [],
        exitCode: 0,
      }),
    };

    messagesService = {
      create: jest.fn().mockResolvedValue({ id: 'msg-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerService,
        { provide: getRepositoryToken(ScheduledTask), useValue: taskRepo },
        { provide: getRepositoryToken(ScheduledTaskExecution), useValue: executionRepo },
        { provide: SchedulerRegistry, useValue: schedulerRegistry },
        { provide: HeadlessExecutionService, useValue: headlessExecution },
        { provide: MessagesService, useValue: messagesService },
        {
          provide: ModuleRef,
          useValue: { get: jest.fn().mockReturnValue(null) },
        },
      ],
    }).compile();

    service = module.get<SchedulerService>(SchedulerService);
  });

  describe('create', () => {
    it('should create a scheduled task and register cron', async () => {
      const dto = {
        tenantId: 'tenant-1',
        name: 'Daily Summary',
        message: 'Summarize websites',
        scheduleType: 'cron' as const,
        scheduleValue: '0 4 * * *',
      };

      taskRepo.save.mockResolvedValue({ ...dto, id: 'new-task-id', status: 'active' });

      const result = await service.create(dto);

      expect(taskRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        tenantId: 'tenant-1',
        name: 'Daily Summary',
        scheduleType: 'cron',
        scheduleValue: '0 4 * * *',
        status: 'active',
      }));
      expect(taskRepo.save).toHaveBeenCalled();
      expect(schedulerRegistry.addCronJob).toHaveBeenCalledWith(
        expect.stringContaining('scheduled_task_'),
        expect.any(Object),
      );
    });

    it('should create an interval task', async () => {
      const dto = {
        tenantId: 'tenant-1',
        name: 'Periodic Check',
        message: 'Check status',
        scheduleType: 'interval' as const,
        scheduleValue: '60000',
      };

      taskRepo.save.mockResolvedValue({ ...dto, id: 'new-task-id', status: 'active' });

      await service.create(dto);

      expect(schedulerRegistry.addInterval).toHaveBeenCalledWith(
        expect.stringContaining('scheduled_task_'),
        expect.anything(),
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated tasks', async () => {
      const tasks = [mockTask as ScheduledTask];
      taskRepo.findAndCount.mockResolvedValue([tasks, 1]);

      const result = await service.findAll({ tenantId: 'tenant-1', page: 1, limit: 20 });

      expect(result).toEqual({ data: tasks, total: 1 });
      expect(taskRepo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({
        where: { tenantId: 'tenant-1' },
        take: 20,
        skip: 0,
      }));
    });

    it('should filter by status', async () => {
      taskRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ status: 'paused' });

      expect(taskRepo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({
        where: { status: 'paused' },
      }));
    });
  });

  describe('findOne', () => {
    it('should return task with executions', async () => {
      taskRepo.findOne.mockResolvedValue({ ...mockTask, executions: [] });

      const result = await service.findOne('task-1');

      expect(result.id).toBe('task-1');
      expect(taskRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        relations: ['executions'],
      });
    });

    it('should throw NotFoundException when not found', async () => {
      taskRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow();
    });
  });

  describe('softDelete', () => {
    it('should set status to deleted and unregister schedule', async () => {
      taskRepo.findOne.mockResolvedValue({ ...mockTask, executions: [] });
      taskRepo.save.mockImplementation((t: any) => Promise.resolve(t));

      const result = await service.softDelete('task-1');

      expect(result.status).toBe('deleted');
    });
  });

  describe('pause', () => {
    it('should set status to paused and unregister schedule', async () => {
      taskRepo.findOne.mockResolvedValue({ ...mockTask, executions: [] });
      taskRepo.save.mockImplementation((t: any) => Promise.resolve(t));

      const result = await service.pause('task-1');

      expect(result.status).toBe('paused');
    });
  });

  describe('resume', () => {
    it('should set status to active and re-register schedule', async () => {
      taskRepo.findOne.mockResolvedValue({
        ...mockTask,
        status: 'paused',
        executions: [],
      });
      taskRepo.save.mockImplementation((t: any) => Promise.resolve(t));

      const result = await service.resume('task-1');

      expect(result.status).toBe('active');
      expect(schedulerRegistry.addCronJob).toHaveBeenCalled();
    });
  });

  describe('triggerExecution', () => {
    it('should create execution and start headless run', async () => {
      const task = { ...mockTask, executions: [] } as ScheduledTask;
      taskRepo.findOne.mockResolvedValue(task);
      executionRepo.count.mockResolvedValue(0);
      executionRepo.save.mockImplementation((e: any) => Promise.resolve(e));
      taskRepo.save.mockImplementation((t: any) => Promise.resolve(t));

      const result = await service.trigger('task-1');

      expect(executionRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        taskId: 'task-1',
        tenantId: 'tenant-1',
        status: 'running',
      }));
      expect(executionRepo.save).toHaveBeenCalled();
    });

    it('should reject when max concurrency reached', async () => {
      const task = { ...mockTask, executions: [] } as ScheduledTask;
      taskRepo.findOne.mockResolvedValue(task);
      executionRepo.count.mockResolvedValue(1); // maxConcurrent is 1

      await expect(service.trigger('task-1')).rejects.toThrow('Max concurrency reached');
    });
  });

  describe('findExecutions', () => {
    it('should return paginated executions', async () => {
      executionRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findExecutions('task-1', { page: 1, limit: 10 });

      expect(result).toEqual({ data: [], total: 0 });
      expect(executionRepo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({
        where: { taskId: 'task-1' },
      }));
    });
  });

  describe('findExecution', () => {
    it('should throw when not found', async () => {
      executionRepo.findOne.mockResolvedValue(null);

      await expect(service.findExecution('task-1', 'exec-999')).rejects.toThrow();
    });
  });
});
