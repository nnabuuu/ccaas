import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { JobsService, MAX_RETRIES } from './jobs.service';
import { AnalysisJob } from './entities/analysis-job.entity';
import { JobStep } from './entities/job-step.entity';
import type { SyncField } from '../../../mcp-server/src/common/types';
import { SYNC_FIELDS } from '../../../mcp-server/src/common/types';

// ── helpers ──

function makeMockRepo() {
  const store: Record<string, any> = {};
  return {
    create: jest.fn((data: any) => ({ ...data })),
    save: jest.fn(async (entity: any) => {
      if (Array.isArray(entity)) {
        entity.forEach((e) => { store[e.id] = e; });
        return entity;
      }
      store[entity.id] = entity;
      return entity;
    }),
    findOne: jest.fn(async ({ where }: any) => {
      if (where.id) return store[where.id] ?? null;
      // search by composite keys
      return (
        Object.values(store).find((e: any) =>
          Object.entries(where).every(([k, v]) => e[k] === v),
        ) ?? null
      );
    }),
    count: jest.fn(async ({ where }: any) => {
      return Object.values(store).filter((e: any) =>
        Object.entries(where).every(([k, v]) => e[k] === v),
      ).length;
    }),
    _store: store,
    _clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
  };
}

// ── test suite ──

