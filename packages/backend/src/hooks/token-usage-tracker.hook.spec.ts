/**
 * Token Usage Tracker Hook Tests
 *
 * Tests for tenantId propagation in token usage tracking.
 */

import { createTokenUsageTracker, TokenUsageEvent, TokenUsageTrackerDeps } from './token-usage-tracker.hook';
import type { TokenUsageService } from '../messages/token-usage.service';
import type { ManagedSession } from '../common/interfaces';

describe('TokenUsageTrackerHook', () => {
  let tracker: ReturnType<typeof createTokenUsageTracker>;
  let mockTokenUsageService: jest.Mocked<TokenUsageService>;
  let mockGetSession: jest.Mock;
  let mockSession: ManagedSession;

  beforeEach(() => {
    mockTokenUsageService = {
      recordUsage: jest.fn().mockResolvedValue({}),
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
      tenantId: 'tenant-abc',
    };

    mockGetSession = jest.fn().mockReturnValue(mockSession);

    const deps: TokenUsageTrackerDeps = {
      tokenUsageService: mockTokenUsageService,
      getSession: mockGetSession,
    };

    tracker = createTokenUsageTracker(deps);
  });

  describe('onTokenUsage', () => {
    const baseUsageEvent: TokenUsageEvent = {
      inputTokens: 1000,
      outputTokens: 500,
      cachedInputTokens: 100,
      cacheReadTokens: 50,
      cacheCreationTokens: 25,
      reasoningTokens: 200,
      model: 'claude-3-sonnet',
      stopReason: 'end_turn',
      apiMessageId: 'api-msg-123',
    };

    it('should pass tenantId from session to recordUsage', async () => {
      await tracker.onTokenUsage(baseUsageEvent, 'session-123');

      expect(mockTokenUsageService.recordUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-abc',
        }),
      );
    });

    it('should pass null tenantId when session has no tenantId', async () => {
      mockSession.tenantId = undefined;

      await tracker.onTokenUsage(baseUsageEvent, 'session-123');

      expect(mockTokenUsageService.recordUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: null,
        }),
      );
    });

    it('should include all token usage fields in recordUsage call', async () => {
      await tracker.onTokenUsage(baseUsageEvent, 'session-123');

      expect(mockTokenUsageService.recordUsage).toHaveBeenCalledWith({
        messageId: 'msg-123',
        sessionId: 'session-123',
        tenantId: 'tenant-abc',
        model: 'claude-3-sonnet',
        inputTokens: 1000,
        outputTokens: 500,
        cachedInputTokens: 100,
        cacheReadTokens: 50,
        cacheCreationTokens: 25,
        reasoningTokens: 200,
        contextWindowUsage: null,
        stopReason: 'end_turn',
        apiMessageId: 'api-msg-123',
      });
    });

    it('should not call recordUsage when session not found', async () => {
      mockGetSession.mockReturnValue(undefined);

      await tracker.onTokenUsage(baseUsageEvent, 'nonexistent-session');

      expect(mockTokenUsageService.recordUsage).not.toHaveBeenCalled();
    });

    it('should not call recordUsage when no assistant message context', async () => {
      mockSession.currentAssistantMessageId = undefined;

      await tracker.onTokenUsage(baseUsageEvent, 'session-123');

      expect(mockTokenUsageService.recordUsage).not.toHaveBeenCalled();
    });

    it('should handle recordUsage errors gracefully', async () => {
      mockTokenUsageService.recordUsage = jest.fn().mockRejectedValue(new Error('Database error'));

      // Should not throw
      await expect(tracker.onTokenUsage(baseUsageEvent, 'session-123')).resolves.not.toThrow();
    });

    it('should pass context window usage when provided', async () => {
      const usageWithContext: TokenUsageEvent = {
        ...baseUsageEvent,
        contextWindowUsage: {
          used: 5000,
          limit: 100000,
          percentFull: 5,
        },
      };

      await tracker.onTokenUsage(usageWithContext, 'session-123');

      expect(mockTokenUsageService.recordUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          contextWindowUsage: {
            used: 5000,
            limit: 100000,
            percentFull: 5,
          },
        }),
      );
    });
  });

  describe('tenantId edge cases', () => {
    it('should handle empty string tenantId', async () => {
      mockSession.tenantId = '';

      await tracker.onTokenUsage(
        { inputTokens: 100, outputTokens: 50, model: 'claude-3-sonnet' },
        'session-123',
      );

      // Empty string is falsy, should become null
      expect(mockTokenUsageService.recordUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: null,
        }),
      );
    });

    it('should handle various tenantId formats', async () => {
      const testCases = [
        { tenantId: 'simple-tenant', expected: 'simple-tenant' },
        { tenantId: '123e4567-e89b-12d3-a456-426614174000', expected: '123e4567-e89b-12d3-a456-426614174000' },
        { tenantId: 'tenant_with_underscore', expected: 'tenant_with_underscore' },
      ];

      for (const testCase of testCases) {
        mockSession.tenantId = testCase.tenantId;

        await tracker.onTokenUsage(
          { inputTokens: 100, outputTokens: 50, model: 'claude-3-sonnet' },
          'session-123',
        );

        expect(mockTokenUsageService.recordUsage).toHaveBeenLastCalledWith(
          expect.objectContaining({
            tenantId: testCase.expected,
          }),
        );
      }
    });
  });
});
