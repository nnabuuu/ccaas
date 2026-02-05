/* eslint-disable @typescript-eslint/no-require-imports */

// Mock liteque before imports
const mockQueue = {
  enqueue: jest.fn().mockResolvedValue({ id: 1 }),
  stats: jest.fn().mockResolvedValue({ pending: 0, running: 0, completed: 0, failed: 0 }),
};

const mockRunner = {
  run: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn(),
};

jest.mock('liteque', () => ({
  buildDBClient: jest.fn().mockReturnValue({}),
  SqliteQueue: jest.fn().mockImplementation(() => mockQueue),
  Runner: jest.fn().mockImplementation(() => mockRunner),
}));

jest.mock('node:fs', () => ({
  mkdirSync: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { QueueService } from './queue.service';

describe('QueueService', () => {
  let service: QueueService;
  let configService: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    configService = {
      get: jest.fn().mockReturnValue('.agent-workspace'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
  });

  describe('onModuleInit', () => {
    it('creates data directory', () => {
      const fs = require('node:fs');
      service.onModuleInit();

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('data'),
        { recursive: true },
      );
    });

    it('initializes SqliteQueue with correct config', () => {
      const { SqliteQueue } = require('liteque');
      service.onModuleInit();

      expect(SqliteQueue).toHaveBeenCalledWith(
        'background_jobs',
        expect.any(Object),
        expect.objectContaining({ keepFailedJobs: true }),
      );
    });

    it('creates Runner with concurrency=2, pollIntervalMs=3000, timeoutSecs=600', () => {
      const { Runner } = require('liteque');
      service.onModuleInit();

      expect(Runner).toHaveBeenCalledWith(
        mockQueue,
        expect.objectContaining({
          run: expect.any(Function),
          onComplete: expect.any(Function),
          onError: expect.any(Function),
        }),
        expect.objectContaining({
          concurrency: 2,
          pollIntervalMs: 3000,
          timeoutSecs: 600,
        }),
      );
    });

    it('starts runner.run()', () => {
      service.onModuleInit();
      expect(mockRunner.run).toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('calls runner.stop()', () => {
      service.onModuleInit();
      service.onModuleDestroy();
      expect(mockRunner.stop).toHaveBeenCalled();
    });
  });

  describe('registerHandlers', () => {
    it('stores handlers and delegates to Runner callbacks', async () => {
      service.onModuleInit();

      const runHandler = jest.fn().mockResolvedValue({ resultText: 'done' });
      const completeHandler = jest.fn().mockResolvedValue(undefined);
      const errorHandler = jest.fn().mockResolvedValue(undefined);

      service.registerHandlers(runHandler, completeHandler, errorHandler);

      // Get the Runner callbacks and invoke them to verify delegation
      const { Runner } = require('liteque');
      const runnerCallbacks = Runner.mock.calls[0][1];

      const mockDequeuedJob = { data: { jobEntityId: 'job-1' } };
      await runnerCallbacks.run(mockDequeuedJob);
      expect(runHandler).toHaveBeenCalledWith(mockDequeuedJob);

      await runnerCallbacks.onComplete(mockDequeuedJob, { resultText: 'ok' });
      expect(completeHandler).toHaveBeenCalledWith(mockDequeuedJob, { resultText: 'ok' });

      await runnerCallbacks.onError(mockDequeuedJob);
      expect(errorHandler).toHaveBeenCalledWith(mockDequeuedJob);
    });
  });

  describe('enqueue', () => {
    it('calls queue.enqueue with payload, defaults numRetries=2', async () => {
      service.onModuleInit();

      const payload = {
        jobEntityId: 'job-1',
        type: 'test',
        prompt: 'test prompt',
        tenantId: 'tenant-1',
      };

      await service.enqueue(payload);

      expect(mockQueue.enqueue).toHaveBeenCalledWith(payload, { numRetries: 2 });
    });

    it('respects custom numRetries', async () => {
      service.onModuleInit();

      const payload = {
        jobEntityId: 'job-1',
        type: 'test',
        prompt: 'test',
        tenantId: 'tenant-1',
      };

      await service.enqueue(payload, { numRetries: 5 });

      expect(mockQueue.enqueue).toHaveBeenCalledWith(payload, { numRetries: 5 });
    });
  });

  describe('stats', () => {
    it('delegates to queue.stats()', async () => {
      service.onModuleInit();

      const result = await service.stats();

      expect(mockQueue.stats).toHaveBeenCalled();
      expect(result).toEqual({ pending: 0, running: 0, completed: 0, failed: 0 });
    });
  });
});
