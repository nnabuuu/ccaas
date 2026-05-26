/**
 * Process Lifecycle Tracker Hook
 *
 * Captures AgentEngine process lifecycle events (spawn, exit, crash, kill).
 */

import { Logger } from '@nestjs/common';
import type { ProcessLifecycleService } from '../messages/process-lifecycle.service';
import type { ProcessEventType } from '../messages/entities/process-lifecycle-event.entity';

export interface ProcessEvent {
  eventType: ProcessEventType;
  pid?: number | null;
  exitCode?: number | null;
  signal?: string | null;
  stderr?: string | null;
  errorMessage?: string | null;
  command?: string | null;
  workingDir?: string | null;
}

import type { ManagedSession } from '../common/interfaces';

export interface ProcessLifecycleTrackerDeps {
  processLifecycleService: ProcessLifecycleService;
  getSession: (sessionId: string) => ManagedSession | undefined;
}

const logger = new Logger('ProcessLifecycleTrackerHook');

/**
 * Creates a process lifecycle tracker with injected dependencies
 */
export function createProcessLifecycleTracker(deps: ProcessLifecycleTrackerDeps) {
  const { processLifecycleService, getSession } = deps;

  /**
   * Get solutionId from session
   */
  const getTenantId = (sessionId: string): string | null => {
    const session = getSession(sessionId);
    return session?.solutionId || null;
  };

  return {
    /**
     * Record process spawn
     */
    async onSpawn(
      sessionId: string,
      pid: number,
      command?: string,
      workingDir?: string,
    ): Promise<void> {
      try {
        const solutionId = getTenantId(sessionId);
        await processLifecycleService.recordSpawn(sessionId, pid, command, workingDir, solutionId);
        logger.debug(`Recorded spawn for session ${sessionId} (PID: ${pid})`);
      } catch (error) {
        logger.error(`Failed to record spawn: ${error instanceof Error ? error.message : error}`);
      }
    },

    /**
     * Record process exit
     */
    async onExit(
      sessionId: string,
      pid: number | null,
      exitCode: number | null,
      signal?: string,
    ): Promise<void> {
      try {
        const solutionId = getTenantId(sessionId);
        await processLifecycleService.recordExit(sessionId, pid, exitCode, signal, solutionId);
        logger.debug(`Recorded exit for session ${sessionId} (code: ${exitCode})`);
      } catch (error) {
        logger.error(`Failed to record exit: ${error instanceof Error ? error.message : error}`);
      }
    },

    /**
     * Record process crash
     */
    async onCrash(
      sessionId: string,
      pid: number | null,
      errorMessage?: string,
      stderr?: string,
    ): Promise<void> {
      try {
        const solutionId = getTenantId(sessionId);
        await processLifecycleService.recordCrash(sessionId, pid, errorMessage, stderr, solutionId);
        logger.debug(`Recorded crash for session ${sessionId}`);
      } catch (error) {
        logger.error(`Failed to record crash: ${error instanceof Error ? error.message : error}`);
      }
    },

    /**
     * Record process kill
     */
    async onKill(
      sessionId: string,
      pid: number | null,
      signal: string = 'SIGTERM',
    ): Promise<void> {
      try {
        const solutionId = getTenantId(sessionId);
        await processLifecycleService.recordKill(sessionId, pid, signal, solutionId);
        logger.debug(`Recorded kill for session ${sessionId}`);
      } catch (error) {
        logger.error(`Failed to record kill: ${error instanceof Error ? error.message : error}`);
      }
    },
  };
}

export type ProcessLifecycleTracker = ReturnType<typeof createProcessLifecycleTracker>;
