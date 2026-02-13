/**
 * Tool Call Tracker Service
 *
 * Manages active tool invocation tracking for event mapping.
 *
 * Responsibilities:
 * - Track active tool calls by toolUseId
 * - Manage parent-child Task tool relationships
 * - Provide tool call lookup functionality
 * - Session cleanup for tool tracking state
 */

import { Injectable, Logger } from '@nestjs/common';
import type { TrackedToolCall } from '../../common/interfaces';

@Injectable()
export class ToolCallTrackerService {
  private readonly logger = new Logger(ToolCallTrackerService.name);

  // Track active tool calls for mapping start/end (global across sessions)
  private activeToolCalls = new Map<string, TrackedToolCall>();

  // Track active Task tool calls for parent-child relationship (sessionId -> toolUseId)
  private activeTaskToolIds = new Map<string, string>();

  /**
   * Register a new tool call as active
   *
   * @param toolUseId - Unique tool invocation ID
   * @param toolCall - Tool call details
   */
  trackToolCall(toolUseId: string, toolCall: TrackedToolCall): void {
    this.activeToolCalls.set(toolUseId, toolCall);
    this.logger.debug(`Tracking tool call: ${toolUseId} (${toolCall.toolName})`);
  }

  /**
   * Find a tool call by toolUseId
   *
   * Supports fuzzy matching if exact match not found.
   *
   * @param toolUseId - Tool invocation ID
   * @returns TrackedToolCall or undefined
   */
  findToolCall(toolUseId: string): TrackedToolCall | undefined {
    // Exact match
    if (this.activeToolCalls.has(toolUseId)) {
      return this.activeToolCalls.get(toolUseId);
    }

    // Fuzzy match (partial ID matching)
    for (const [id, call] of this.activeToolCalls.entries()) {
      if (id.includes(toolUseId) || toolUseId.includes(id)) {
        return call;
      }
    }

    return undefined;
  }

  /**
   * Remove a tool call from tracking
   *
   * @param toolUseId - Tool invocation ID
   * @returns true if removed, false if not found
   */
  untrackToolCall(toolUseId: string): boolean {
    const removed = this.activeToolCalls.delete(toolUseId);
    if (removed) {
      this.logger.debug(`Untracked tool call: ${toolUseId}`);
    }
    return removed;
  }

  /**
   * Track Task tool start for parent-child relationship
   *
   * Used to identify which Task tool spawned a subagent.
   *
   * @param sessionId - Session ID
   * @param toolUseId - Task tool invocation ID
   */
  trackTaskToolStart(sessionId: string, toolUseId: string): void {
    this.activeTaskToolIds.set(sessionId, toolUseId);
    this.logger.debug(`Tracking Task tool: ${toolUseId} for session ${sessionId}`);
  }

  /**
   * Clear Task tool tracking on completion
   *
   * @param sessionId - Session ID
   */
  clearTaskToolTracking(sessionId: string): void {
    this.activeTaskToolIds.delete(sessionId);
    this.logger.debug(`Cleared Task tool tracking for session ${sessionId}`);
  }

  /**
   * Find parent Task tool ID for a given toolUseId
   *
   * Searches active tool calls for a Task tool that could be the parent.
   *
   * @param toolUseId - Tool invocation ID
   * @returns Parent Task tool ID or undefined
   */
  findParentTaskToolId(toolUseId: string): string | undefined {
    // Check all active tool calls for a Task tool
    for (const [id, call] of this.activeToolCalls.entries()) {
      if (call.toolName === 'Task' && id !== toolUseId) {
        return id;
      }
    }
    return undefined;
  }

  /**
   * Get all active tool calls (for debugging/monitoring)
   *
   * @returns Array of active tool calls
   */
  getAllActiveToolCalls(): TrackedToolCall[] {
    return Array.from(this.activeToolCalls.values());
  }

  /**
   * Clear all tool tracking state for a session
   *
   * Called during session cleanup.
   *
   * @param sessionId - Session ID
   */
  clearSessionState(sessionId: string): void {
    // Clear Task tool tracking
    this.clearTaskToolTracking(sessionId);

    // Clear tool calls associated with this session
    // Note: activeToolCalls is global, but we can't easily filter by session
    // without adding sessionId to TrackedToolCall interface
    // For now, we just clear Task tracking

    this.logger.debug(`Cleared tool tracking state for session ${sessionId}`);
  }
}
