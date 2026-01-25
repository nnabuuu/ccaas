/**
 * Event Mapper Service
 *
 * Maps Claude CLI stream-json events to frontend-compatible events.
 * Maintains compatibility with existing frontend event handlers.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  CLIEvent,
  FrontendEvent,
  TrackedToolCall,
  TokenAccumulator,
  DecisionLogic,
} from '../common/interfaces';
import type { ToolHook, ToolResult, ToolHookContext, ToolStartInfo } from '../hooks';
import type { ThinkingEvent } from '../hooks/thinking-tracker.hook';
import type { TokenUsageEvent } from '../hooks/token-usage-tracker.hook';

/**
 * Callback type for thinking events
 */
export type ThinkingEventCallback = (event: ThinkingEvent, sessionId: string) => void | Promise<void>;

/**
 * Callback type for token usage events
 */
export type TokenUsageCallback = (usage: TokenUsageEvent, sessionId: string) => void | Promise<void>;

@Injectable()
export class EventMapperService {
  private readonly logger = new Logger(EventMapperService.name);
  private readonly debug: boolean;

  // Track active tool calls for mapping start/end
  private activeToolCalls = new Map<string, TrackedToolCall>();

  // Track token usage per session
  private sessionTokenAccumulators = new Map<string, TokenAccumulator>();

  // Track active thinking blocks
  private activeThinkingBlocks = new Map<string, string>();

  // Registered tool hooks
  private toolHooks: ToolHook[] = [];

  // Callbacks for thinking events
  private thinkingCallbacks: ThinkingEventCallback[] = [];

  // Callbacks for token usage events
  private tokenUsageCallbacks: TokenUsageCallback[] = [];

  constructor(private readonly configService: ConfigService) {
    this.debug = this.configService.get('debug', false);
  }

  /**
   * Register a callback for thinking events
   */
  registerThinkingCallback(callback: ThinkingEventCallback): void {
    this.thinkingCallbacks.push(callback);
    this.logger.log('Registered thinking event callback');
  }

  /**
   * Register a callback for token usage events
   */
  registerTokenUsageCallback(callback: TokenUsageCallback): void {
    this.tokenUsageCallbacks.push(callback);
    this.logger.log('Registered token usage callback');
  }

