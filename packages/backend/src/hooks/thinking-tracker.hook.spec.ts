/**
 * Thinking Tracker Hook Tests
 *
 * Tests for tenantId propagation in thinking block tracking.
 */

import { createThinkingTracker, ThinkingEvent, ThinkingTrackerDeps } from './thinking-tracker.hook';
import type { ThinkingBlocksService } from '../messages/thinking-blocks.service';
import type { ManagedSession } from '../common/interfaces';

describe('ThinkingTrackerHook', () => {
  let tracker: ReturnType<typeof createThinkingTracker>;
  let mockThinkingBlocksService: jest.Mocked<ThinkingBlocksService>;
  let mockGetSession: jest.Mock;
  let mockSession: ManagedSession;

  beforeEach(() => {
    mockThinkingBlocksService = {
      startThinking: jest.fn().mockResolvedValue({}),
      appendDelta: jest.fn().mockResolvedValue({}),
      endThinking: jest.fn().mockResolvedValue({}),
      cleanupSession: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockSession = {
      sessionId: 'session-123',
      clientId: 'client-123',
      cliProcess: null,
      stdin: null,
      socket: null,
      lastActivity: new Date(),
      status: 'processing',
      createdAt: new Date(),
      messageCount: 5,
      buffer: '',
      workspaceDir: '/tmp/session-123',
      currentAssistantMessageId: 'msg-123',
      tenantId: 'tenant-xyz',
    };

    mockGetSession = jest.fn().mockReturnValue(mockSession);

    const deps: ThinkingTrackerDeps = {
      thinkingBlocksService: mockThinkingBlocksService,
      getSession: mockGetSession,
    };

    tracker = createThinkingTracker(deps);
  });

  describe('onThinkingEvent - start', () => {
    it('should pass tenantId from session to startThinking', async () => {
      const event: ThinkingEvent = {
        type: 'start',
        thinkingId: 'think-123',
        content: 'Initial thinking...',
      };

      await tracker.onThinkingEvent(event, 'session-123');

      expect(mockThinkingBlocksService.startThinking).toHaveBeenCalledWith({
        messageId: 'msg-123',
        sessionId: 'session-123',
        tenantId: 'tenant-xyz',
        thinkingId: 'think-123',
        content: 'Initial thinking...',
      });
    });

    it('should pass null tenantId when session has no tenantId', async () => {
      mockSession.tenantId = undefined;

      const event: ThinkingEvent = {
        type: 'start',
        thinkingId: 'think-123',
      };

      await tracker.onThinkingEvent(event, 'session-123');

      expect(mockThinkingBlocksService.startThinking).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: null,
        }),
      );
    });

    it('should not call startThinking when session not found', async () => {
      mockGetSession.mockReturnValue(undefined);

      const event: ThinkingEvent = {
        type: 'start',
        thinkingId: 'think-123',
      };

      await tracker.onThinkingEvent(event, 'nonexistent-session');

      expect(mockThinkingBlocksService.startThinking).not.toHaveBeenCalled();
    });

    it('should not call startThinking when no assistant message context', async () => {
      mockSession.currentAssistantMessageId = undefined;

      const event: ThinkingEvent = {
        type: 'start',
        thinkingId: 'think-123',
      };

      await tracker.onThinkingEvent(event, 'session-123');

      expect(mockThinkingBlocksService.startThinking).not.toHaveBeenCalled();
    });
  });

  describe('onThinkingEvent - delta', () => {
    it('should call appendDelta with content', async () => {
      const event: ThinkingEvent = {
        type: 'delta',
        thinkingId: 'think-123',
        content: 'More thinking content...',
      };

      await tracker.onThinkingEvent(event, 'session-123');

      expect(mockThinkingBlocksService.appendDelta).toHaveBeenCalledWith(
        'think-123',
        'More thinking content...',
      );
    });

    it('should not call appendDelta when content is empty', async () => {
      const event: ThinkingEvent = {
        type: 'delta',
        thinkingId: 'think-123',
        content: '',
      };

      await tracker.onThinkingEvent(event, 'session-123');

      expect(mockThinkingBlocksService.appendDelta).not.toHaveBeenCalled();
    });

    it('should not call appendDelta when content is undefined', async () => {
      const event: ThinkingEvent = {
        type: 'delta',
        thinkingId: 'think-123',
      };

      await tracker.onThinkingEvent(event, 'session-123');

      expect(mockThinkingBlocksService.appendDelta).not.toHaveBeenCalled();
    });
  });

  describe('onThinkingEvent - end', () => {
    it('should call endThinking with thinkingTokens', async () => {
      const event: ThinkingEvent = {
        type: 'end',
        thinkingId: 'think-123',
        thinkingTokens: 500,
      };

      await tracker.onThinkingEvent(event, 'session-123');

      expect(mockThinkingBlocksService.endThinking).toHaveBeenCalledWith(
        'think-123',
        500,
      );
    });

    it('should call endThinking with undefined thinkingTokens', async () => {
      const event: ThinkingEvent = {
        type: 'end',
        thinkingId: 'think-123',
      };

      await tracker.onThinkingEvent(event, 'session-123');

      expect(mockThinkingBlocksService.endThinking).toHaveBeenCalledWith(
        'think-123',
        undefined,
      );
    });
  });

  describe('onSessionClose', () => {
    it('should call cleanupSession', async () => {
      await tracker.onSessionClose('session-123');

      expect(mockThinkingBlocksService.cleanupSession).toHaveBeenCalledWith('session-123');
    });

    it('should handle cleanupSession errors gracefully', async () => {
      mockThinkingBlocksService.cleanupSession = jest.fn().mockRejectedValue(new Error('Cleanup error'));

      // Should not throw
      await expect(tracker.onSessionClose('session-123')).resolves.not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle startThinking errors gracefully', async () => {
      mockThinkingBlocksService.startThinking = jest.fn().mockRejectedValue(new Error('Database error'));

      const event: ThinkingEvent = {
        type: 'start',
        thinkingId: 'think-123',
      };

      // Should not throw
      await expect(tracker.onThinkingEvent(event, 'session-123')).resolves.not.toThrow();
    });

    it('should handle appendDelta errors gracefully', async () => {
      mockThinkingBlocksService.appendDelta = jest.fn().mockRejectedValue(new Error('Database error'));

      const event: ThinkingEvent = {
        type: 'delta',
        thinkingId: 'think-123',
        content: 'Content',
      };

      // Should not throw
      await expect(tracker.onThinkingEvent(event, 'session-123')).resolves.not.toThrow();
    });

    it('should handle endThinking errors gracefully', async () => {
      mockThinkingBlocksService.endThinking = jest.fn().mockRejectedValue(new Error('Database error'));

      const event: ThinkingEvent = {
        type: 'end',
        thinkingId: 'think-123',
      };

      // Should not throw
      await expect(tracker.onThinkingEvent(event, 'session-123')).resolves.not.toThrow();
    });
  });

  describe('tenantId edge cases', () => {
    it('should handle empty string tenantId', async () => {
      mockSession.tenantId = '';

      const event: ThinkingEvent = {
        type: 'start',
        thinkingId: 'think-123',
      };

      await tracker.onThinkingEvent(event, 'session-123');

      // Empty string is falsy, should become null
      expect(mockThinkingBlocksService.startThinking).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: null,
        }),
      );
    });

    it('should preserve tenantId across multiple events', async () => {
      const startEvent: ThinkingEvent = { type: 'start', thinkingId: 'think-123' };
      const deltaEvent: ThinkingEvent = { type: 'delta', thinkingId: 'think-123', content: 'Content' };
      const endEvent: ThinkingEvent = { type: 'end', thinkingId: 'think-123' };

      await tracker.onThinkingEvent(startEvent, 'session-123');
      await tracker.onThinkingEvent(deltaEvent, 'session-123');
      await tracker.onThinkingEvent(endEvent, 'session-123');

      // Only startThinking receives tenantId, delta and end use thinkingId lookup
      expect(mockThinkingBlocksService.startThinking).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-xyz',
        }),
      );
    });
  });
});
