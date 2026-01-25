/**
 * Tool Event Tracker Hook
 *
 * Persists all tool events (start and end phases) to the database.
 * Links tool activity to the current assistant message.
 */

import { Logger } from '@nestjs/common';
import type { ToolHook, ToolStartInfo, ToolResult, ToolHookContext } from './tool-hook.interface';
import type { ToolEventsService } from '../messages/tool-events.service';
import type { ManagedSession } from '../common/interfaces';

export interface ToolEventTrackerDeps {
  toolEventsService: ToolEventsService;
  getSession: (sessionId: string) => ManagedSession | undefined;
}

const logger = new Logger('ToolEventTrackerHook');

/**
 * Creates a ToolEventTracker hook with injected dependencies
 */
export function createToolEventTrackerHook(deps: ToolEventTrackerDeps): ToolHook {
  const { toolEventsService, getSession } = deps;

  return {
    // Match all tools
    tool: '*',

    /**
     * Called when a tool starts execution
     */
    async onToolStart(info: ToolStartInfo, context: ToolHookContext): Promise<void> {
      // Get session to access message context
      const session = getSession(context.sessionId);
      if (!session) {
        logger.debug(`Session not found for tool start tracking: ${context.sessionId}`);
        return;
      }

      // Check if we have message context
      if (!session.currentAssistantMessageId) {
        logger.debug(
          `No assistant message context for session ${context.sessionId}, skipping tool start tracking`,
        );
        return;
      }

      try {
        await toolEventsService.recordStart({
          messageId: session.currentAssistantMessageId,
          sessionId: context.sessionId,
          tenantId: session.tenantId || null,
          toolUseId: info.toolId,
          toolName: info.toolName,
          toolInput: info.input,
          agentType: info.agentType,
          decisionLogic: info.decisionLogic,
        });

        logger.debug(
          `Tracked tool start: ${info.toolName} (${info.toolId}) for message ${session.currentAssistantMessageId}`,
        );
      } catch (error) {
        // Log but don't throw - tool event tracking is non-critical
        logger.error(
          `Failed to track tool start ${info.toolName}: ${error instanceof Error ? error.message : error}`,
        );
      }
    },

    /**
     * Called after the tool result is processed
     */
    async afterToolResult(result: ToolResult, context: ToolHookContext): Promise<void> {
      // Get session to access message context
      const session = getSession(context.sessionId);
      if (!session) {
        logger.debug(`Session not found for tool end tracking: ${context.sessionId}`);
        return;
      }

      // Check if we have message context
      if (!session.currentAssistantMessageId) {
        logger.debug(
          `No assistant message context for session ${context.sessionId}, skipping tool end tracking`,
        );
        return;
      }

      try {
        await toolEventsService.recordEnd({
          messageId: session.currentAssistantMessageId,
          sessionId: context.sessionId,
          tenantId: session.tenantId || null,
          toolUseId: context.toolUseId,
          toolName: result.toolName,
          toolInput: result.input,
          toolOutput: result.output,
          success: !result.isError,
          durationMs: result.durationMs,
          agentType: extractAgentType(context.sessionId, result.toolName),
        });

        logger.debug(
          `Tracked tool end: ${result.toolName} (${context.toolUseId}) success=${!result.isError} for message ${session.currentAssistantMessageId}`,
        );
      } catch (error) {
        // Log but don't throw - tool event tracking is non-critical
        logger.error(
          `Failed to track tool end ${result.toolName}: ${error instanceof Error ? error.message : error}`,
        );
      }
    },
  };
}

/**
 * Extract agent type from session ID or tool name
 */
function extractAgentType(sessionId: string, toolName?: string): string {
  if (sessionId.includes('_Explore_')) return 'Explore';
  if (sessionId.includes('_Plan_')) return 'Plan';
  if (sessionId.includes('_lesson-plan-designer_')) return 'lesson-plan-designer';
  if (sessionId.includes('_general-purpose_')) return 'general-purpose';
  if (toolName === 'Task') return 'Task';
  return 'main';
}
