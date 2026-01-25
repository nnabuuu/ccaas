/**
 * Token Usage Tracker Hook
 *
 * Captures token usage events and persists them for cost analysis.
 */

import { Logger } from '@nestjs/common';
import type { TokenUsageService } from '../messages/token-usage.service';
import type { ContextWindowUsage } from '../messages/entities/token-usage-event.entity';
import type { ManagedSession } from '../common/interfaces';

export interface TokenUsageEvent {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  reasoningTokens?: number;
  model: string;
  stopReason?: string;
  apiMessageId?: string;
  contextWindowUsage?: ContextWindowUsage;
}

export interface TokenUsageTrackerDeps {
  tokenUsageService: TokenUsageService;
  getSession: (sessionId: string) => ManagedSession | undefined;
}

const logger = new Logger('TokenUsageTrackerHook');

/**
 * Creates a token usage event handler with injected dependencies
 */
export function createTokenUsageTracker(deps: TokenUsageTrackerDeps) {
  const { tokenUsageService, getSession } = deps;

  return {
    /**
     * Handle token usage event from EventMapper
     */
    async onTokenUsage(
      usage: TokenUsageEvent,
      sessionId: string,
    ): Promise<void> {
      const session = getSession(sessionId);
      if (!session) {
        logger.debug(`Session not found for token usage tracking: ${sessionId}`);
        return;
      }

      const messageId = session.currentAssistantMessageId;
      if (!messageId) {
        logger.debug(
          `No assistant message context for session ${sessionId}, skipping token usage tracking`,
        );
        return;
      }

      try {
        await tokenUsageService.recordUsage({
          messageId,
          sessionId,
          tenantId: session.tenantId || null,
          model: usage.model,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          cachedInputTokens: usage.cachedInputTokens,
          cacheReadTokens: usage.cacheReadTokens,
          cacheCreationTokens: usage.cacheCreationTokens,
          reasoningTokens: usage.reasoningTokens,
          contextWindowUsage: usage.contextWindowUsage || null,
          stopReason: usage.stopReason || null,
          apiMessageId: usage.apiMessageId || null,
        });

        logger.debug(
          `Tracked token usage for message ${messageId}: ` +
            `in=${usage.inputTokens}, out=${usage.outputTokens}`,
        );
      } catch (error) {
        logger.error(
          `Failed to track token usage: ${error instanceof Error ? error.message : error}`,
        );
      }
    },
  };
}

export type TokenUsageTracker = ReturnType<typeof createTokenUsageTracker>;
