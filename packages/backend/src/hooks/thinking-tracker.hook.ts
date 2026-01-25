/**
 * Thinking Tracker Hook
 *
 * Captures extended thinking (reasoning) events and persists them.
 */

import { Logger } from '@nestjs/common';
import type { ThinkingBlocksService } from '../messages/thinking-blocks.service';
import type { ManagedSession } from '../common/interfaces';

export interface ThinkingEvent {
  type: 'start' | 'delta' | 'end';
  thinkingId: string;
  content?: string;
  thinkingTokens?: number;
}

export interface ThinkingTrackerDeps {
  thinkingBlocksService: ThinkingBlocksService;
  getSession: (sessionId: string) => ManagedSession | undefined;
}

const logger = new Logger('ThinkingTrackerHook');

/**
 * Creates a thinking event handler with injected dependencies
 */
export function createThinkingTracker(deps: ThinkingTrackerDeps) {
  const { thinkingBlocksService, getSession } = deps;

  return {
    /**
     * Handle thinking event from EventMapper
     */
    async onThinkingEvent(
      event: ThinkingEvent,
      sessionId: string,
    ): Promise<void> {
      const session = getSession(sessionId);
      if (!session) {
        logger.debug(`Session not found for thinking tracking: ${sessionId}`);
        return;
      }

      const messageId = session.currentAssistantMessageId;
      if (!messageId) {
        logger.debug(
          `No assistant message context for session ${sessionId}, skipping thinking tracking`,
        );
        return;
      }

      try {
        switch (event.type) {
          case 'start':
            await thinkingBlocksService.startThinking({
              messageId,
              sessionId,
              tenantId: session.tenantId || null,
              thinkingId: event.thinkingId,
              content: event.content,
            });
            logger.debug(`Started thinking block ${event.thinkingId}`);
            break;

          case 'delta':
            if (event.content) {
              await thinkingBlocksService.appendDelta(event.thinkingId, event.content);
            }
            break;

          case 'end':
            await thinkingBlocksService.endThinking(
              event.thinkingId,
              event.thinkingTokens,
            );
            logger.debug(`Completed thinking block ${event.thinkingId}`);
            break;
        }
      } catch (error) {
        logger.error(
          `Failed to track thinking event: ${error instanceof Error ? error.message : error}`,
        );
      }
    },

    /**
     * Cleanup on session close
     */
    async onSessionClose(sessionId: string): Promise<void> {
      try {
        await thinkingBlocksService.cleanupSession(sessionId);
      } catch (error) {
        logger.error(
          `Failed to cleanup thinking blocks for session ${sessionId}: ${error instanceof Error ? error.message : error}`,
        );
      }
    },
  };
}

export type ThinkingTracker = ReturnType<typeof createThinkingTracker>;
