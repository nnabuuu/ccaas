// Mock liteque ESM module before any imports
jest.mock('liteque', () => ({
  buildDBClient: jest.fn(),
  SqliteQueue: jest.fn(),
  Runner: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { JobController } from './job.controller';
import { JobService } from './job.service';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { ScopesGuard } from '../auth/guards/scopes.guard';

describe('JobController', () => {
  let controller: JobController;
  let service: any;

  const mockJob = {
    id: 'job-1',
    tenantId: 'tenant-1',
    type: 'notebooklm_podcast',
    name: 'Generate Podcast',
    prompt: 'Create a podcast',
    status: 'pending',
    attempts: 0,
    maxAttempts: 3,
    timeoutMs: 600000,
  };

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue(mockJob),
      findAll: jest.fn().mockResolvedValue({ data: [mockJob], total: 1, page: 1, limit: 20, totalPages: 1 }),
      findById: jest.fn().mockResolvedValue(mockJob),
      resume: jest.fn().mockResolvedValue({ ...mockJob, status: 'pending' }),
      cancel: jest.fn().mockResolvedValue({ ...mockJob, status: 'cancelled' }),
      getFilePath: jest.fn().mockReturnValue('/tmp/workspace/podcast.mp3'),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [JobController],
      providers: [
        { provide: JobService, useValue: service },
      ],
    })
      .overrideGuard(ApiKeyGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ScopesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<JobController>(JobController);
  });

  describe('POST /api/v1/jobs', () => {
    it('delegates to jobService.create', async () => {
      const dto = {
        tenantId: 'tenant-1',
        type: 'notebooklm_podcast',
        name: 'Generate Podcast',
        prompt: 'Create a podcast',
      };

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockJob);
    });
  });

  describe('GET /api/v1/jobs', () => {
    it('delegates with parsed query params', async () => {
      const result = await controller.findAll('tenant-1', 'session-1', 'pending', '2', '10');

      expect(service.findAll).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        status: 'pending',
        page: 2,
        limit: 10,
      });
      expect(result.total).toBe(1);
    });

    it('handles missing query params', async () => {
      await controller.findAll(undefined, undefined, undefined, undefined, undefined);

      expect(service.findAll).toHaveBeenCalledWith({
        tenantId: undefined,
        sessionId: undefined,
        status: undefined,
        page: undefined,
        limit: undefined,
      });
    });
  });

  describe('GET /api/v1/jobs/:id', () => {
    it('delegates to findById', async () => {
      const result = await controller.findOne('job-1');

      expect(service.findById).toHaveBeenCalledWith('job-1');
      expect(result.id).toBe('job-1');
    });
  });

  describe('POST /api/v1/jobs/:id/resume', () => {
    it('delegates to resume', async () => {
      const result = await controller.resume('job-1');

      expect(service.resume).toHaveBeenCalledWith('job-1');
      expect(result.status).toBe('pending');
    });
  });

  describe('POST /api/v1/jobs/:id/cancel', () => {
    it('delegates to cancel', async () => {
      const result = await controller.cancel('job-1');

      expect(service.cancel).toHaveBeenCalledWith('job-1');
      expect(result.status).toBe('cancelled');
    });
  });

  describe('GET /api/v1/jobs/:id/files/:filename', () => {
    it('serves file when found', async () => {
      const mockRes = {
        sendFile: jest.fn(),
      } as any;

      await controller.serveFile('job-1', 'podcast.mp3', mockRes);

      expect(service.findById).toHaveBeenCalledWith('job-1');
      expect(service.getFilePath).toHaveBeenCalledWith(mockJob, 'podcast.mp3');
      expect(mockRes.sendFile).toHaveBeenCalledWith('/tmp/workspace/podcast.mp3');
    });

    it('throws NotFoundException when file not found', async () => {
      service.getFilePath.mockReturnValue(null);

      const mockRes = { sendFile: jest.fn() } as any;

      await expect(
        controller.serveFile('job-1', 'missing.txt', mockRes),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
