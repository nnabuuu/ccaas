/**
 * Tool Analysis Service
 *
 * Provides tool intent classification and analysis utilities.
 *
 * Responsibilities:
 * - Extract agent type from session ID or tool name
 * - Classify tool intent (exploration vs action)
 * - Generate tool descriptions for UI display
 * - Extract decision logic from tool inputs
 * - Summarize exploration results
 */

import { Injectable } from '@nestjs/common';
import type { DecisionLogic } from '../../common/interfaces';

@Injectable()
export class ToolAnalysisService {
  /**
   * Extract agent type from session ID or tool name
   *
   * @param sessionId - Session ID (may contain agent type hint)
   * @param toolName - Tool name (e.g., 'Task')
   * @returns Agent type string
   */
  extractAgentType(sessionId: string, toolName?: string): string {
    if (sessionId.includes('_Explore_')) return 'Explore';
    if (sessionId.includes('_Plan_')) return 'Plan';
    if (sessionId.includes('_lesson-plan-designer_')) return 'lesson-plan-designer';
    if (sessionId.includes('_general-purpose_')) return 'general-purpose';
    if (toolName === 'Task') return 'Task';
    return 'main';
  }

  /**
   * Check if a tool is an exploration tool
   *
   * Exploration tools are used for code/file discovery and analysis.
   *
   * @param toolName - Tool name
   * @returns true if exploration tool
   */
  isExplorationTool(toolName: string): boolean {
    const explorationTools = ['Glob', 'Grep', 'Read', 'glob', 'grep', 'read', 'Task'];
    return explorationTools.includes(toolName);
  }

  /**
   * Extract decision logic from tool invocation
   *
   * Provides structured reasoning for why a tool was chosen.
   *
   * @param toolName - Tool name
   * @param input - Tool input parameters
   * @returns DecisionLogic or undefined
   */
  extractDecisionLogic(
    toolName: string,
    input: unknown,
  ): DecisionLogic | undefined {
    const inputObj = input as Record<string, unknown> | undefined;

    switch (toolName) {
      case 'Glob':
      case 'glob':
        return {
          why: `Searching for files matching pattern: ${inputObj?.pattern || '*'}`,
          benefit: 'Identify relevant files for analysis',
          nextStep: 'Read and analyze matched files',
        };

      case 'Grep':
      case 'grep':
        return {
          why: `Searching for content pattern: ${inputObj?.pattern || ''}`,
          benefit: 'Find relevant code or text',
          nextStep: 'Examine search results for context',
        };

      case 'Read':
      case 'read':
        return {
          why: `Reading file: ${inputObj?.file_path || inputObj?.path || 'file'}`,
          benefit: 'Understand file contents and context',
          nextStep: 'Analyze content and plan next action',
        };

      case 'Task':
        return {
          why: `Delegating to sub-agent: ${inputObj?.subagent_type || 'agent'}`,
          benefit: 'Specialized handling of complex task',
          nextStep: 'Process sub-agent results',
        };

      case 'write_output':
      case 'mcp__write_output':
        return {
          why: 'Saving generated content',
          benefit: 'Persist output for frontend display',
          nextStep: 'Continue with next section or complete',
        };

      default:
        return undefined;
    }
  }

  /**
   * Get exploration action type
   *
   * @param toolName - Tool name
   * @returns Action type
   */
  getExplorationAction(toolName: string): 'search' | 'read' | 'glob' | 'grep' | 'analyze' {
    switch (toolName.toLowerCase()) {
      case 'glob': return 'glob';
      case 'grep': return 'grep';
      case 'read': return 'read';
      case 'task': return 'analyze';
      default: return 'search';
    }
  }

  /**
   * Get exploration target from tool input
   *
   * @param toolName - Tool name
   * @param input - Tool input parameters
   * @returns Target description
   */
  getExplorationTarget(toolName: string, input?: Record<string, unknown>): string {
    if (!input) return 'unknown';

    switch (toolName.toLowerCase()) {
      case 'glob': return String(input.pattern || '*');
      case 'grep': return String(input.pattern || '');
      case 'read': return String(input.file_path || input.path || 'file');
      case 'task': return String(input.prompt || input.description || 'task');
      default: return JSON.stringify(input).slice(0, 100);
    }
  }

