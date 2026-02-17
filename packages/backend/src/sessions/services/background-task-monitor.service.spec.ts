/**
 * BackgroundTaskMonitorService Tests
 *
 * Covers: push channel SSE emission on background task completion.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BackgroundTaskMonitorService } from './background-task-monitor.service';
import { EventMapperService } from '../event-mapper.service';
import { StreamRegistryService } from './stream-registry.service';

describe('BackgroundTaskMonitorService', () => {
  let service: BackgroundTaskMonitorService;
  let eventMapperService: jest.Mocked<Pick<EventMapperService, 'markBackgroundTaskComplete'>>;
  let streamRegistry: jest.Mocked<Pick<StreamRegistryService, 'emit'>>;

  const sessionId = 'session-abc';
  const subAgentId = 'toolu_01ABC';

  const mockTracker = {
    subAgentId,
    outputFile: '/tmp/output.txt',
    startedAt: new Date(Date.now() - 5000),
  };

  beforeEach(async () => {
    eventMapperService = {
      markBackgroundTaskComplete: jest.fn().mockReturnValue(mockTracker),
    };

    streamRegistry = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackgroundTaskMonitorService,
        { provide: EventMapperService, useValue: eventMapperService },
        { provide: StreamRegistryService, useValue: streamRegistry },
      ],
    }).compile();

    service = module.get<BackgroundTaskMonitorService>(BackgroundTaskMonitorService);
  });

  afterEach(() => {
    service.stopAllMonitors();
    jest.clearAllMocks();
  });

  describe('stopMonitorByKey (and internal stopBackgroundTaskMonitor)', () => {
    it('should emit subagent_completed to the SSE push channel', () => {
      // Trigger internal completion path via public method
      // We expose stopAllMonitorsForSession which calls clearInterval but NOT stopBackgroundTaskMonitor.
      // Use the private method indirectly by calling the polling callback directly via
      // a spy on checkBackgroundTaskStatus — instead, call the internal via startBackgroundTaskMonitor
      // with a mock getSession and then trigger the monitor key cleanup.

      // Directly test the emitted event by calling the private method via a type cast
      const serviceAny = service as any;

      const mockSession = { clientId: 'sse:session-abc', socket: null };
      const getSession = jest.fn().mockReturnValue(mockSession);

      // Simulate what happens when the background monitor detects task completion:
      // stopBackgroundTaskMonitor is called with status='completed'
      serviceAny.stopBackgroundTaskMonitor(
        `${sessionId}:${subAgentId}`,
        sessionId,
        subAgentId,
        'completed',
        getSession,
      );

      // Should emit to the SSE push channel regardless of socket being null
      expect(streamRegistry.emit).toHaveBeenCalledWith(
        `${sessionId}:push`,
        expect.objectContaining({
          type: 'subagent_completed',
          sessionId,
          payload: expect.objectContaining({
            subAgentId,
            status: 'completed',
          }),
        }),
      );
    });

    it('should emit to push channel even when session has a socket', () => {
      const serviceAny = service as any;

      const mockSocketSession = {
        clientId: 'client-1',
        socket: { emit: jest.fn() },
      };
      const getSession = jest.fn().mockReturnValue(mockSocketSession);

      serviceAny.stopBackgroundTaskMonitor(
        `${sessionId}:${subAgentId}`,
        sessionId,
        subAgentId,
        'completed',
        getSession,
      );

      // Socket.IO emission still happens
      expect(mockSocketSession.socket.emit).toHaveBeenCalledWith(
        'subagent_completed',
        expect.objectContaining({ type: 'subagent_completed' }),
      );

      // SSE push channel also receives the event
      expect(streamRegistry.emit).toHaveBeenCalledWith(
        `${sessionId}:push`,
        expect.objectContaining({ type: 'subagent_completed' }),
      );
    });

    it('should NOT emit to push channel when tracker is not found', () => {
      const serviceAny = service as any;
      eventMapperService.markBackgroundTaskComplete.mockReturnValue(undefined);

      const getSession = jest.fn().mockReturnValue(null);

      serviceAny.stopBackgroundTaskMonitor(
        `${sessionId}:${subAgentId}`,
        sessionId,
        subAgentId,
        'completed',
        getSession,
      );

      expect(streamRegistry.emit).not.toHaveBeenCalled();
    });

    it('should emit with status=failed on timeout', () => {
      const serviceAny = service as any;
      const getSession = jest.fn().mockReturnValue({ clientId: 'sse:session-abc', socket: null });

      serviceAny.stopBackgroundTaskMonitor(
        `${sessionId}:${subAgentId}`,
        sessionId,
        subAgentId,
        'timeout',
        getSession,
      );

      expect(streamRegistry.emit).toHaveBeenCalledWith(
        `${sessionId}:push`,
        expect.objectContaining({
          payload: expect.objectContaining({
            status: 'failed', // timeout maps to failed
            error: 'Task timeout after 30 minutes',
          }),
        }),
      );
    });
  });
});
