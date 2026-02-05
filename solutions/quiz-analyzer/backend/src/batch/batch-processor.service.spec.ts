import { Test, TestingModule } from '@nestjs/testing';
import { BatchProcessorService } from './batch-processor.service';
import { BatchService } from './batch.service';
import { AnalysesService } from '../analyses/analyses.service';

describe('BatchProcessorService', () => {
  let service: BatchProcessorService;
  let batchService: BatchService;
  let analysesService: AnalysesService;

  const mockBatchService = {
    findOne: jest.fn(),
    updateStatus: jest.fn(),
    updateProgress: jest.fn(),
    addResult: jest.fn(),
  };

  const mockAnalysesService = {
    create: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BatchProcessorService,
        {
          provide: BatchService,
          useValue: mockBatchService,
        },
        {
          provide: AnalysesService,
          useValue: mockAnalysesService,
        },
      ],
    }).compile();

    service = module.get<BatchProcessorService>(BatchProcessorService);
    batchService = module.get<BatchService>(BatchService);
    analysesService = module.get<AnalysesService>(AnalysesService);

    // Default mock behaviors
    mockBatchService.updateStatus.mockResolvedValue({});
    mockBatchService.updateProgress.mockResolvedValue({});
    mockBatchService.addResult.mockResolvedValue({});
    mockAnalysesService.create.mockResolvedValue({ id: 'analysis-test' });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getQueueSize', () => {
    it('should return 0 initially', () => {
      expect(service.getQueueSize()).toBe(0);
    });
  });

  describe('isJobInQueue', () => {
    it('should return false for non-existent job', () => {
      expect(service.isJobInQueue('non-existent')).toBe(false);
    });
  });

  describe('enqueue', () => {
    it('should successfully enqueue a job', async () => {
      const jobId = 'test-job-1';
      const mockJob = {
        id: jobId,
        name: 'Test Batch',
        quiz_ids: ['quiz-1', 'quiz-2'],
        total_count: 2,
        completed_count: 0,
        failed_count: 0,
        status: 'running',
      };

      mockBatchService.findOne.mockResolvedValue(mockJob);

      await service.enqueue(jobId);

      expect(mockBatchService.findOne).toHaveBeenCalledWith(jobId);
    });

    it('should call batch service methods during processing', async () => {
      const jobId = 'test-job-2';
      const mockJob = {
        id: jobId,
        quiz_ids: ['quiz-1'],
        total_count: 1,
        completed_count: 0,
        failed_count: 0,
        status: 'running',
      };

      mockBatchService.findOne.mockResolvedValue(mockJob);

      await service.enqueue(jobId);

      // Wait for processing to start
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should have called findOne to get the job
      expect(mockBatchService.findOne).toHaveBeenCalled();
    });
  });

  describe('batch processing integration', () => {
    it('should update status to running when processing starts', async () => {
      const jobId = 'test-job-3';
      const mockJob = {
        id: jobId,
        quiz_ids: ['quiz-1'],
        total_count: 1,
        completed_count: 0,
        failed_count: 0,
        status: 'running',
      };

      mockBatchService.findOne.mockResolvedValue(mockJob);

      await service.enqueue(jobId);

      // Wait for initial status update
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockBatchService.updateStatus).toHaveBeenCalledWith(
        jobId,
        'running',
        expect.any(String),
      );
    });

    it('should handle cancellation gracefully', async () => {
      const jobId = 'test-job-4';
      const mockJob = {
        id: jobId,
        quiz_ids: ['quiz-1', 'quiz-2'],
        total_count: 2,
        completed_count: 0,
        failed_count: 0,
        status: 'cancelled',
      };

      mockBatchService.findOne.mockResolvedValue(mockJob);

      await service.enqueue(jobId);

      // Wait for cancellation check
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Processing should stop on cancelled status
      expect(mockBatchService.findOne).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should treat 409 conflict as success', async () => {
      const jobId = 'test-job-6';
      const mockJob = {
        id: jobId,
        quiz_ids: ['quiz-1'],
        total_count: 1,
        completed_count: 0,
        failed_count: 0,
        status: 'running',
      };

      const conflictError: any = new Error('Already exists');
      conflictError.status = 409;

      mockBatchService.findOne.mockResolvedValue(mockJob);
      mockAnalysesService.create.mockRejectedValue(conflictError);

      await service.enqueue(jobId);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Should record as completed despite 409 error
      expect(mockBatchService.addResult).toHaveBeenCalledWith(
        jobId,
        expect.objectContaining({
          quizId: 'quiz-1',
          status: 'completed',
        }),
      );
    });
  });
});
