/**
 * SubAgent Tracker Service
 *
 * Manages active subagent tracking for sessions.
 *
 * Responsibilities:
 * - Track active subagents per session
 * - Manage subagent lifecycle (start, complete, fail)
 * - Track persistent background tasks (Task tool with run_in_background=true)
 * - Provide subagent status queries
 * - Session state cleanup
 */

import { Injectable, Logger } from '@nestjs/common';

/**
 * SubAgent tracker interface
 */
export interface SubAgentTracker {
  subAgentId: string;
  agentType: string;
  description?: string;
  startedAt: Date;
  status: 'running' | 'completed' | 'failed';
  toolName?: string;
  nestingLevel: number;
  isPersistent?: boolean;  // Task tool with run_in_background=true
  outputFile?: string;     // Background task output file path
}

/**
 * Active subagent info (for frontend)
 */
export interface ActiveSubAgentInfo {
  subAgentId: string;
  agentType: string;
  description?: string;
  startedAt: string;
  status: 'running' | 'completed' | 'failed';
  nestingLevel?: number;
}

@Injectable()
export class SubAgentTrackerService {
  private readonly logger = new Logger(SubAgentTrackerService.name);

  // Track active subagents per session (sessionId -> Map<toolUseId, SubAgentTracker>)
  private activeSubAgentsMap = new Map<string, Map<string, SubAgentTracker>>();

  /**
   * Track subagent start
   *
   * @param sessionId - Session ID
   * @param toolUseId - Tool invocation ID (becomes subAgentId)
   * @param agentType - Agent type (extracted from toolName or prompt)
   * @param description - Optional description
   * @param nestingLevel - Nesting level (1 = top-level)
   * @param toolInput - Tool input (for detecting run_in_background)
   * @param toolName - Tool name (for detecting Task tool)
   * @returns SubAgentTracker
   */
  trackSubAgentStart(
    sessionId: string,
    toolUseId: string,
    agentType: string,
    description?: string,
    nestingLevel: number = 1,
    toolInput?: Record<string, unknown>,
    toolName?: string,
  ): SubAgentTracker {
    this.logger.log(
      `[SubAgent] Tracking start: sessionId=${sessionId}, subAgentId=${toolUseId}, agentType=${agentType}, toolName=${toolName}, description="${description}", nestingLevel=${nestingLevel}`,
    );

    if (!this.activeSubAgentsMap.has(sessionId)) {
      this.activeSubAgentsMap.set(sessionId, new Map());
    }

    // Only Task tool with run_in_background=true is persistent
    // Other tools complete immediately even if they have run_in_background
    const isPersistent = toolName === 'Task' && toolInput?.run_in_background === true;

    const tracker: SubAgentTracker = {
      subAgentId: toolUseId,
      agentType,
      description,
      startedAt: new Date(),
      status: 'running',
      nestingLevel,
      toolName,
      isPersistent,
      outputFile: undefined, // Set later in tool_result
    };

    this.activeSubAgentsMap.get(sessionId)!.set(toolUseId, tracker);
    return tracker;
  }

  /**
   * Track subagent completion
   *
   * Removes from active tracking and returns tracker info for event emission.
   *
   * @param sessionId - Session ID
   * @param toolUseId - Tool invocation ID
   * @param status - Completion status
   * @param error - Optional error message
   * @returns SubAgentTracker or undefined if not found
   */
  trackSubAgentComplete(
    sessionId: string,
    toolUseId: string,
    status: 'completed' | 'failed',
    error?: string,
  ): SubAgentTracker | undefined {
    this.logger.log(
      `[SubAgent] Tracking completion: sessionId=${sessionId}, toolUseId=${toolUseId}, status=${status}, error="${error || 'none'}"`,
    );

    const sessionAgents = this.activeSubAgentsMap.get(sessionId);
    if (!sessionAgents) {
      this.logger.warn(
        `[SubAgent] No active agents found for session: ${sessionId}`,
      );
      return undefined;
    }

    const tracker = sessionAgents.get(toolUseId);
    if (tracker) {
      tracker.status = status;
      sessionAgents.delete(toolUseId);

      // Clean up empty session map
      if (sessionAgents.size === 0) {
        this.activeSubAgentsMap.delete(sessionId);
      }

      this.logger.log(
        `[SubAgent] Completed tracking: subAgentId=${tracker.subAgentId}, duration=${Date.now() - tracker.startedAt.getTime()}ms`,
      );

      return tracker;
    }

    this.logger.warn(
      `[SubAgent] No tracker found for toolUseId: ${toolUseId}`,
    );
    return undefined;
  }

