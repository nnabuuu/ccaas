/**
 * Background Task Monitor Service
 *
 * Monitors background task output files and manages task completion detection.
 *
 * Responsibilities:
 * - Monitor background task output files (3-second polling)
 * - Detect task completion/failure from output file content
 * - Enforce 30-minute timeout on background tasks
 * - Integrate with EventMapperService for task state management
 * - Emit completion events to WebSocket
 */

import { Injectable, Logger } from '@nestjs/common';
import { promises as fsPromises } from 'node:fs';
import { EventMapperService } from '../event-mapper.service';
import { StreamRegistryService } from './stream-registry.service';
import type { ManagedSession, FrontendEvent } from '../../common/interfaces';

/**
 * Background task tracker info
 */
interface BackgroundTaskTracker {
  subAgentId: string;
  outputFile: string;
  startedAt: Date;
}

@Injectable()
export class BackgroundTaskMonitorService {
  private readonly logger = new Logger(BackgroundTaskMonitorService.name);

  // 后台任务监控映射 (sessionId:subAgentId -> intervalId)
  private backgroundTaskMonitors = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly eventMapperService: EventMapperService,
    private readonly streamRegistry: StreamRegistryService,
  ) {}

  /**
   * Start monitoring a background task's output file
   *
   * Polls every 3 seconds to detect completion.
   * Automatically stops after 30 minutes (timeout).
   *
   * @param sessionId - Session ID
   * @param tracker - Background task tracker info
   * @param getSession - Callback to get session (for socket emission)
   */
  startBackgroundTaskMonitor(
    sessionId: string,
    tracker: BackgroundTaskTracker,
    getSession: (sessionId: string) => ManagedSession | undefined,
  ): void {
    const monitorKey = `${sessionId}:${tracker.subAgentId}`;

    // Prevent duplicate monitors
    if (this.backgroundTaskMonitors.has(monitorKey)) {
      this.logger.warn(`[BackgroundTask] Monitor already exists for ${monitorKey}`);
      return;
    }

    this.logger.log(
      `[BackgroundTask] Starting monitor for ${tracker.subAgentId}, outputFile: ${tracker.outputFile}`,
    );

    // Poll every 3 seconds
    const intervalId = setInterval(async () => {
      await this.checkBackgroundTaskStatus(sessionId, tracker, getSession);
    }, 3000);

    this.backgroundTaskMonitors.set(monitorKey, intervalId);

    // 30-minute timeout
    setTimeout(() => {
      if (this.backgroundTaskMonitors.has(monitorKey)) {
        this.logger.warn(`[BackgroundTask] Timeout for ${tracker.subAgentId} after 30 minutes`);
        this.stopBackgroundTaskMonitor(monitorKey, sessionId, tracker.subAgentId, 'timeout', getSession);
      }
    }, 30 * 60 * 1000);
  }

  /**
   * Stop monitoring a background task
   *
   * @param monitorKey - Monitor key (sessionId:subAgentId)
   */
  stopMonitorByKey(monitorKey: string): void {
    const intervalId = this.backgroundTaskMonitors.get(monitorKey);
    if (intervalId) {
      clearInterval(intervalId);
      this.backgroundTaskMonitors.delete(monitorKey);
      this.logger.log(`[BackgroundTask] Stopped monitor: ${monitorKey}`);
    }
  }

  /**
   * Stop all monitors for a session
   *
   * Called during session cleanup.
   *
   * @param sessionId - Session ID
   */
  stopAllMonitorsForSession(sessionId: string): void {
    const keysToDelete: string[] = [];

    for (const [key, intervalId] of this.backgroundTaskMonitors.entries()) {
      if (key.startsWith(`${sessionId}:`)) {
        clearInterval(intervalId);
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.backgroundTaskMonitors.delete(key));

    if (keysToDelete.length > 0) {
      this.logger.log(`[BackgroundTask] Stopped ${keysToDelete.length} monitors for session ${sessionId}`);
    }
  }

  /**
   * Stop all monitors (shutdown)
   */
  stopAllMonitors(): void {
    for (const [monitorKey, intervalId] of this.backgroundTaskMonitors.entries()) {
      clearInterval(intervalId);
      this.logger.log(`[BackgroundTask] Stopped monitor: ${monitorKey}`);
    }
    this.backgroundTaskMonitors.clear();
  }

  /**
   * Check background task status by reading output file
   *
   * @param sessionId - Session ID
   * @param tracker - Background task tracker
   * @param getSession - Callback to get session for socket emission
   */
  private async checkBackgroundTaskStatus(
    sessionId: string,
    tracker: BackgroundTaskTracker,
    getSession: (sessionId: string) => ManagedSession | undefined,
  ): Promise<void> {
    if (!tracker.outputFile) {
      return;
    }

    try {
      const content = await fsPromises.readFile(tracker.outputFile, 'utf-8');
      const lines = content.split('\n');
      const lastLines = lines.slice(-20).join('\n'); // Read last 20 lines

      // Detect completion markers
      if (
        lastLines.includes('Agent completed successfully') ||
        lastLines.includes('"type":"result"') ||
        lastLines.includes('agentId:') // Task tool return marker
      ) {
        this.logger.log(`[BackgroundTask] Task completed: ${tracker.subAgentId}`);
        const monitorKey = `${sessionId}:${tracker.subAgentId}`;
        this.stopBackgroundTaskMonitor(monitorKey, sessionId, tracker.subAgentId, 'completed', getSession);
      } else if (lastLines.includes('Error') || lastLines.includes('Failed')) {
        this.logger.warn(`[BackgroundTask] Task failed: ${tracker.subAgentId}`);
        const monitorKey = `${sessionId}:${tracker.subAgentId}`;
        this.stopBackgroundTaskMonitor(monitorKey, sessionId, tracker.subAgentId, 'failed', getSession);
      }
    } catch (error: any) {
      // File doesn't exist or can't be read, continue waiting
      if (error.code !== 'ENOENT') {
        this.logger.debug(`[BackgroundTask] Cannot read output file: ${tracker.outputFile}`);
      }
    }
  }

  /**
   * Stop background task monitor and emit completion event
   *
   * @param monitorKey - Monitor key
   * @param sessionId - Session ID
   * @param subAgentId - SubAgent ID
   * @param status - Final status
   * @param getSession - Callback to get session for socket emission
   */
  private stopBackgroundTaskMonitor(
    monitorKey: string,
    sessionId: string,
    subAgentId: string,
    status: 'completed' | 'failed' | 'timeout',
    getSession: (sessionId: string) => ManagedSession | undefined,
  ): void {
    const intervalId = this.backgroundTaskMonitors.get(monitorKey);
    if (intervalId) {
      clearInterval(intervalId);
      this.backgroundTaskMonitors.delete(monitorKey);
    }

    // Notify EventMapper to mark task complete
    const finalStatus = status === 'timeout' ? 'failed' : status;
    const error = status === 'timeout' ? 'Task timeout after 30 minutes' : undefined;

    const tracker = this.eventMapperService.markBackgroundTaskComplete(
      sessionId,
      subAgentId,
      finalStatus,
      error,
    );

    if (tracker) {
      const session = getSession(sessionId);
      const durationMs = Date.now() - tracker.startedAt.getTime();
      const event: FrontendEvent = {
        type: 'subagent_completed',
        sessionId,
        clientId: session?.clientId ?? '',
        timestamp: new Date().toISOString(),
        payload: {
          subAgentId,
          status: finalStatus,
          durationMs,
          error,
        },
      };

      // Socket.IO transport (if connected)
      if (session?.socket) {
        session.socket.emit('subagent_completed', event);
      }

      // SSE push channel — works even when no turn stream is active
      this.streamRegistry.emit(`${sessionId}:push`, event);
      this.logger.log(
        `[BackgroundTask] Sent subagent_completed event: ${subAgentId}, status=${finalStatus}`,
      );
    }
  }
}