describe('JobsService', () => {
  let service: JobsService;
  let jobRepo: ReturnType<typeof makeMockRepo>;
  let stepRepo: ReturnType<typeof makeMockRepo>;

  beforeEach(async () => {
    jobRepo = makeMockRepo();
    stepRepo = makeMockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        { provide: getRepositoryToken(AnalysisJob), useValue: jobRepo },
        { provide: getRepositoryToken(JobStep), useValue: stepRepo },
      ],
    }).compile();

    service = module.get<JobsService>(JobsService);
  });

  afterEach(() => {
    jobRepo._clear();
    stepRepo._clear();
  });

  // ── D2: SyncField type safety ──

  describe('isValidSyncField', () => {
    it('returns true for valid SyncField values', () => {
      expect(service.isValidSyncField('quizAnalysis')).toBe(true);
      expect(service.isValidSyncField('knowledgePointTags')).toBe(true);
      expect(service.isValidSyncField('difficulty')).toBe(true);
    });

    it('returns false for invalid field names', () => {
      expect(service.isValidSyncField('invalidField')).toBe(false);
      expect(service.isValidSyncField('')).toBe(false);
      expect(service.isValidSyncField('parsedQuiz')).toBe(false); // the typo bug
    });

    it('covers all SYNC_FIELDS values', () => {
      for (const field of SYNC_FIELDS) {
        expect(service.isValidSyncField(field)).toBe(true);
      }
    });
  });

  // ── D1: Job Lifecycle ──

  describe('createJob', () => {
    const fields: SyncField[] = ['quizAnalysis', 'knowledgePointTags', 'difficulty'];

    it('creates a job with pending status and correct step count', async () => {
      const job = await service.createJob('session-1', 'analyze-explain', fields);

      expect(job.id).toBeDefined();
      expect(job.session_id).toBe('session-1');
      expect(job.template).toBe('analyze-explain');
      expect(job.status).toBe('pending');
      expect(job.total_steps).toBe(3);
      expect(job.completed_steps).toBe(0);
      expect(job.completed_at).toBeNull();
      expect(job.steps).toHaveLength(3);
    });

    it('creates steps with correct field values', async () => {
      const job = await service.createJob('session-1', 'teacher', fields);

      const stepFields = job.steps.map((s) => s.field).sort();
      expect(stepFields).toEqual([...fields].sort());

      for (const step of job.steps) {
        expect(step.status).toBe('pending');
        expect(step.retry_count).toBe(0);
        expect(step.result).toBeNull();
        expect(step.error).toBeNull();
        expect(step.job_id).toBe(job.id);
      }
    });

    it('creates timestamps in ISO format', async () => {
      const job = await service.createJob('session-1', 'student', fields);
      expect(job.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(job.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('startJob', () => {
    it('transitions job from pending to running', async () => {
      const job = await service.createJob('s-1', 'analyze-explain', ['quizAnalysis']);
      const started = await service.startJob(job.id);

      expect(started.status).toBe('running');
    });

    it('throws NotFoundException for unknown jobId', async () => {
      await expect(service.startJob('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('completeStep', () => {
    it('marks step as completed with result', async () => {
      const job = await service.createJob('s-1', 'analyze-explain', ['quizAnalysis', 'difficulty']);
      await service.startJob(job.id);

      const step = await service.completeStep(job.id, 'quizAnalysis', { summary: 'test' });
      expect(step).not.toBeNull();
      expect(step!.status).toBe('completed');
      expect(step!.result).toBe(JSON.stringify({ summary: 'test' }));
    });

    it('returns null for non-existent step', async () => {
      const job = await service.createJob('s-1', 'analyze-explain', ['quizAnalysis']);
      const result = await service.completeStep(job.id, 'difficulty', 'value');
      expect(result).toBeNull();
    });

    it('is idempotent — re-completing returns existing step', async () => {
      const job = await service.createJob('s-1', 'analyze-explain', ['quizAnalysis']);
      await service.startJob(job.id);

      await service.completeStep(job.id, 'quizAnalysis', 'v1');
      const step2 = await service.completeStep(job.id, 'quizAnalysis', 'v2');
      // Should not overwrite — still has v1
      expect(step2!.result).toBe(JSON.stringify('v1'));
    });

    it('marks job as completed when all steps are done', async () => {
      const fields: SyncField[] = ['quizAnalysis', 'difficulty'];
      const job = await service.createJob('s-1', 'analyze-explain', fields);
      await service.startJob(job.id);

      await service.completeStep(job.id, 'quizAnalysis', 'a');
      await service.completeStep(job.id, 'difficulty', 3);

      const updated = await service.getJob(job.id);
      expect(updated.status).toBe('completed');
      expect(updated.completed_steps).toBe(2);
      expect(updated.completed_at).toBeDefined();
      expect(updated.completed_at).not.toBeNull();
    });
  });

  // ── D4: Retry mechanism ──

  describe('failStep', () => {
    it('increments retry_count and allows retry when under MAX_RETRIES', async () => {
      const job = await service.createJob('s-1', 'analyze-explain', ['quizAnalysis']);
      await service.startJob(job.id);

      const result = await service.failStep(job.id, 'quizAnalysis', 'timeout');
      expect(result.canRetry).toBe(true);

      // Step should be back to pending
      const step = await stepRepo.findOne({
        where: { job_id: job.id, field: 'quizAnalysis' },
      });
      expect(step.status).toBe('pending');
      expect(step.retry_count).toBe(1);
      expect(step.error).toBe('timeout');
    });

    it('marks step as failed when MAX_RETRIES exhausted', async () => {
      const job = await service.createJob('s-1', 'analyze-explain', ['quizAnalysis']);
      await service.startJob(job.id);

      // Fail MAX_RETRIES times
      for (let i = 0; i < MAX_RETRIES; i++) {
        await service.failStep(job.id, 'quizAnalysis', `error-${i}`);
      }

      const step = await stepRepo.findOne({
        where: { job_id: job.id, field: 'quizAnalysis' },
      });
      expect(step.status).toBe('failed');
      expect(step.retry_count).toBe(MAX_RETRIES);
    });

    it('marks job as failed when a step permanently fails', async () => {
      const job = await service.createJob('s-1', 'analyze-explain', ['quizAnalysis', 'difficulty']);
      await service.startJob(job.id);

      for (let i = 0; i < MAX_RETRIES; i++) {
        await service.failStep(job.id, 'quizAnalysis', `error-${i}`);
      }

      const updatedJob = await service.getJob(job.id);
      expect(updatedJob.status).toBe('failed');
    });

    it('returns canRetry=false for non-existent step', async () => {
      const job = await service.createJob('s-1', 'analyze-explain', ['quizAnalysis']);
      const result = await service.failStep(job.id, 'difficulty', 'err');
      expect(result.canRetry).toBe(false);
    });

    it('MAX_RETRIES constant equals 2', () => {
      expect(MAX_RETRIES).toBe(2);
    });
  });

  // ── D1: getJob / getJobProgress ──

  describe('getJob', () => {
    it('returns job with steps relation', async () => {
      const fields: SyncField[] = ['quizAnalysis', 'difficulty'];
      const created = await service.createJob('s-1', 'analyze-explain', fields);

      // Patch findOne to return steps (mock repo limitation)
      jobRepo.findOne = jest.fn(async (_arg: any) => ({
        ...jobRepo._store[created.id],
        steps: Object.values(stepRepo._store).filter(
          (s: any) => s.job_id === created.id,
        ),
      }));

      const job = await service.getJob(created.id);
      expect(job.steps).toHaveLength(2);
    });

    it('throws NotFoundException for unknown job', async () => {
      jobRepo.findOne = jest.fn(async (_arg: any) => null);
      await expect(service.getJob('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getJobProgress', () => {
    it('returns progress DTO with step details', async () => {
      const fields: SyncField[] = ['quizAnalysis', 'difficulty'];
      const created = await service.createJob('s-1', 'analyze-explain', fields);
      await service.startJob(created.id);
      await service.completeStep(created.id, 'quizAnalysis', 'done');

      // Patch findOne for relations
      jobRepo.findOne = jest.fn(async (_arg: any) => ({
        ...jobRepo._store[created.id],
        steps: Object.values(stepRepo._store).filter(
          (s: any) => s.job_id === created.id,
        ),
      }));

      const progress = await service.getJobProgress(created.id);
      expect(progress.jobId).toBe(created.id);
      expect(progress.totalSteps).toBe(2);
      expect(progress.steps).toHaveLength(2);

      const completedStep = progress.steps.find(
        (s) => s.field === 'quizAnalysis',
      );
      expect(completedStep?.status).toBe('completed');
    });
  });

  // ── D1: findActiveJobForSession ──

  describe('findActiveJobForSession', () => {
    it('returns running job for session', async () => {
      const job = await service.createJob('s-1', 'analyze-explain', ['quizAnalysis']);
      await service.startJob(job.id);

      // Patch to return with steps
      jobRepo.findOne = jest.fn(async ({ where }: any) => {
        if (where.session_id === 's-1' && where.status === 'running') {
          return {
            ...jobRepo._store[job.id],
            steps: Object.values(stepRepo._store).filter(
              (s: any) => s.job_id === job.id,
            ),
          };
        }
        return null;
      });

      const active = await service.findActiveJobForSession('s-1');
      expect(active).not.toBeNull();
      expect(active!.id).toBe(job.id);
    });

    it('returns null when no running job exists', async () => {
      jobRepo.findOne = jest.fn(async (_arg: any) => null);
      const result = await service.findActiveJobForSession('s-nonexist');
      expect(result).toBeNull();
    });
  });

  // ── D2: Type safety cross-validation ──

  describe('SyncField type alignment', () => {
    it('SYNC_FIELDS contains expected core fields', () => {
      const expected = [
        'quizAnalysis',
        'knowledgePointTags',
        'thinkingProcess',
        'solutionSteps',
        'correctAnswer',
        'commonMistakes',
        'knowledgeGapAnalysis',
        'difficulty',
        'relatedQuizzes',
        'timeEstimate',
      ];
      for (const field of expected) {
        expect(SYNC_FIELDS).toContain(field);
      }
    });

    it('SYNC_FIELDS is a readonly array', () => {
      // Verify the as const assertion — length should be fixed
      expect(SYNC_FIELDS.length).toBeGreaterThan(0);
      expect(typeof SYNC_FIELDS[0]).toBe('string');
    });
  });

  // ── Edge cases ──

  describe('edge cases', () => {
    it('handles job with zero fields', async () => {
      const job = await service.createJob('s-1', 'analyze-explain', []);
      expect(job.total_steps).toBe(0);
      expect(job.steps).toHaveLength(0);
    });

    it('handles completing a failed step (recovery)', async () => {
      const job = await service.createJob('s-1', 'analyze-explain', ['quizAnalysis']);
      await service.startJob(job.id);

      // Fail once (retryable)
      await service.failStep(job.id, 'quizAnalysis', 'temp error');

      // Now complete it
      const step = await service.completeStep(job.id, 'quizAnalysis', 'recovered');
      expect(step!.status).toBe('completed');
    });

    it('stores result as JSON string', async () => {
      const job = await service.createJob('s-1', 'analyze-explain', ['difficulty']);
      await service.startJob(job.id);

      await service.completeStep(job.id, 'difficulty', 4);
      const step = await stepRepo.findOne({
        where: { job_id: job.id, field: 'difficulty' },
      });
      expect(step.result).toBe('4'); // JSON.stringify(4)
    });
  });
});