  /**
   * Mark background task complete
   *
   * Called by BackgroundTaskMonitorService when polling detects completion.
   *
   * @param sessionId - Session ID
   * @param subAgentId - SubAgent ID
   * @param status - Completion status
   * @param error - Optional error message
   * @returns SubAgentTracker or undefined
   */
  markBackgroundTaskComplete(
    sessionId: string,
    subAgentId: string,
    status: 'completed' | 'failed',
    error?: string,
  ): SubAgentTracker | undefined {
    this.logger.log(
      `[SubAgent] Marking background task complete: sessionId=${sessionId}, subAgentId=${subAgentId}, status=${status}`,
    );
    return this.trackSubAgentComplete(sessionId, subAgentId, status, error);
  }

  /**
   * Set output file for a subagent
   *
   * Called when tool_result contains output_file for persistent tasks.
   *
   * @param sessionId - Session ID
   * @param toolUseId - Tool invocation ID
   * @param outputFile - Output file path
   */
  setOutputFile(sessionId: string, toolUseId: string, outputFile: string): void {
    const sessionAgents = this.activeSubAgentsMap.get(sessionId);
    if (!sessionAgents) return;

    const tracker = sessionAgents.get(toolUseId);
    if (tracker) {
      tracker.outputFile = outputFile;
      this.logger.debug(`[SubAgent] Set output file for ${toolUseId}: ${outputFile}`);
    }
  }

  /**
   * Get active subagents for a session
   *
   * @param sessionId - Session ID
   * @returns Array of active subagent info
   */
  getActiveSubAgents(sessionId: string): ActiveSubAgentInfo[] {
    const sessionAgents = this.activeSubAgentsMap.get(sessionId);
    if (!sessionAgents) return [];

    return Array.from(sessionAgents.values()).map((tracker) => ({
      subAgentId: tracker.subAgentId,
      agentType: tracker.agentType,
      description: tracker.description,
      startedAt: tracker.startedAt.toISOString(),
      status: tracker.status,
      nestingLevel: tracker.nestingLevel,
    }));
  }

  /**
   * Get subagent tracker by ID
   *
   * @param sessionId - Session ID
   * @param toolUseId - Tool invocation ID
   * @returns SubAgentTracker or undefined
   */
  getSubAgentTracker(sessionId: string, toolUseId: string): SubAgentTracker | undefined {
    const sessionAgents = this.activeSubAgentsMap.get(sessionId);
    return sessionAgents?.get(toolUseId);
  }

  /**
   * Clear all subagent tracking state for a session
   *
   * Called during session cleanup.
   *
   * @param sessionId - Session ID
   */
  clearSessionState(sessionId: string): void {
    const sessionAgents = this.activeSubAgentsMap.get(sessionId);
    if (sessionAgents) {
      const count = sessionAgents.size;
      this.activeSubAgentsMap.delete(sessionId);
      this.logger.debug(`Cleared ${count} subagent trackers for session ${sessionId}`);
    }
  }

  /**
   * Get all active sessions with subagents (for debugging/monitoring)
   *
   * @returns Array of session IDs
   */
  getAllActiveSessions(): string[] {
    return Array.from(this.activeSubAgentsMap.keys());
  }
}