  /**
   * Get result count from exploration tool result
   *
   * @param result - Tool result (string or object)
   * @returns Result count
   */
  getExplorationResultCount(result: string | object): number {
    if (typeof result === 'string') {
      try {
        const parsed = JSON.parse(result);
        if (Array.isArray(parsed)) return parsed.length;
        if (parsed.files) return parsed.files.length;
        if (parsed.matches) return parsed.matches.length;
        if (parsed.count) return parsed.count;
      } catch {
        return result.split('\n').filter(line => line.trim()).length;
      }
    }

    if (Array.isArray(result)) return result.length;
    if (typeof result === 'object' && result !== null) {
      const obj = result as Record<string, unknown>;
      if (Array.isArray(obj.files)) return obj.files.length;
      if (Array.isArray(obj.matches)) return obj.matches.length;
      if (typeof obj.count === 'number') return obj.count;
    }

    return 0;
  }

  /**
   * Get human-readable summary of exploration results
   *
   * @param toolName - Tool name
   * @param result - Tool result
   * @param count - Result count
   * @returns Summary string
   */
  getExplorationResultSummary(
    toolName: string,
    result: string | object,
    count: number,
  ): string {
    switch (toolName.toLowerCase()) {
      case 'glob':
        return count === 0 ? 'No files found' : `Found ${count} file${count === 1 ? '' : 's'}`;
      case 'grep':
        return count === 0 ? 'No matches' : `Found ${count} match${count === 1 ? '' : 'es'}`;
      case 'read':
        if (typeof result === 'string') {
          const lines = result.split('\n').length;
          return `Read ${lines} line${lines === 1 ? '' : 's'}`;
        }
        return 'File read complete';
      case 'task':
        return 'Sub-agent task complete';
      default:
        return count > 0 ? `${count} result${count === 1 ? '' : 's'}` : 'Complete';
    }
  }

  /**
   * Get tool description for UI display
   *
   * Generates concise, user-friendly tool descriptions.
   *
   * @param toolName - Tool name
   * @param input - Tool input parameters
   * @returns Description string
   */
  getToolDescription(
    toolName: string,
    input?: Record<string, unknown>,
  ): string {
    switch (toolName) {
      case 'write_output':
      case 'mcp__write_output':
        return `Writing output (status: ${input?.status || 'unknown'})`;

      case 'todo_write':
      case 'TodoWrite':
      case 'mcp__todo_write': {
        const todos = input?.todos as Array<unknown> | undefined;
        return `Updating task list (${todos?.length || 0} items)`;
      }

      case 'Read':
      case 'read':
        return `Reading: ${input?.file_path || input?.path || 'file'}`;

      case 'Write':
      case 'write':
        return `Writing: ${input?.file_path || input?.path || 'file'}`;

      case 'Edit':
      case 'edit':
        return `Editing: ${input?.file_path || 'file'}`;

      case 'Bash':
      case 'bash':
        return `Running: ${(input?.command as string)?.slice(0, 50) || 'command'}...`;

      case 'Glob':
      case 'glob':
        return `Searching files: ${input?.pattern || '*'}`;

      case 'Grep':
      case 'grep':
        return `Searching content: ${input?.pattern || ''}`;

      case 'WebFetch':
      case 'web_fetch':
        return `Fetching: ${input?.url || 'URL'}`;

      case 'WebSearch':
      case 'web_search':
        return `Searching: ${input?.query || ''}`;

      case 'Task':
        return `Delegating to: ${input?.subagent_type || 'agent'}`;

      default:
        if (toolName.startsWith('mcp__')) {
          const parts = toolName.split('__');
          const simpleName = parts[parts.length - 1];
          return `Executing ${simpleName}`;
        }
        return `Executing ${toolName}`;
    }
  }
}
