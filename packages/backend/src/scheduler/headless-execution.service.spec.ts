import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HeadlessExecutionService } from './headless-execution.service';
import { EventMapperService } from '../sessions/event-mapper.service';
import { SkillSyncService } from '../skills/skill-sync.service';
import type { ScheduledTask } from './entities/scheduled-task.entity';
import type { ScheduledTaskExecution } from './entities/scheduled-task-execution.entity';
import * as child_process from 'node:child_process';
import * as fs from 'node:fs';
import { EventEmitter } from 'node:events';
import { Readable, Writable } from 'node:stream';

jest.mock('node:child_process');
jest.mock('node:fs');

describe('HeadlessExecutionService', () => {
  let service: HeadlessExecutionService;
  let eventMapperService: any;
  let skillSyncService: any;

  const mockTask: Partial<ScheduledTask> = {
    id: 'task-1',
    tenantId: 'tenant-1',
    name: 'Test Task',
    message: 'Hello Claude',
    scheduleType: 'cron',
    scheduleValue: '0 4 * * *',
    status: 'active',
    maxConcurrent: 1,
    maxRetries: 0,
    retryDelayMs: 60000,
    timeoutMs: 600000,
    enabledSkillSlugs: [],
  };

  const mockExecution: Partial<ScheduledTaskExecution> = {
    id: 'exec-1',
    taskId: 'task-1',
    tenantId: 'tenant-1',
    sessionId: 'scheduled_task-1_abc12345',
    status: 'running',
    startedAt: new Date(),
    attemptNumber: 1,
  };

  beforeEach(async () => {
    eventMapperService = {
      mapToFrontendEvents: jest.fn().mockReturnValue([]),
    };

    skillSyncService = {
      syncToSession: jest.fn().mockResolvedValue({ skillCount: 0 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HeadlessExecutionService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, defaultVal: any) => defaultVal),
          },
        },
        { provide: EventMapperService, useValue: eventMapperService },
        { provide: SkillSyncService, useValue: skillSyncService },
      ],
    }).compile();

    service = module.get<HeadlessExecutionService>(HeadlessExecutionService);

    // Mock fs
    (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
    (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);
    (fs.rmSync as jest.Mock).mockReturnValue(undefined);
  });

  describe('execute', () => {
    it('should spawn CLI process and collect results', async () => {
      // Create mock process
      const mockProcess = new EventEmitter() as any;
      mockProcess.pid = 12345;
      mockProcess.killed = false;
      mockProcess.kill = jest.fn();

      const mockStdin = new Writable({
        write: jest.fn((chunk: any, enc: any, cb: any) => { cb(); }),
      });
      const mockStdout = new Readable({ read() {} });
      const mockStderr = new Readable({ read() {} });

      mockProcess.stdin = mockStdin;
      mockProcess.stdout = mockStdout;
      mockProcess.stderr = mockStderr;

      (child_process.spawn as jest.Mock).mockReturnValue(mockProcess);

      // Map events to return a text_delta
      eventMapperService.mapToFrontendEvents.mockImplementation((cliEvent: any) => {
        if (cliEvent.type === 'assistant') {
          return [{
            type: 'text_delta',
            delta: 'Hello from Claude',
            sessionId: mockExecution.sessionId,
          }];
        }
        if (cliEvent.type === 'result') {
          return [{
            type: 'agent_status',
            status: 'complete',
            sessionId: mockExecution.sessionId,
          }];
        }
        return [];
      });

      // Start execution
      const resultPromise = service.execute(
        mockTask as ScheduledTask,
        mockExecution as ScheduledTaskExecution,
      );

      // Simulate spawn event
      await new Promise(resolve => setTimeout(resolve, 10));
      mockProcess.emit('spawn');

      // Simulate CLI output
      await new Promise(resolve => setTimeout(resolve, 10));
      const assistantEvent = JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'Hello from Claude' }] },
      });
      mockStdout.push(assistantEvent + '\n');

      const resultEvent = JSON.stringify({
        type: 'result',
        subtype: 'success',
        result: 'Done',
      });
      mockStdout.push(resultEvent + '\n');

      // Simulate process close
      await new Promise(resolve => setTimeout(resolve, 10));
      mockProcess.emit('close', 0);

      const result = await resultPromise;

      expect(result.resultText).toBe('Hello from Claude');
      expect(result.exitCode).toBe(0);
      expect(child_process.spawn).toHaveBeenCalledWith(
        '/bin/sh',
        expect.any(Array),
        expect.objectContaining({ stdio: ['pipe', 'pipe', 'pipe'] }),
      );
    });

    it('should setup workspace with permissions', async () => {
      // Create mock process that closes immediately
      const mockProcess = new EventEmitter() as any;
      mockProcess.pid = 12345;
      mockProcess.killed = false;
      mockProcess.kill = jest.fn();
      mockProcess.stdin = new Writable({ write: jest.fn((c: any, e: any, cb: any) => cb()) });
      mockProcess.stdout = new Readable({ read() {} });
      mockProcess.stderr = new Readable({ read() {} });

      (child_process.spawn as jest.Mock).mockReturnValue(mockProcess);

      const execPromise = service.execute(
        mockTask as ScheduledTask,
        mockExecution as ScheduledTaskExecution,
      );

      await new Promise(resolve => setTimeout(resolve, 10));
      mockProcess.emit('spawn');
      await new Promise(resolve => setTimeout(resolve, 10));
      mockProcess.emit('close', 0);

      await execPromise;

      // Verify workspace setup
      expect(fs.mkdirSync).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('settings.local.json'),
        expect.stringContaining('Bash(*)'),
      );
    });

    it('should handle process errors', async () => {
      const mockProcess = new EventEmitter() as any;
      mockProcess.pid = 12345;
      mockProcess.killed = false;
      mockProcess.kill = jest.fn();
      mockProcess.stdin = new Writable({ write: jest.fn((c: any, e: any, cb: any) => cb()) });
      mockProcess.stdout = new Readable({ read() {} });
      mockProcess.stderr = new Readable({ read() {} });

      (child_process.spawn as jest.Mock).mockReturnValue(mockProcess);

      const execPromise = service.execute(
        mockTask as ScheduledTask,
        mockExecution as ScheduledTaskExecution,
      );

      await new Promise(resolve => setTimeout(resolve, 10));
      mockProcess.emit('error', new Error('spawn failed'));

      const result = await execPromise;

      expect(result.exitCode).toBe(-1);
    });
  });
});
