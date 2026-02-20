import { Injectable, Logger } from '@nestjs/common';
import type { ToolHook, ToolResult, ToolHookContext } from './tool-hook.interface';
import { FilesService } from '../files/files.service';
import { createWriteFileTrackerHook, type ManagedSession } from './write-file-tracker.hook';

@Injectable()
export class HooksService {
  private readonly logger = new Logger(HooksService.name);
  private hooks: ToolHook[] = [];
  private readonly sessions = new Map<string, ManagedSession>();

  constructor(private readonly filesService: FilesService) {
    this.registerDefaultHooks();
  }

  private registerDefaultHooks() {
    const writeFileTracker = createWriteFileTrackerHook({
      filesService: this.filesService,
      getSession: (sessionId) => this.sessions.get(sessionId),
    });
    this.hooks.push(writeFileTracker);
    this.logger.log('Registered WriteFileTrackerHook');
  }

  /**
   * Register a session for hook tracking
   */
  registerSession(session: ManagedSession): void {
    this.sessions.set(session.sessionId, session);
    this.logger.debug(`Registered session ${session.sessionId} for hooks`);
  }

  /**
   * Update session's current assistant message ID
   */
  updateSessionMessageId(sessionId: string, messageId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.currentAssistantMessageId = messageId;
      this.logger.debug(`Updated session ${sessionId} message ID: ${messageId}`);
    }
  }

  /**
   * Unregister a session
   */
  unregisterSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.logger.debug(`Unregistered session ${sessionId}`);
  }

  /**
   * Execute hooks after tool result
   */
  async executeAfterToolResult(
    result: ToolResult,
    context: ToolHookContext,
  ): Promise<void> {
    const matchingHooks = this.hooks.filter((h) => {
      const tools = Array.isArray(h.tool) ? h.tool : [h.tool];
      return tools.includes(context.toolName);
    });

    if (matchingHooks.length === 0) {
      return;
    }

    for (const hook of matchingHooks) {
      try {
        await hook.afterToolResult(result, context);
      } catch (error) {
        this.logger.error(
          `Hook execution failed for ${context.toolName}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
  }
}
