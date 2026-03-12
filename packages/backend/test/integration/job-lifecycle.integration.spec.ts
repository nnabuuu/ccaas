/**
 * Job Lifecycle Integration Tests
 *
 * Tests the full background job lifecycle: creation → queue pickup →
 * headless execution → completion → Socket.io notification.
 * Uses real in-memory SQLite DB but mocks QueueService and HeadlessExecutionService.
 */

// Mock liteque ESM module before any imports
jest.mock('liteque', () => ({
  buildDBClient: jest.fn(),
  SqliteQueue: jest.fn(),
  Runner: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import { JobService } from '../../src/jobs/job.service';
import { JobEntity } from '../../src/jobs/entities/job.entity';
import { QueueService } from '../../src/jobs/queue.service';
import { HeadlessExecutionService } from '../../src/scheduler/headless-execution.service';

import {
  getTestDatabaseOptions,
  seedTestData,
  TEST_ENTITIES,
} from '../setup/test-database';

describe('Job Lifecycle Integration Tests', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jobService: JobService;
  let jobRepo: Repository<JobEntity>;
  let testTenantId: string;

  let capturedHandlers: { run: any; onComplete: any; onError: any };
  let mockQueueService: any;
  let mockHeadlessExecution: any;
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccaas-job-test-'));

    capturedHandlers = { run: null, onComplete: null, onError: null };

    mockQueueService = {
      registerHandlers: jest.fn((run, onComplete, onError) => {
        capturedHandlers.run = run;
        capturedHandlers.onComplete = onComplete;
        capturedHandlers.onError = onError;
      }),
      enqueue: jest.fn().mockResolvedValue({ id: 1 }),
      stats: jest.fn().mockResolvedValue({ pending: 0, running: 0 }),
      onModuleInit: jest.fn(),
      onModuleDestroy: jest.fn(),
    };

    mockHeadlessExecution = {
      executeJob: jest.fn().mockResolvedValue({
        resultText: 'Podcast generated successfully',
        tokenUsage: { input: 5000, output: 2000, cached: 500 },
        exitCode: 0,
        workspacePath: '',
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              workspace: { dir: tmpDir },
            }),
          ],
        }),
        TypeOrmModule.forRoot(getTestDatabaseOptions()),
        TypeOrmModule.forFeature(TEST_ENTITIES),
      ],
      providers: [
        JobService,
        { provide: QueueService, useValue: mockQueueService },
        { provide: HeadlessExecutionService, useValue: mockHeadlessExecution },
        {
          provide: 'ConfigService',
          useFactory: (cs: ConfigService) => cs,
          inject: [ConfigService],
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    jobService = moduleFixture.get(JobService);
    jobRepo = dataSource.getRepository(JobEntity);

    // Seed test tenant
    const { tenant } = await seedTestData(dataSource);
    testTenantId = tenant.id;
  });

  afterAll(async () => {
    await app?.close();
    // Clean up tmp directory
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await jobRepo.clear();
    jest.clearAllMocks();
    // Re-capture handlers after clear (they persist from onModuleInit)
  });

  // Helper to create a standard job
  async function createTestJob(overrides?: Partial<Parameters<typeof jobService.create>[0]>) {
    return jobService.create({
      tenantId: testTenantId,
      type: 'notebooklm_podcast',
      name: 'Generate AI Podcast',
      prompt: 'Create a podcast episode about AI safety research',
      sessionId: 'test-session-1',
      messageId: 'test-msg-1',
      mcpServers: { notebooklm: { url: 'http://localhost:3002' } },
      enabledSkills: ['notebooklm'],
      ...overrides,
    });
  }

  describe('Scenario: NotebookLM Podcast Generation', () => {
    it('creates job with pending status and enqueues', async () => {
      const job = await createTestJob();

      // Verify DB persistence
      const fromDb = await jobRepo.findOneBy({ id: job.id });
      expect(fromDb).toBeDefined();
      expect(fromDb!.status).toBe('pending');
      expect(fromDb!.attempts).toBe(0);
      expect(fromDb!.type).toBe('notebooklm_podcast');
      expect(fromDb!.tenantId).toBe(testTenantId);

      // Verify enqueue was called
      expect(mockQueueService.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          jobEntityId: job.id,
          type: 'notebooklm_podcast',
          prompt: 'Create a podcast episode about AI safety research',
          tenantId: testTenantId,
          mcpServers: { notebooklm: { url: 'http://localhost:3002' } },
          enabledSkills: ['notebooklm'],
        }),
        { numRetries: 2 },
      );
    });

    it('run handler transitions to running and calls executeJob', async () => {
      const job = await createTestJob();

      // Simulate queue picking up the job
      await capturedHandlers.run({
        data: {
          jobEntityId: job.id,
          tenantId: testTenantId,
          prompt: job.prompt,
          mcpServers: job.mcpServers,
          enabledSkills: job.enabledSkills,
        },
      });

      // Reload from DB
      const fromDb = await jobRepo.findOneBy({ id: job.id });
      expect(fromDb!.status).toBe('running');
      expect(fromDb!.attempts).toBe(1);
      expect(fromDb!.bgSessionId).toBeDefined();
      expect(fromDb!.startedAt).toBeDefined();

      // Verify executeJob was called
      expect(mockHeadlessExecution.executeJob).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: testTenantId,
          prompt: 'Create a podcast episode about AI safety research',
        }),
        expect.objectContaining({
          preserveWorkspace: true,
          timeoutMs: 600000,
        }),
      );
    });

    it('onComplete transitions to completed with workspace files', async () => {
      const job = await createTestJob();

      // Run handler first
      mockHeadlessExecution.executeJob.mockResolvedValue({
        resultText: 'Podcast generated',
        tokenUsage: { input: 5000, output: 2000, cached: 500 },
        exitCode: 0,
        workspacePath: '',
      });

      const runResult = await capturedHandlers.run({
        data: { jobEntityId: job.id, tenantId: testTenantId, prompt: job.prompt },
      });

      // Set up workspace with real files
      const fromDb = await jobRepo.findOneBy({ id: job.id });
      const workspacePath = path.join(tmpDir, 'jobs', fromDb!.bgSessionId!);
      fs.mkdirSync(workspacePath, { recursive: true });
      fs.writeFileSync(path.join(workspacePath, 'podcast.mp3'), Buffer.alloc(1024));
      fs.writeFileSync(path.join(workspacePath, 'summary.txt'), 'Episode summary');

      // Call onComplete with workspace
      await capturedHandlers.onComplete(
        { data: { jobEntityId: job.id } },
        {
          resultText: 'Podcast generated',
          tokenUsage: { input: 5000, output: 2000, cached: 500 },
          exitCode: 0,
          bgSessionId: fromDb!.bgSessionId,
          workspacePath,
        },
      );

      // Reload and verify
      const completed = await jobRepo.findOneBy({ id: job.id });
      expect(completed!.status).toBe('completed');
      expect(completed!.resultText).toBe('Podcast generated');
      expect(completed!.completedAt).toBeDefined();
      expect(completed!.tokenUsage).toEqual({ input: 5000, output: 2000, cached: 500 });
      expect(completed!.resultFiles).toBeDefined();
      expect(completed!.resultFiles!.length).toBe(2);

      const mp3File = completed!.resultFiles!.find((f) => f.name === 'podcast.mp3');
      expect(mp3File).toBeDefined();
      expect(mp3File!.mimeType).toBe('audio/mpeg');
      expect(mp3File!.size).toBe(1024);
    });

    it('full lifecycle: create → run → complete → query', async () => {
      const job = await createTestJob();

      // Step 1: Verify pending
      let fromDb = await jobRepo.findOneBy({ id: job.id });
      expect(fromDb!.status).toBe('pending');

      // Step 2: Run
      const workspacePath = path.join(tmpDir, 'jobs', 'full-lifecycle-session');
      fs.mkdirSync(workspacePath, { recursive: true });
      fs.writeFileSync(path.join(workspacePath, 'result.txt'), 'Done');

      mockHeadlessExecution.executeJob.mockResolvedValue({
        resultText: 'Full lifecycle complete',
        tokenUsage: { input: 3000, output: 1000, cached: 100 },
        exitCode: 0,
        workspacePath,
      });

      await capturedHandlers.run({
        data: { jobEntityId: job.id, tenantId: testTenantId, prompt: job.prompt },
      });

      fromDb = await jobRepo.findOneBy({ id: job.id });
      expect(fromDb!.status).toBe('running');

      // Step 3: Complete
      await capturedHandlers.onComplete(
        { data: { jobEntityId: job.id } },
        {
          resultText: 'Full lifecycle complete',
          tokenUsage: { input: 3000, output: 1000, cached: 100 },
          exitCode: 0,
          bgSessionId: fromDb!.bgSessionId,
          workspacePath,
        },
      );

      // Step 4: Query
      const result = await jobService.findById(job.id);
      expect(result.status).toBe('completed');
      expect(result.resultText).toBe('Full lifecycle complete');
      expect(result.tokenUsage).toEqual({ input: 3000, output: 1000, cached: 100 });
      expect(result.resultFiles!.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Error and Resume Flow', () => {
    it('onError with retries left keeps status=pending', async () => {
      const job = await createTestJob();

      await capturedHandlers.onError({
        data: { jobEntityId: job.id },
        numRetriesLeft: 2,
        error: { message: 'Temporary failure' },
      });

      const fromDb = await jobRepo.findOneBy({ id: job.id });
      expect(fromDb!.status).toBe('pending');
      expect(fromDb!.errorMessage).toBe('Temporary failure');
      expect(fromDb!.completedAt).toBeNull();
    });

    it('onError without retries sets status=failed with error message', async () => {
      const job = await createTestJob();

      await capturedHandlers.onError({
        data: { jobEntityId: job.id },
        numRetriesLeft: 0,
        error: { message: 'CLI crashed after timeout' },
      });

      const fromDb = await jobRepo.findOneBy({ id: job.id });
      expect(fromDb!.status).toBe('failed');
      expect(fromDb!.errorMessage).toBe('CLI crashed after timeout');
      expect(fromDb!.completedAt).toBeDefined();
    });

    it('resume re-enqueues with resumeSessionId from bgSessionId', async () => {
      const job = await createTestJob();

      // First run, then fail
      await capturedHandlers.run({
        data: { jobEntityId: job.id, tenantId: testTenantId, prompt: job.prompt },
      });
      const afterRun = await jobRepo.findOneBy({ id: job.id });
      const bgSessionId = afterRun!.bgSessionId;

      await capturedHandlers.onError({
        data: { jobEntityId: job.id },
        numRetriesLeft: 0,
        error: { message: 'Failed' },
      });

      // Resume
      mockQueueService.enqueue.mockClear();
      const resumed = await jobService.resume(job.id);

      expect(resumed.status).toBe('pending');
      expect(mockQueueService.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          resumeSessionId: bgSessionId,
        }),
        expect.any(Object),
      );
    });

    it('resume clears errorMessage and completedAt', async () => {
      const job = await createTestJob();

      // Fail the job
      await capturedHandlers.onError({
        data: { jobEntityId: job.id },
        numRetriesLeft: 0,
        error: { message: 'Some error' },
      });

      // Manually set bgSessionId for resume (normally set by run handler)
      await jobRepo.update(job.id, { bgSessionId: 'bg-session-for-resume' });

      const resumed = await jobService.resume(job.id);

      expect(resumed.errorMessage).toBeFalsy();
      expect(resumed.completedAt).toBeFalsy();
    });
  });

  describe('Cancel Flow', () => {
    it('cancels pending job', async () => {
      const job = await createTestJob();

      const cancelled = await jobService.cancel(job.id);

      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.completedAt).toBeDefined();
    });

    it('cancels running job', async () => {
      const job = await createTestJob();

      // Transition to running
      await capturedHandlers.run({
        data: { jobEntityId: job.id, tenantId: testTenantId, prompt: job.prompt },
      });

      const cancelled = await jobService.cancel(job.id);
      expect(cancelled.status).toBe('cancelled');
    });

    it('rejects cancelling completed job', async () => {
      const job = await createTestJob();

      // Complete the job directly in DB
      await jobRepo.update(job.id, { status: 'completed', completedAt: new Date() });

      await expect(jobService.cancel(job.id)).rejects.toThrow('Cannot cancel job with status: completed');
    });
  });

  describe('Pagination and Filtering', () => {
    beforeEach(async () => {
      // Create multiple jobs
      for (let i = 0; i < 5; i++) {
        await createTestJob({
          name: `Job ${i}`,
          sessionId: i < 3 ? 'session-A' : 'session-B',
        });
      }
      // Fail one job
      const jobs = await jobRepo.find();
      await jobRepo.update(jobs[0].id, { status: 'failed' });
    });

    it('filters by tenantId', async () => {
      const result = await jobService.findAll({ tenantId: testTenantId });
      expect(result.total).toBe(5);

      const empty = await jobService.findAll({ tenantId: 'nonexistent-tenant' });
      expect(empty.total).toBe(0);
    });

    it('filters by sessionId', async () => {
      const result = await jobService.findAll({ sessionId: 'session-A' });
      expect(result.total).toBe(3);
    });

    it('filters by status', async () => {
      const failed = await jobService.findAll({ status: 'failed' });
      expect(failed.total).toBe(1);

      const pending = await jobService.findAll({ status: 'pending' });
      expect(pending.total).toBe(4);
    });

    it('paginates correctly: page 1 of 3', async () => {
      const page1 = await jobService.findAll({ tenantId: testTenantId, page: 1, limit: 2 });
      expect(page1.data.length).toBe(2);
      expect(page1.total).toBe(5);
      expect(page1.totalPages).toBe(3);
      expect(page1.page).toBe(1);

      const page3 = await jobService.findAll({ tenantId: testTenantId, page: 3, limit: 2 });
      expect(page3.data.length).toBe(1);
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('jobs from tenant-A not visible to tenant-B filter', async () => {
      await createTestJob({ name: 'Tenant A Job' });

      // Create a job with different tenantId (bypass service to set arbitrary tenantId)
      const otherJob = jobRepo.create({
        tenantId: 'other-tenant-id',
        type: 'test',
        name: 'Tenant B Job',
        prompt: 'test',
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        timeoutMs: 600000,
      });
      await jobRepo.save(otherJob);

      const tenantAJobs = await jobService.findAll({ tenantId: testTenantId });
      const tenantBJobs = await jobService.findAll({ tenantId: 'other-tenant-id' });

      expect(tenantAJobs.total).toBe(1);
      expect(tenantBJobs.total).toBe(1);
      expect(tenantAJobs.data[0].name).toBe('Tenant A Job');
      expect(tenantBJobs.data[0].name).toBe('Tenant B Job');
    });
  });

  describe('Socket.io Notification', () => {
    it('emits job_update on each status transition', async () => {
      const mockEmit = jest.fn();
      const mockTo = jest.fn().mockReturnValue({ emit: mockEmit });
      (jobService as any).ioServer = { to: mockTo };

      // Create (pending)
      const job = await createTestJob();

      // Run (running)
      await capturedHandlers.run({
        data: { jobEntityId: job.id, tenantId: testTenantId, prompt: job.prompt },
      });

      // Complete
      await capturedHandlers.onComplete(
        { data: { jobEntityId: job.id } },
        {
          resultText: 'Done',
          tokenUsage: { input: 100, output: 50, cached: 10 },
          exitCode: 0,
          bgSessionId: 'bg-1',
          workspacePath: '',
        },
      );

      // Verify emissions for all 3 transitions
      // Each transition emits to tenant room; pending + running + completed = 3 transitions
      // The create method emits once, run handler emits once, onComplete emits once
      const jobUpdateCalls = mockEmit.mock.calls.filter(
        (call) => call[0] === 'job_update',
      );

      // At least 3 job_update events (pending from create, running from run, completed from onComplete)
      expect(jobUpdateCalls.length).toBeGreaterThanOrEqual(3);

      // Check statuses were emitted
      const emittedStatuses = jobUpdateCalls.map((call) => call[1].status);
      expect(emittedStatuses).toContain('pending');
      expect(emittedStatuses).toContain('running');
      expect(emittedStatuses).toContain('completed');

      // Each event has correct shape
      for (const call of jobUpdateCalls) {
        expect(call[1]).toHaveProperty('type', 'job_update');
        expect(call[1]).toHaveProperty('jobId', job.id);
        expect(call[1]).toHaveProperty('status');
      }
    });
  });

  describe('File Path Security', () => {
    it('blocks path traversal via ../../../etc/passwd', async () => {
      const job = await createTestJob();

      // Set bgSessionId manually
      await jobRepo.update(job.id, { bgSessionId: 'secure-session' });
      const entity = await jobRepo.findOneBy({ id: job.id });

      const result = jobService.getFilePath(entity!, '../../../etc/passwd');
      expect(result).toBeNull();
    });

    it('returns null for nonexistent file', async () => {
      const job = await createTestJob();

      await jobRepo.update(job.id, { bgSessionId: 'secure-session-2' });
      const entity = await jobRepo.findOneBy({ id: job.id });

      // Create the workspace dir but not the file
      const workspacePath = path.join(tmpDir, 'jobs', 'secure-session-2');
      fs.mkdirSync(workspacePath, { recursive: true });

      const result = jobService.getFilePath(entity!, 'nonexistent.txt');
      expect(result).toBeNull();
    });
  });
});