  /**
   * Execute thinking callbacks
   */
  private async executeThinkingCallbacks(event: ThinkingEvent, sessionId: string): Promise<void> {
    for (const callback of this.thinkingCallbacks) {
      try {
        await callback(event, sessionId);
      } catch (error) {
        this.logger.error(
          `Thinking callback error: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
  }

  /**
   * Execute token usage callbacks
   */
  private async executeTokenUsageCallbacks(usage: TokenUsageEvent, sessionId: string): Promise<void> {
    for (const callback of this.tokenUsageCallbacks) {
      try {
        await callback(usage, sessionId);
      } catch (error) {
        this.logger.error(
          `Token usage callback error: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
  }

  /**
   * Register a tool hook
   */
  registerToolHook(hook: ToolHook): void {
    this.toolHooks.push(hook);
    const tools = Array.isArray(hook.tool) ? hook.tool.join(', ') : hook.tool;
    this.logger.log(`Registered tool hook for: ${tools}`);
  }

  /**
   * Execute start hooks for a tool
   */
  private async executeToolStartHooks(
    toolName: string,
    info: ToolStartInfo,
    context: ToolHookContext,
  ): Promise<void> {
    const matchingHooks = this.toolHooks.filter((hook) => {
      const tools = Array.isArray(hook.tool) ? hook.tool : [hook.tool];
      return tools.includes('*') || tools.includes(toolName);
    });

    for (const hook of matchingHooks) {
      if (hook.onToolStart) {
        try {
          await hook.onToolStart(info, context);
        } catch (error) {
          this.logger.error(
            `Start hook error for ${toolName}: ${error instanceof Error ? error.message : error}`,
          );
        }
      }
    }
  }

  /**
   * Execute hooks for a tool result
   */
  private async executeToolHooks(
    toolName: string,
    result: ToolResult,
    context: ToolHookContext,
  ): Promise<void> {
    const matchingHooks = this.toolHooks.filter((hook) => {
      const tools = Array.isArray(hook.tool) ? hook.tool : [hook.tool];
      return tools.includes('*') || tools.includes(toolName);
    });

    for (const hook of matchingHooks) {
      try {
        await hook.afterToolResult(result, context);
      } catch (error) {
        this.logger.error(
          `Hook error for ${toolName}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
  }

  /**
   * Maps a single CLI event to zero or more frontend events
   */
  mapToFrontendEvents(
    cliEvent: CLIEvent,
    sessionId: string,
    clientId: string,
  ): FrontendEvent[] {
    const events: FrontendEvent[] = [];
    const timestamp = new Date().toISOString();

    switch (cliEvent.type) {
      // =========================================================================
      // Claude Code CLI stream-json format events
      // =========================================================================

      case 'system':
        if (this.debug) {
          this.logger.debug(`System event: ${(cliEvent as any).subtype}`);
        }
        break;

      case 'assistant': {
        const msg = (cliEvent as any).message;
        if (msg?.content) {
          for (const block of msg.content) {
            if (block.type === 'text' && block.text) {
              events.push({
                type: 'text_delta',
                sessionId,
                clientId,
                text: block.text,
                timestamp,
              });
            } else if (block.type === 'tool_use') {
              const toolId = block.id || `tool_${Date.now()}`;
              const toolName = block.name || 'unknown';

              this.activeToolCalls.set(toolId, {
                toolId,
                toolName,
                startTime: Date.now(),
                input: block.input || {},
              });

              const agentType = this.extractAgentType(sessionId, toolName);
              const decisionLogic = this.extractDecisionLogic(toolName, block.input);

              events.push({
                type: 'tool_activity',
                sessionId,
                clientId,
                payload: {
                  toolName,
                  toolId,
                  phase: 'start',
                  description: this.getToolDescription(toolName, block.input),
                  toolInput: block.input,
                  decisionLogic,
                  agentType,
                  nestingLevel: agentType === 'main' ? 0 : 1,
                  timestamp,
                },
              });

              // Execute tool start hooks (async, non-blocking)
              const startInfo: ToolStartInfo = {
                toolName,
                toolId,
                input: block.input || {},
                agentType,
                decisionLogic,
              };
              const startContext: ToolHookContext = {
                sessionId,
                clientId,
                toolUseId: toolId,
                timestamp,
              };
              this.executeToolStartHooks(toolName, startInfo, startContext).catch((err) => {
                this.logger.error(`Tool start hook execution failed: ${err}`);
              });

              if (this.isExplorationTool(toolName) && agentType !== 'main') {
                events.push({
                  type: 'exploration_activity',
                  sessionId,
                  timestamp,
                  payload: {
                    action: this.getExplorationAction(toolName),
                    target: this.getExplorationTarget(toolName, block.input),
                    agentType,
                    phase: 'start',
                  },
                });
              }
            }
          }
        }
        break;
      }

      case 'user': {
        // Handle CLI tool_result format: user messages contain tool_result content blocks
        const userMsg = (cliEvent as any).message;
        if (userMsg?.content && Array.isArray(userMsg.content)) {
          for (const block of userMsg.content) {
            if (block.type === 'tool_result') {
              // Extract tool result info
              const toolUseId = block.tool_use_id;
              const toolCall = this.findToolCall(toolUseId);
              const duration = toolCall ? Date.now() - toolCall.startTime : 0;
              const toolName = toolCall?.toolName || 'unknown';
              const isError = block.is_error || false;
              const agentType = this.extractAgentType(sessionId, toolName);

              // Emit tool_activity end event
              events.push({
                type: 'tool_activity',
                sessionId,
                clientId,
                payload: {
                  toolName,
                  toolId: toolUseId,
                  phase: 'end',
                  description: `Completed: ${this.getToolDescription(toolName, toolCall?.input)}`,
                  success: !isError,
                  duration,
                  toolInput: toolCall?.input,
                  toolOutput: block.content,
                  toolError: isError ? String(block.content) : undefined,
                  agentType,
                  nestingLevel: agentType === 'main' ? 0 : 1,
                  timestamp,
                },
              });

              // Emit exploration_activity if applicable
              if (toolCall && this.isExplorationTool(toolName) && agentType !== 'main') {
                const resultCount = this.getExplorationResultCount(block.content);
                events.push({
                  type: 'exploration_activity',
                  sessionId,
                  timestamp,
                  payload: {
                    action: this.getExplorationAction(toolName),
                    target: this.getExplorationTarget(toolName, toolCall.input),
                    agentType,
                    phase: 'complete',
                    resultCount,
                    resultSummary: this.getExplorationResultSummary(toolName, block.content, resultCount),
                    durationMs: duration,
                  },
                });
              }

              // Handle special tools (write_output, todo_write, etc.)
              if (toolCall) {
                const specialEvents = this.handleSpecialToolResult(
                  toolName,
                  block.content,
                  sessionId,
                  clientId,
                  timestamp,
                );
                events.push(...specialEvents);

                // Execute registered tool hooks (async, non-blocking)
                // This is critical for WriteFileTracker to track written files
                const hookResult: ToolResult = {
                  toolName,
                  input: toolCall.input,
                  output: block.content,
                  isError,
                  durationMs: duration,
                };
                const hookContext: ToolHookContext = {
                  sessionId,
                  clientId,
                  toolUseId,
                  timestamp,
                };
                // Fire and forget - hooks should not block event processing
                this.executeToolHooks(toolName, hookResult, hookContext).catch((err) => {
                  this.logger.error(`Tool hook execution failed: ${err}`);
                });

                this.activeToolCalls.delete(toolUseId);
              }
            }
          }
        }
        break;
      }

      case 'result': {
        const result = cliEvent as any;
        if (result.subtype === 'success' && result.result) {
          events.push({
            type: 'chat_response',
            sessionId,
            clientId,
            text: result.result,
            timestamp,
          });
        }

        // Emit agent_status complete when result is received
        // This signals the frontend that the response is complete
        // (CLI stays alive with --input-format stream-json, so we can't rely on process exit)
        events.push({
          type: 'agent_status',
          status: 'complete',
          sessionId,
          timestamp,
        });
        break;
      }

      // =========================================================================
      // Anthropic API format events (for compatibility)
      // =========================================================================

      case 'message_start':
        break;

      case 'content_block_start':
        if (cliEvent.content_block?.type === 'tool_use') {
          const block = cliEvent.content_block;
          const toolId = block.id || `tool_${Date.now()}`;
          const toolName = block.name || 'unknown';

          this.activeToolCalls.set(toolId, {
            toolId,
            toolName,
            startTime: Date.now(),
            input: block.input || {},
          });

          const agentType = this.extractAgentType(sessionId, toolName);
          const decisionLogic = this.extractDecisionLogic(toolName, block.input);

          events.push({
            type: 'tool_activity',
            sessionId,
            clientId,
            payload: {
              toolName,
              toolId,
              phase: 'start',
              description: this.getToolDescription(toolName, block.input),
              toolInput: block.input,
              decisionLogic,
              agentType,
              nestingLevel: agentType === 'main' ? 0 : 1,
              timestamp,
            },
          });

          // Execute tool start hooks (async, non-blocking)
          const startInfo: ToolStartInfo = {
            toolName,
            toolId,
            input: block.input || {},
            agentType,
            decisionLogic,
          };
          const startContext: ToolHookContext = {
            sessionId,
            clientId,
            toolUseId: toolId,
            timestamp,
          };
          this.executeToolStartHooks(toolName, startInfo, startContext).catch((err) => {
            this.logger.error(`Tool start hook execution failed: ${err}`);
          });

          if (this.isExplorationTool(toolName) && agentType !== 'main') {
            events.push({
              type: 'exploration_activity',
              sessionId,
              timestamp,
              payload: {
                action: this.getExplorationAction(toolName),
                target: this.getExplorationTarget(toolName, block.input),
                agentType,
                phase: 'start',
              },
            });
          }
        }
        break;

      case 'content_block_delta':
        if (cliEvent.delta?.type === 'text_delta' && cliEvent.delta.text) {
          events.push({
            type: 'text_delta',
            sessionId,
            clientId,
            text: cliEvent.delta.text,
            timestamp,
          });
        }
        break;

      case 'content_block_stop':
        break;

      case 'tool_result': {
        const toolResult = cliEvent.tool_result;
        if (!toolResult) break;

        const toolCall = this.findToolCall(toolResult.tool_use_id);
        const duration = toolCall ? Date.now() - toolCall.startTime : 0;
        const toolName = toolCall?.toolName || 'unknown';
        const agentType = this.extractAgentType(sessionId, toolName);

        events.push({
          type: 'tool_activity',
          sessionId,
          clientId,
          payload: {
            toolName,
            toolId: toolResult.tool_use_id,
            phase: 'end',
            description: `Completed: ${this.getToolDescription(toolName, toolCall?.input)}`,
            success: !toolResult.is_error,
            duration,
            toolInput: toolCall?.input,
            toolOutput: toolResult.content,
            toolError: toolResult.is_error ? String(toolResult.content) : undefined,
            agentType,
            nestingLevel: agentType === 'main' ? 0 : 1,
            timestamp,
          },
        });

        if (toolCall && this.isExplorationTool(toolName) && agentType !== 'main') {
          const resultCount = this.getExplorationResultCount(toolResult.content);
          events.push({
            type: 'exploration_activity',
            sessionId,
            timestamp,
            payload: {
              action: this.getExplorationAction(toolName),
              target: this.getExplorationTarget(toolName, toolCall.input),
              agentType,
              phase: 'complete',
              resultCount,
              resultSummary: this.getExplorationResultSummary(toolName, toolResult.content, resultCount),
              durationMs: duration,
            },
          });
        }

        // Handle special tools
        if (toolCall) {
          const specialEvents = this.handleSpecialToolResult(
            toolName,
            toolResult.content,
            sessionId,
            clientId,
            timestamp,
          );
          events.push(...specialEvents);

          // Execute registered tool hooks (async, non-blocking)
          const hookResult: ToolResult = {
            toolName,
            input: toolCall.input,
            output: toolResult.content,
            isError: toolResult.is_error || false,
            durationMs: duration,
          };
          const hookContext: ToolHookContext = {
            sessionId,
            clientId,
            toolUseId: toolResult.tool_use_id,
            timestamp,
          };
          // Fire and forget - hooks should not block event processing
          this.executeToolHooks(toolName, hookResult, hookContext).catch((err) => {
            this.logger.error(`Tool hook execution failed: ${err}`);
          });

          this.activeToolCalls.delete(toolResult.tool_use_id);
        }
        break;
      }

      case 'message_stop':
        break;

      // =========================================================================
      // Extended Thinking Events
      // =========================================================================

      case 'reasoning-start':
      case 'thinking-start': {
        const thinkingId = (cliEvent as any).id || `thinking_${Date.now()}`;
        this.activeThinkingBlocks.set(sessionId, thinkingId);

        events.push({
          type: 'agent_thinking',
          sessionId,
          timestamp,
          payload: {
            phase: 'start',
            thinkingId,
          },
        });

        // Fire thinking callback (async, non-blocking)
        this.executeThinkingCallbacks(
          { type: 'start', thinkingId },
          sessionId,
        ).catch((err) => this.logger.error(`Thinking start callback failed: ${err}`));
        break;
      }

      case 'reasoning-delta':
      case 'thinking-delta': {
        const thinkingId = this.activeThinkingBlocks.get(sessionId) || `thinking_${Date.now()}`;
        const delta = (cliEvent as any).delta || (cliEvent as any).text || '';

        events.push({
          type: 'agent_thinking',
          sessionId,
          timestamp,
          payload: {
            phase: 'delta',
            content: delta,
            thinkingId,
          },
        });

        // Fire thinking callback (async, non-blocking)
        if (delta) {
          this.executeThinkingCallbacks(
            { type: 'delta', thinkingId, content: delta },
            sessionId,
          ).catch((err) => this.logger.error(`Thinking delta callback failed: ${err}`));
        }
        break;
      }

      case 'reasoning-end':
      case 'thinking-end': {
        const thinkingId = this.activeThinkingBlocks.get(sessionId) || `thinking_${Date.now()}`;
        this.activeThinkingBlocks.delete(sessionId);

        events.push({
          type: 'agent_thinking',
          sessionId,
          timestamp,
          payload: {
            phase: 'end',
            thinkingId,
          },
        });

        // Fire thinking callback (async, non-blocking)
        this.executeThinkingCallbacks(
          { type: 'end', thinkingId },
          sessionId,
        ).catch((err) => this.logger.error(`Thinking end callback failed: ${err}`));
        break;
      }

      // =========================================================================
      // Token Usage Events
      // =========================================================================

      case 'finish-step':
      case 'message_delta': {
        const usageEvent = cliEvent as any;
        const usage = usageEvent.usage || usageEvent.message?.usage;

        if (usage) {
          const accumulator = this.getTokenAccumulator(sessionId);
          this.accumulateTokens(accumulator, {
            inputTokens: usage.input_tokens || 0,
            outputTokens: usage.output_tokens || 0,
            cachedTokens: usage.cache_read_input_tokens || 0,
          });

          const model = usageEvent.model || usageEvent.message?.model || 'unknown';
          const stopReason = usageEvent.finish_reason || usageEvent.stop_reason || 'unknown';
          const apiMessageId = usageEvent.id || usageEvent.message?.id || 'unknown';

          events.push({
            type: 'token_usage',
            sessionId,
            timestamp,
            payload: {
              inputTokens: usage.input_tokens || 0,
              outputTokens: usage.output_tokens || 0,
              cachedInputTokens: usage.cache_read_input_tokens,
              sessionTotalTokens: accumulator.inputTokens + accumulator.outputTokens,
              sessionInputTokens: accumulator.inputTokens,
              sessionOutputTokens: accumulator.outputTokens,
              model,
              stopReason,
              messageId: apiMessageId,
            },
          });

          // Fire token usage callback (async, non-blocking)
          this.executeTokenUsageCallbacks(
            {
              inputTokens: usage.input_tokens || 0,
              outputTokens: usage.output_tokens || 0,
              cachedInputTokens: usage.cache_read_input_tokens || 0,
              cacheReadTokens: usage.cache_read_input_tokens || 0,
              cacheCreationTokens: usage.cache_creation_input_tokens || 0,
              reasoningTokens: usage.reasoning_tokens || 0,
              model,
              stopReason,
              apiMessageId,
            },
            sessionId,
          ).catch((err) => this.logger.error(`Token usage callback failed: ${err}`));
        }
        break;
      }

      default:
        if (this.debug) {
          this.logger.debug(`Unhandled event type: ${cliEvent.type}`);
        }
    }

    return events;
  }

  /**
   * Clear session state (on session cleanup)
   */
  clearSessionState(sessionId: string): void {
    this.sessionTokenAccumulators.delete(sessionId);
    this.activeThinkingBlocks.delete(sessionId);
  }

  // =========================================================================
  // Private Helper Methods
  // =========================================================================

  private extractAgentType(sessionId: string, toolName?: string): string {
    if (sessionId.includes('_Explore_')) return 'Explore';
    if (sessionId.includes('_Plan_')) return 'Plan';
    if (sessionId.includes('_lesson-plan-designer_')) return 'lesson-plan-designer';
    if (sessionId.includes('_general-purpose_')) return 'general-purpose';
    if (toolName === 'Task') return 'Task';
    return 'main';
  }

  private isExplorationTool(toolName: string): boolean {
    const explorationTools = ['Glob', 'Grep', 'Read', 'glob', 'grep', 'read', 'Task'];
    return explorationTools.includes(toolName);
  }

  private extractDecisionLogic(
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

  private getExplorationAction(toolName: string): 'search' | 'read' | 'glob' | 'grep' | 'analyze' {
    switch (toolName.toLowerCase()) {
      case 'glob': return 'glob';
      case 'grep': return 'grep';
      case 'read': return 'read';
      case 'task': return 'analyze';
      default: return 'search';
    }
  }

  private getExplorationTarget(toolName: string, input?: Record<string, unknown>): string {
    if (!input) return 'unknown';

    switch (toolName.toLowerCase()) {
      case 'glob': return String(input.pattern || '*');
      case 'grep': return String(input.pattern || '');
      case 'read': return String(input.file_path || input.path || 'file');
      case 'task': return String(input.prompt || input.description || 'task');
      default: return JSON.stringify(input).slice(0, 100);
    }
  }

  private getExplorationResultCount(result: string | object): number {
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

  private getExplorationResultSummary(
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

  private findToolCall(toolUseId: string): TrackedToolCall | undefined {
    if (this.activeToolCalls.has(toolUseId)) {
      return this.activeToolCalls.get(toolUseId);
    }

    for (const [id, call] of this.activeToolCalls.entries()) {
      if (id.includes(toolUseId) || toolUseId.includes(id)) {
        return call;
      }
    }

    return undefined;
  }

  private getToolDescription(
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

      default:
        if (toolName.startsWith('mcp__')) {
          const parts = toolName.split('__');
          const simpleName = parts[parts.length - 1];
          return `Executing ${simpleName}`;
        }
        return `Executing ${toolName}`;
    }
  }

  private handleSpecialToolResult(
    toolName: string,
    result: string | object,
    sessionId: string,
    clientId: string,
    timestamp: string,
  ): FrontendEvent[] {
    const events: FrontendEvent[] = [];

    const normalizedName = toolName
      .replace(/^mcp__[^_]+__/, '')
      .replace(/^mcp__/, '');

    let parsedResult: Record<string, unknown> = {};
    if (typeof result === 'string') {
      try {
        parsedResult = JSON.parse(result);
      } catch {
        parsedResult = { raw: result };
      }
    } else if (typeof result === 'object' && result !== null) {
      parsedResult = result as Record<string, unknown>;
    }

    switch (normalizedName) {
      case 'write_output':
        events.push({
          type: 'output_update',
          sessionId,
          clientId,
          payload: {
            data: parsedResult.data || parsedResult,
            status: (parsedResult.status as string) || 'unknown',
            progress: parsedResult.progress as number | undefined,
            timestamp,
          },
        });
        break;

      case 'todo_write':
      case 'TodoWrite': {
        const todos = (parsedResult.todos || []) as Array<{
          status?: string;
          [key: string]: unknown;
        }>;
        const completed = todos.filter((t) => t.status === 'completed').length;
        const inProgress = todos.filter((t) => t.status === 'in_progress').length;
        const pending = todos.filter((t) => t.status === 'pending').length;

        events.push({
          type: 'todo_update',
          sessionId,
          clientId,
          payload: {
            todos,
            completed,
            inProgress,
            pending,
            total: todos.length,
            timestamp,
          },
        });
        break;
      }
    }

    return events;
  }

  private getTokenAccumulator(sessionId: string): TokenAccumulator {
    if (!this.sessionTokenAccumulators.has(sessionId)) {
      this.sessionTokenAccumulators.set(sessionId, {
        sessionId,
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        reasoningTokens: 0,
        requestCount: 0,
        startTime: Date.now(),
      });
    }
    return this.sessionTokenAccumulators.get(sessionId)!;
  }

  private accumulateTokens(
    accumulator: TokenAccumulator,
    usage: {
      inputTokens?: number;
      outputTokens?: number;
      cachedTokens?: number;
      reasoningTokens?: number;
    },
  ): void {
    accumulator.inputTokens += usage.inputTokens ?? 0;
    accumulator.outputTokens += usage.outputTokens ?? 0;
    accumulator.cachedTokens += usage.cachedTokens ?? 0;
    accumulator.reasoningTokens += usage.reasoningTokens ?? 0;
    accumulator.requestCount++;
  }
}
