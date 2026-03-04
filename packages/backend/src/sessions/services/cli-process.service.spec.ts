/**
 * CliProcessService - handleCLIClose unit tests
 *
 * Fix 1 (CRITICAL): Verifies that when a session is cancelling,
 * handleCLIClose emits `agent_status: cancelled` to onEvent so that
 * orchestrateMessage's completionPromise can resolve.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CliProcessService } from './cli-process.service';
import { EventMapperService } from '../event-mapper.service';
import { WorkspaceService } from './workspace.service';
import type { ManagedSession } from '../../common/interfaces';

describe('CliProcessService - handleCLIClose', () => {
  let service: CliProcessService;

  const makeSession = (status: ManagedSession['status'] = 'processing'): ManagedSession =>
    ({
      sessionId: 'test-session-id',
      clientId: 'test-client-id',
      status,
      buffer: '',
      cliProcess: {} as any,
      stdin: {} as any,
    } as unknown as ManagedSession);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CliProcessService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
        },
        {
          provide: EventMapperService,
          useValue: { mapToSessionEvents: jest.fn().mockReturnValue([]) },
        },
        { provide: WorkspaceService, useValue: {} },
      ],
    }).compile();

    service = module.get<CliProcessService>(CliProcessService);
  });

  // ─── Fix 1: cancellation branch ──────────────────────────────────────────

  describe('cancellation branch (Fix 1)', () => {
    it('emits agent_status: cancelled when session.status is cancelling', () => {
      const session = makeSession('cancelling');
      const onEvent = jest.fn();

      (service as any).handleCLIClose(session, 0, onEvent);

      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'agent_status',
          status: 'cancelled',
          sessionId: 'test-session-id',
        }),
      );
    });

    it('sets session.status to idle after cancellation', () => {
      const session = makeSession('cancelling');
      const onEvent = jest.fn();

      (service as any).handleCLIClose(session, 0, onEvent);

      expect(session.status).toBe('idle');
    });

    it('does NOT emit complete or error events when cancelling', () => {
      const session = makeSession('cancelling');
      const onEvent = jest.fn();

      (service as any).handleCLIClose(session, 1, onEvent);

      const emittedStatuses = onEvent.mock.calls.map(([e]: [any]) => e.status);
      expect(emittedStatuses).not.toContain('complete');
      expect(emittedStatuses).not.toContain('error');
    });
  });

  // ─── Normal completion (regression protection) ────────────────────────────

  describe('normal completion branch', () => {
    it('emits agent_status: complete on exit code 0', () => {
      const session = makeSession('processing');
      const onEvent = jest.fn();

      (service as any).handleCLIClose(session, 0, onEvent);

      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'agent_status',
          status: 'complete',
          exitCode: 0,
        }),
      );
    });

    it('emits agent_status: error on non-zero exit code', () => {
      const session = makeSession('processing');
      const onEvent = jest.fn();

      (service as any).handleCLIClose(session, 1, onEvent);

      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'agent_status',
          status: 'error',
          exitCode: 1,
        }),
      );
    });

    it('sets session.status to idle on exit code 0', () => {
      const session = makeSession('processing');
      const onEvent = jest.fn();

      (service as any).handleCLIClose(session, 0, onEvent);

      expect(session.status).toBe('idle');
    });

    it('sets session.status to error on non-zero exit code', () => {
      const session = makeSession('processing');
      const onEvent = jest.fn();

      (service as any).handleCLIClose(session, 1, onEvent);

      expect(session.status).toBe('error');
    });
  });

  // ─── State cleanup (both branches) ───────────────────────────────────────

  describe('state cleanup', () => {
    it('clears cliProcess, stdin, and buffer after cancellation', () => {
      const session = makeSession('cancelling');
      const onEvent = jest.fn();

      (service as any).handleCLIClose(session, 0, onEvent);

      expect(session.cliProcess).toBeNull();
      expect(session.stdin).toBeNull();
      expect(session.buffer).toBe('');
    });

    it('clears cliProcess, stdin, and buffer after normal completion', () => {
      const session = makeSession('processing');
      const onEvent = jest.fn();

      (service as any).handleCLIClose(session, 0, onEvent);

      expect(session.cliProcess).toBeNull();
      expect(session.stdin).toBeNull();
      expect(session.buffer).toBe('');
    });
  });
});
