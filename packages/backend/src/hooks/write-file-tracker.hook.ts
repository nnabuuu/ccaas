/**
 * Write File Tracker Hook
 *
 * PostHook for the Write tool that copies written files to persistent storage
 * and creates database records linking them to the current assistant message.
 * Also emits file_created WebSocket event for real-time updates.
 */

import { Logger } from '@nestjs/common';
import type { ToolHook, ToolResult, ToolHookContext } from './tool-hook.interface';
import type { FilesService } from '../files/files.service';
import type { ManagedSession } from '../common/interfaces';

export interface WriteFileTrackerDeps {
  filesService: FilesService;
  getSession: (sessionId: string) => ManagedSession | undefined;
}

export interface FileCreatedEvent {
  type: 'file_created';
  payload: {
    id: string;
    filename: string;
    originalPath: string;
    mimeType: string | null;
    size: number;
    status: 'new' | 'modified' | 'synced';
    uploadedBy: 'agent' | 'user';
    createdAt: Date;
    sessionId: string;
    messageId: string;
  };
}

const logger = new Logger('WriteFileTrackerHook');

/**
 * Creates a WriteFileTracker hook with injected dependencies
 */
export function createWriteFileTrackerHook(deps: WriteFileTrackerDeps): ToolHook {
  const { filesService, getSession } = deps;

  return {
    tool: ['Write', 'write'],

    async afterToolResult(result: ToolResult, context: ToolHookContext): Promise<void> {
      // Only track successful writes
      if (result.isError) {
        logger.debug(`Skipping file tracking for failed Write tool: ${context.toolUseId}`);
        return;
      }

      // Get the file path from the tool input
      const filePath = result.input?.file_path as string;
      if (!filePath) {
        logger.warn(`Write tool result missing file_path in input: ${context.toolUseId}`);
        return;
      }

      // Get session to access message context
      const session = getSession(context.sessionId);
      if (!session) {
        logger.warn(`Session not found for Write file tracking: ${context.sessionId}`);
        return;
      }

      // Check if we have message context
      if (!session.currentAssistantMessageId) {
        logger.debug(
          `No assistant message context for session ${context.sessionId}, skipping file tracking`,
        );
        return;
      }

      try {
        const agentFile = await filesService.createFromWriteTool({
          messageId: session.currentAssistantMessageId,
          sessionId: context.sessionId,
          tenantId: session.tenantId,
          originalPath: filePath,
          workspaceDir: session.workspaceDir,
        });

        logger.log(
          `Tracked file ${agentFile.filename} (${agentFile.size} bytes) for message ${session.currentAssistantMessageId}`,
        );

        // Emit file_created event to the client for real-time updates
        if (session.socket) {
          const fileCreatedEvent: FileCreatedEvent = {
            type: 'file_created',
            payload: {
              id: agentFile.id,
              filename: agentFile.filename,
              originalPath: agentFile.originalPath,
              mimeType: agentFile.mimeType,
              size: agentFile.size,
              status: agentFile.status,
              uploadedBy: agentFile.uploadedBy,
              createdAt: agentFile.createdAt,
              sessionId: context.sessionId,
              messageId: session.currentAssistantMessageId,
            },
          };
          session.socket.emit('file_created', fileCreatedEvent);
          logger.debug(`Emitted file_created event for ${agentFile.filename}`);
        }
      } catch (error) {
        // Log but don't throw - file tracking is non-critical
        logger.error(
          `Failed to track file ${filePath}: ${error instanceof Error ? error.message : error}`,
        );
      }
    },
  };
}
