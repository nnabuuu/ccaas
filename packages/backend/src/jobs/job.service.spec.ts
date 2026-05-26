// Mock liteque ESM module before any imports
jest.mock('liteque', () => ({
  buildDBClient: jest.fn(),
  SqliteQueue: jest.fn(),
  Runner: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { JobService } from './job.service';
import { JobEntity } from './entities/job.entity';
import { QueueService } from './queue.service';
import { HeadlessExecutionService } from '../scheduler/headless-execution.service';
import { StreamRegistryService } from '../sessions/services/stream-registry.service';
import { CreateJobDto } from './dto/create-job.dto';

describe('JobService', () => {
  let module: TestingModule;
  let service: JobService;
  let jobRepo: any;
  let queueService: any;
  let headlessExecution: any;
  let moduleRef: any;
  let capturedHandlers: { run: any; onComplete: any; onError: any };
  let mockQueryBuilder: any;

  const mockJob: Partial<JobEntity> = {
    id: 'job-1',
    solutionId: 'tenant-1',
    sessionId: 'session-1',
    messageId: 'msg-1',
    type: 'notebooklm_podcast',
    name: 'Generate Podcast',
    prompt: 'Create a podcast about AI',
    status: 'pending',
    attempts: 0,
    maxAttempts: 3,
    timeoutMs: 600000,
    mcpServers: { notebooklm: { url: 'http://localhost:3002' } },
    enabledSkills: ['notebooklm'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    capturedHandlers = { run: null, onComplete: null, onError: null };

    mockQueryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[{ ...mockJob }], 1]),
    };

    jobRepo = {
      create: jest.fn((data) => ({ ...mockJob, ...data })),
      save: jest.fn((entity) => Promise.resolve({ ...mockJob, ...entity })),
      findOneBy: jest.fn().mockResolvedValue({ ...mockJob }),
      createQueryBuilder: jest.fn(() => mockQueryBuilder),
    };

    queueService = {
      registerHandlers: jest.fn((run, onComplete, onError) => {
        capturedHandlers.run = run;
        capturedHandlers.onComplete = onComplete;
        capturedHandlers.onError = onError;
      }),
      enqueue: jest.fn().mockResolvedValue({ id: 1 }),
    };

    headlessExecution = {
      executeJob: jest.fn().mockResolvedValue({
        resultText: 'Podcast generated successfully',
        tokenUsage: { input: 1000, output: 500, cached: 200 },
        exitCode: 0,
        workspacePath: '/tmp/workspace/jobs/bg-session-1',
      }),
    };

    moduleRef = {
      get: jest.fn().mockReturnValue(null),
    };

    module = await Test.createTestingModule({
      providers: [
        JobService,
        { provide: getRepositoryToken(JobEntity), useValue: jobRepo },
        { provide: QueueService, useValue: queueService },
        { provide: HeadlessExecutionService, useValue: headlessExecution },
        { provide: StreamRegistryService, useValue: { emit: jest.fn() } },
        { provide: ModuleRef, useValue: moduleRef },
      ],
    }).compile();

    service = module.get<JobService>(JobService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('create', () => {
    const dto: CreateJobDto = {
      solutionId: 'tenant-1',
      type: 'notebooklm_podcast',
      name: 'Generate Podcast',
      prompt: 'Create a podcast about AI',
      sessionId: 'session-1',
      messageId: 'msg-1',
      mcpServers: { notebooklm: { url: 'http://localhost:3002' } },
      enabledSkills: ['notebooklm'],
    };

    it('creates entity with status=pending, attempts=0 and enqueues to liteque', async () => {
      const result = await service.create(dto);

      expect(jobRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          solutionId: 'tenant-1',
          type: 'notebooklm_podcast',
          status: 'pending',
          attempts: 0,
        }),
      );
      expect(jobRepo.save).toHaveBeenCalled();
      expect(queueService.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          jobEntityId: expect.any(String),
          type: 'notebooklm_podcast',
          prompt: 'Create a podcast about AI',
          solutionId: 'tenant-1',
        }),
        { numRetries: 2 },
      );
      expect(result.status).toBe('pending');
    });

    it('defaults maxAttempts=3, timeoutMs=600000', async () => {
      const minimalDto: CreateJobDto = {
        solutionId: 'tenant-1',
        type: 'test',
        name: 'Test',
        prompt: 'test prompt',
      };

      await service.create(minimalDto);

      expect(jobRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          maxAttempts: 3,
          timeoutMs: 600000,
        }),
      );
    });

    it('passes mcpServers and enabledSkills in queue payload', async () => {
      await service.create(dto);

      expect(queueService.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          mcpServers: { notebooklm: { url: 'http://localhost:3002' } },
          enabledSkills: ['notebooklm'],
        }),
        expect.any(Object),
      );
    });
  });

  describe('findById', () => {
    it('returns entity when found', async () => {
      const result = await service.findById('job-1');
      expect(result.id).toBe('job-1');
      expect(jobRepo.findOneBy).toHaveBeenCalledWith({ id: 'job-1' });
    });

    it('throws NotFoundException when not found', async () => {
      jobRepo.findOneBy.mockResolvedValue(null);
      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('resume', () => {
    it('re-enqueues failed job with resumeSessionId from bgSessionId', async () => {
      const failedJob = {
        ...mockJob,
        status: 'failed' as const,
        bgSessionId: 'bg-session-1',
        attempts: 1,
      };
      jobRepo.findOneBy.mockResolvedValue(failedJob);

      await service.resume('job-1');

      expect(queueService.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          resumeSessionId: 'bg-session-1',
        }),
        expect.any(Object),
      );
    });

    it('allows resuming cancelled jobs', async () => {
      const cancelledJob = {
        ...mockJob,
        status: 'cancelled' as const,
        bgSessionId: 'bg-session-1',
        attempts: 1,
      };
      jobRepo.findOneBy.mockResolvedValue(cancelledJob);

      const result = await service.resume('job-1');
      expect(result.status).toBe('pending');
    });

    it('rejects resume for running jobs', async () => {
      jobRepo.findOneBy.mockResolvedValue({ ...mockJob, status: 'running' });
      await expect(service.resume('job-1')).rejects.toThrow('Cannot resume job with status: running');
    });

    it('rejects resume for completed jobs', async () => {
      jobRepo.findOneBy.mockResolvedValue({ ...mockJob, status: 'completed' });
      await expect(service.resume('job-1')).rejects.toThrow('Cannot resume job with status: completed');
    });
  });

  describe('cancel', () => {
    it('cancels pending jobs and sets completedAt', async () => {
      jobRepo.findOneBy.mockResolvedValue({ ...mockJob, status: 'pending' });

      const result = await service.cancel('job-1');

      expect(result.status).toBe('cancelled');
      expect(jobRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'cancelled', completedAt: expect.any(Date) }),
      );
    });

    it('cancels running jobs', async () => {
      jobRepo.findOneBy.mockResolvedValue({ ...mockJob, status: 'running' });

      const result = await service.cancel('job-1');
      expect(result.status).toBe('cancelled');
    });

    it('rejects cancel for completed jobs', async () => {
      jobRepo.findOneBy.mockResolvedValue({ ...mockJob, status: 'completed' });
      await expect(service.cancel('job-1')).rejects.toThrow('Cannot cancel job with status: completed');
    });

    it('rejects cancel for already cancelled jobs', async () => {
      jobRepo.findOneBy.mockResolvedValue({ ...mockJob, status: 'cancelled' });
      await expect(service.cancel('job-1')).rejects.toThrow('Cannot cancel job with status: cancelled');
    });
  });

  describe('findAll', () => {
    it('returns paginated results with default page=1, limit=20', async () => {
      const result = await service.findAll();

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(20);
      expect(result).toEqual({
        data: [expect.objectContaining({ id: 'job-1' })],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it('filters by solutionId, sessionId, status', async () => {
      await service.findAll({ solutionId: 'tenant-1', sessionId: 'session-1', status: 'pending' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('job.solutionId = :solutionId', { solutionId: 'tenant-1' });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('job.sessionId = :sessionId', { sessionId: 'session-1' });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('job.status = :status', { status: 'pending' });
    });

    it('applies custom pagination', async () => {
      await service.findAll({ page: 3, limit: 5 });

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(10);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(5);
    });
  });

  describe('getFilePath', () => {
    const jobWithSession: Partial<JobEntity> = {
      ...mockJob,
      bgSessionId: 'bg-session-1',
    };

    beforeEach(() => {
      moduleRef.get.mockReturnValue({
        get: jest.fn().mockReturnValue('/tmp/test-workspace'),
      });
    });

    it('returns null when bgSessionId missing', () => {
      const jobWithoutSession = { ...mockJob, bgSessionId: undefined } as JobEntity;
      expect(service.getFilePath(jobWithoutSession, 'file.txt')).toBeNull();
    });

    it('blocks path traversal', () => {
      const result = service.getFilePath(jobWithSession as JobEntity, '../../etc/passwd');
      expect(result).toBeNull();
    });

    it('returns null for nonexistent file', () => {
      const result = service.getFilePath(jobWithSession as JobEntity, 'nonexistent.txt');
      expect(result).toBeNull();
    });
  });

  describe('onModuleInit — queue handlers', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('registers run, onComplete, onError with QueueService', () => {
      expect(queueService.registerHandlers).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        expect.any(Function),
      );
      expect(capturedHandlers.run).toBeTruthy();
      expect(capturedHandlers.onComplete).toBeTruthy();
      expect(capturedHandlers.onError).toBeTruthy();
    });

    describe('run handler', () => {
      it('updates entity to running, increments attempts, sets bgSessionId', async () => {
        const entity = { ...mockJob, attempts: 0 };
        jobRepo.findOneBy.mockResolvedValue(entity);

        await capturedHandlers.run({ data: { jobEntityId: 'job-1' } });

        expect(jobRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'running',
            attempts: 1,
            bgSessionId: expect.any(String),
            startedAt: expect.any(Date),
          }),
        );
      });

      it('calls HeadlessExecutionService.executeJob with correct params', async () => {
        const entity = { ...mockJob };
        jobRepo.findOneBy.mockResolvedValue(entity);

        const mockDequeuedJob = {
          data: {
            jobEntityId: 'job-1',
            solutionId: 'tenant-1',
            prompt: 'Create a podcast',
            mcpServers: { notebooklm: {} },
            enabledSkills: ['notebooklm'],
          },
        };

        await capturedHandlers.run(mockDequeuedJob);

        expect(headlessExecution.executeJob).toHaveBeenCalledWith(
          expect.objectContaining({
            solutionId: 'tenant-1',
            prompt: 'Create a podcast',
            mcpServers: { notebooklm: {} },
            enabledSkills: ['notebooklm'],
          }),
          expect.objectContaining({
            preserveWorkspace: true,
            timeoutMs: 600000,
          }),
        );
      });

      it('throws if entity not found', async () => {
        jobRepo.findOneBy.mockResolvedValue(null);

        await expect(
          capturedHandlers.run({ data: { jobEntityId: 'nonexistent' } }),
        ).rejects.toThrow('Job entity not found: nonexistent');
      });
    });

    describe('onComplete handler', () => {
      it('updates entity to completed with resultText, tokenUsage, resultFiles', async () => {
        const entity = { ...mockJob, status: 'running' };
        jobRepo.findOneBy.mockResolvedValue(entity);

        const result = {
          resultText: 'Podcast generated',
          tokenUsage: { input: 1000, output: 500, cached: 200 },
          exitCode: 0,
          bgSessionId: 'bg-1',
          workspacePath: '',
        };

        await capturedHandlers.onComplete(
          { data: { jobEntityId: 'job-1' } },
          result,
        );

        expect(jobRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'completed',
            resultText: 'Podcast generated',
            completedAt: expect.any(Date),
            tokenUsage: { input: 1000, output: 500, cached: 200 },
          }),
        );
      });
    });

    describe('onError handler', () => {
      it('sets status=failed when numRetriesLeft=0', async () => {
        const entity = { ...mockJob, status: 'running' };
        jobRepo.findOneBy.mockResolvedValue(entity);

        await capturedHandlers.onError({
          data: { jobEntityId: 'job-1' },
          numRetriesLeft: 0,
          error: { message: 'CLI timeout' },
        });

        expect(jobRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'failed',
            errorMessage: 'CLI timeout',
            completedAt: expect.any(Date),
          }),
        );
      });

      it('keeps status=pending when retries remain', async () => {
        const entity = { ...mockJob, status: 'running' };
        jobRepo.findOneBy.mockResolvedValue(entity);

        await capturedHandlers.onError({
          data: { jobEntityId: 'job-1' },
          numRetriesLeft: 2,
          error: { message: 'Temporary failure' },
        });

        expect(jobRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'pending',
            errorMessage: 'Temporary failure',
          }),
        );
      });
    });
  });

  describe('Socket.io emission', () => {
    it('emits job_update to tenant room and session room', async () => {
      const mockEmit = jest.fn();
      const mockTo = jest.fn().mockReturnValue({ emit: mockEmit });
      (service as any).ioServer = { to: mockTo };

      await service.create({
        solutionId: 'tenant-1',
        type: 'test',
        name: 'Test',
        prompt: 'test',
        sessionId: 'session-1',
      });

      expect(mockTo).toHaveBeenCalledWith('jobs:tenant-1');
      expect(mockTo).toHaveBeenCalledWith('session-1');
      expect(mockEmit).toHaveBeenCalledWith(
        'job_update',
        expect.objectContaining({
          type: 'job_update',
          status: 'pending',
        }),
      );
    });

    it('does not throw when ioServer is null', async () => {
      (service as any).ioServer = null;

      await expect(
        service.create({
          solutionId: 'tenant-1',
          type: 'test',
          name: 'Test',
          prompt: 'test',
        }),
      ).resolves.toBeDefined();
    });
  });
});
