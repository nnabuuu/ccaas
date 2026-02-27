/**
 * Event Mapper Service
 *
 * Maps AgentEngine stream-json events to frontend-compatible events.
 * Supports: Claude Code, OpenCode, and custom engine outputs.
 * Maintains compatibility with existing frontend event handlers.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  CLIEvent,
  FrontendEvent,
  ManagedSession,
  TrackedToolCall,
  TokenAccumulator,
  DecisionLogic,
} from '../common/interfaces';
import { TokenUsageService } from '../messages/token-usage.service';
import type { ToolHook, ToolResult, ToolHookContext, ToolStartInfo } from '../hooks';
import { classifyToolError } from '../hooks/error-classifier';
import type { ThinkingEvent } from '../hooks/thinking-tracker.hook';
import { ToolCallTrackerService } from './services/tool-call-tracker.service';
import { SubAgentTrackerService, SubAgentTracker } from './services/subagent-tracker.service';
import { ToolAnalysisService } from './services/tool-analysis.service';
import type { ToolEventTrigger } from '../mcp/types';

/**
 * Callback type for thinking events
 */
export type ThinkingEventCallback = (event: ThinkingEvent, sessionId: string) => void | Promise<void>;

// Re-export SubAgentTracker for backward compatibility
export type { SubAgentTracker } from './services/subagent-tracker.service';

@Injectable()
export class EventMapperService {
  private readonly logger = new Logger(EventMapperService.name);
  private readonly debug: boolean;

  // Tools handled by the hardcoded switch — excluded from trigger loop to prevent double-emit
  // Tools handled by the hardcoded switch — exposed for admin timeline derivation
  static readonly TRIGGER_HANDLED_TOOLS = new Set(['write_output', 'attach_file']);

  // Track execution order per session (messageId -> counter)
  private sessionExecutionCounters = new Map<string, number>();

  // Track token usage per session
  private sessionTokenAccumulators = new Map<string, TokenAccumulator>();

  // Track active thinking blocks
  private activeThinkingBlocks = new Map<string, string>();

  // Registered tool hooks
  private toolHooks: ToolHook[] = [];

  // Track background task spawning messages (sessionId:toolUseId → messageId)
  private backgroundTaskSpawningMessages = new Map<string, string>();

  // Getter to retrieve session context (used for background task tracking and token recording)
  private sessionGetter?: (sessionId: string) => ManagedSession | undefined;

  // Callbacks for thinking events
  private thinkingCallbacks: ThinkingEventCallback[] = [];

  // Callbacks for background task registration
  private backgroundTaskCallbacks: Array<(sessionId: string, tracker: SubAgentTracker) => void> = [];

  // Tenant-configured tool event triggers (populated at startup by SolutionLoaderService)
  private tenantToolTriggers = new Map<string, ToolEventTrigger[]>();

  constructor(
    private readonly configService: ConfigService,
    private readonly toolCallTracker: ToolCallTrackerService,
    private readonly subAgentTracker: SubAgentTrackerService,
    private readonly toolAnalysis: ToolAnalysisService,
    private readonly tokenUsageService: TokenUsageService,
  ) {
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
   * Register a tool hook
   */
  registerToolHook(hook: ToolHook): void {
    this.toolHooks.push(hook);
    const tools = Array.isArray(hook.tool) ? hook.tool.join(', ') : hook.tool;
    this.logger.log(`Registered tool hook for: ${tools}`);
  }

  /**
   * Register callback to retrieve session context by sessionId.
   * Used for background task tracking and inline token recording.
   * Called from SessionsGateway during initialization.
   */
  registerSessionGetter(getter: (sessionId: string) => ManagedSession | undefined): void {
    this.sessionGetter = getter;
  }

  /**
   * Register tool event triggers for a tenant.
   * Called by SolutionLoaderService after loading each solution.
   * Replaces any existing triggers for the tenant.
   */
  registerTenantToolTriggers(tenantId: string, triggers: ToolEventTrigger[]): void {
    this.tenantToolTriggers.set(tenantId, triggers);
    this.logger.debug(`Registered ${triggers.length} tool event trigger(s) for tenant ${tenantId}`);
  }

  /**
   * Clear all tenant tool trigger registrations.
   * Called by SolutionLoaderService at the start of loadAll() to ensure
   * stale entries from removed solutions are purged before re-registration.
   */
  clearAllTenantToolTriggers(): void {
    this.tenantToolTriggers.clear();
  }

  /**
   * Get tenant tool triggers for a given tenant.
   * Used by SessionManagerService to derive output_update events in the admin timeline.
   */
  getTenantToolTriggers(tenantId: string): ToolEventTrigger[] {
    return this.tenantToolTriggers.get(tenantId) ?? [];
  }

  /**
   * Extract token usage from a CLI event, accumulate, emit frontend event, and persist to DB.
   * Shared between 'assistant' and 'result' event handlers.
   */
  private handleTokenUsage(
    sessionId: string,
    usage: Record<string, any>,
    model: string,
    stopReason: string | null,
    apiMessageId: string | null,
    timestamp: string,
    logLabel: string,
  ): FrontendEvent {
    const accumulator = this.getTokenAccumulator(sessionId);
    this.accumulateTokens(accumulator, {
      inputTokens: usage.input_tokens || 0,
      outputTokens: usage.output_tokens || 0,
      cachedTokens: usage.cache_read_input_tokens || 0,
    });

    const event: FrontendEvent = {
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
    };

    const session = this.sessionGetter?.(sessionId);
    if (session?.currentAssistantMessageId) {
      this.tokenUsageService.recordUsage({
        messageId: session.currentAssistantMessageId,
        sessionId,
        tenantId: session.tenantId ?? null,
        model,
        inputTokens: usage.input_tokens || 0,
        outputTokens: usage.output_tokens || 0,
        cachedInputTokens: usage.cache_read_input_tokens || 0,
        cacheReadTokens: usage.cache_read_input_tokens || 0,
        cacheCreationTokens: usage.cache_creation_input_tokens || 0,
        reasoningTokens: usage.reasoning_tokens || 0,
        contextWindowUsage: usage.context_window_usage ?? null,
        stopReason,
        apiMessageId,
      }).catch((err) => this.logger.error(`Token recording failed (${logLabel})`, err instanceof Error ? err.stack : err));
    } else if (!session) {
      this.logger.warn(`Cannot record tokens: session ${sessionId} not found in memory`);
    } else {
      this.logger.warn(`Cannot record tokens for session ${sessionId}: no assistant message ID`);
    }

    return event;
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

    // Enhance context with spawning message ID for background tasks
    const enhancedContext = { ...context };

    // Try to find spawning message for this tool
    const parentKey = context.parentToolUseId
      ? `${context.sessionId}:${context.parentToolUseId}`
      : undefined;
    const directKey = `${context.sessionId}:${context.toolUseId}`;

    enhancedContext.spawningMessageId =
      (parentKey && this.backgroundTaskSpawningMessages.get(parentKey)) ||
      this.backgroundTaskSpawningMessages.get(directKey);

    if (enhancedContext.spawningMessageId) {
      this.logger.debug(
        `[Background Task] Found spawning message ${enhancedContext.spawningMessageId} for tool ${context.toolUseId}`,
      );
    }

    for (const hook of matchingHooks) {
      try {
        await hook.afterToolResult(result, enhancedContext);
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

        // Extract token usage from assistant message (stream-json format)
        if (msg?.usage && (msg.usage.input_tokens > 0 || msg.usage.output_tokens > 0)) {
          events.push(this.handleTokenUsage(
            sessionId, msg.usage, msg.model || 'unknown',
            msg.stop_reason || null, msg.id || null, timestamp, 'assistant',
          ));
        }

        if (msg?.content) {
          for (const block of msg.content) {
            if (block.type === 'text' && block.text) {
              events.push({
                type: 'text_delta',
                sessionId,
                clientId,
                delta: block.text,
                timestamp,
              });
            } else if (block.type === 'tool_use') {
              const toolId = block.id || `tool_${Date.now()}`;
              const toolName = block.name || 'unknown';

              this.toolCallTracker.trackToolCall(toolId, {
                toolId,
                toolName,
                startTime: Date.now(),
                input: block.input || {},
              });

              const agentType = this.toolAnalysis.extractAgentType(sessionId, toolName);
              const decisionLogic = this.toolAnalysis.extractDecisionLogic(toolName, block.input);

              events.push({
                type: 'tool_activity',
                sessionId,
                clientId,
                payload: {
                  toolName,
                  toolId,
                  phase: 'start',
                  description: this.toolAnalysis.getToolDescription(toolName, block.input),
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

              // Track subagent start and emit subagent_started event
              const nestingLevel = agentType === 'main' ? 0 : 1;

              // Track all potentially background tasks
              const isBackgroundTask =
                toolName === 'Task' ||           // Task tool (subagent spawning)
                nestingLevel > 0 ||              // Nested tools (subagent context)
                agentType !== 'main' ||          // Non-main agents
                block.input?.run_in_background === true; // Explicitly marked as background

              this.logger.log(
                `[SubAgent] Tool use detected: toolName=${toolName}, toolUseId=${toolId}, isBackgroundTask=${isBackgroundTask}, nestingLevel=${nestingLevel}, agentType=${agentType}, run_in_background=${block.input?.run_in_background}`,
              );

              if (isBackgroundTask) {
                const description = this.toolAnalysis.getToolDescription(toolName, block.input);
                this.subAgentTracker.trackSubAgentStart(sessionId, toolId, agentType, description, nestingLevel, block.input, toolName);

                // Track spawning message for Task tools
                if (toolName === 'Task') {
                  const key = `${sessionId}:${toolId}`;
                  const spawningMessageId = this.getSpawningMessageId(sessionId);

                  if (spawningMessageId) {
                    this.backgroundTaskSpawningMessages.set(key, spawningMessageId);
                    this.logger.log(
                      `[Background Task] Tracked spawning message: ${spawningMessageId} → Task ${toolId} (session: ${sessionId})`,
                    );
                  }
                }

                events.push({
                  type: 'subagent_started',
                  sessionId,
                  clientId,
                  timestamp,
                  payload: {
                    subAgentId: toolId,
                    agentType: toolName,  // Use toolName for better visibility
                    description,
                    startedAt: new Date().toISOString(),
                    status: 'running',
                    nestingLevel,
                  },
                });
              }

              if (this.toolAnalysis.isExplorationTool(toolName) && agentType !== 'main') {
                events.push({
                  type: 'exploration_activity',
                  sessionId,
                  timestamp,
                  payload: {
                    action: this.toolAnalysis.getExplorationAction(toolName),
                    target: this.toolAnalysis.getExplorationTarget(toolName, block.input),
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
              const toolCall = this.toolCallTracker.findToolCall(toolUseId);
              const duration = toolCall ? Date.now() - toolCall.startTime : 0;
              const toolName = toolCall?.toolName || 'unknown';
              const isError = block.is_error || false;
              const agentType = this.toolAnalysis.extractAgentType(sessionId, toolName);

              // Check if this is a persistent background task
              const tracker = this.subAgentTracker.getSubAgentTracker(sessionId, toolUseId);
              const isPersistent = tracker?.isPersistent && !isError;

              // Only emit tool_activity end event for non-persistent tasks
              // Persistent tasks (run_in_background=true) should not show "Completed"
              // until the actual background operation finishes
              if (!isPersistent) {
                events.push({
                  type: 'tool_activity',
                  sessionId,
                  clientId,
                  payload: {
                    toolName,
                    toolId: toolUseId,
                    phase: 'end',
                    description: `Completed: ${this.toolAnalysis.getToolDescription(toolName, toolCall?.input)}`,
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
              }

              // Emit exploration_activity if applicable
              if (toolCall && this.toolAnalysis.isExplorationTool(toolName) && agentType !== 'main') {
                const resultCount = this.toolAnalysis.getExplorationResultCount(block.content);
                events.push({
                  type: 'exploration_activity',
                  sessionId,
                  timestamp,
                  payload: {
                    action: this.toolAnalysis.getExplorationAction(toolName),
                    target: this.toolAnalysis.getExplorationTarget(toolName, toolCall.input),
                    agentType,
                    phase: 'complete',
                    resultCount,
                    resultSummary: this.toolAnalysis.getExplorationResultSummary(toolName, block.content, resultCount),
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
                const nestingLevel = agentType === 'main' ? 0 : 1;
                const executionOrder = this.getNextExecutionOrder(sessionId);
                const hookResult: ToolResult = {
                  toolName,
                  input: toolCall.input,
                  output: block.content,
                  isError,
                  durationMs: duration,
                  // Enhanced error tracking fields
                  errorMessage: isError ? this.extractErrorMessage(block.content) : undefined,
                  errorType: isError ? classifyToolError(block.content) : undefined,
                  parentToolUseId: this.toolCallTracker.findParentTaskToolId(toolUseId),
                  nestingLevel,
                  executionOrder,
                };
                const hookContext: ToolHookContext = {
                  sessionId,
                  clientId,
                  toolUseId,
                  timestamp,
                  parentToolUseId: this.toolCallTracker.findParentTaskToolId(toolUseId),
                };
                // Fire and forget - hooks should not block event processing
                this.executeToolHooks(toolName, hookResult, hookContext).catch((err) => {
                  this.logger.error(`Tool hook execution failed: ${err}`);
                });

                // Track subagent completion and emit subagent_completed event
                // Match the same conditions as subagent_started
                const isBackgroundTask =
                  toolName === 'Task' ||
                  nestingLevel > 0 ||
                  agentType !== 'main' ||
                  toolCall?.input?.run_in_background === true;

                if (isBackgroundTask) {
                  // 检查是否为持久化后台任务
                  const tracker = this.subAgentTracker.getSubAgentTracker(sessionId, toolUseId);
                  if (tracker?.isPersistent && !isError) {
                    // Task 工具使用 run_in_background，不立即完成
                    // 提取 output_file 路径
                    const resultContent = String(block.content);
                    const outputMatch = resultContent.match(/output_file:\s*(.+?)(\n|$)/);
                    if (outputMatch) {
                      const outputFile = outputMatch[1].trim();
                      this.subAgentTracker.setOutputFile(sessionId, toolUseId, outputFile);
                      this.logger.log(
                        `[SubAgent] Persistent task detected: toolUseId=${toolUseId}, outputFile=${outputFile}`,
                      );
                      // 通知 SessionService 开始监控
                      this.emitBackgroundTaskRegistration(sessionId, tracker);
                      // 不发送 subagent_completed，保持 running 状态
                    } else {
                      this.logger.warn(
                        `[SubAgent] Persistent task missing output_file: toolUseId=${toolUseId}`,
                      );
                    }
                  } else {
                    // 非持久化任务，正常完成流程
                    const completedTracker = this.subAgentTracker.trackSubAgentComplete(
                      sessionId,
                      toolUseId,
                      isError ? 'failed' : 'completed',
                      isError ? this.extractErrorMessage(block.content) : undefined,
                    );

                    if (completedTracker) {
                      const durationMs = Date.now() - completedTracker.startedAt.getTime();
                      events.push({
                        type: 'subagent_completed',
                        sessionId,
                        clientId,
                        timestamp,
                        payload: {
                          subAgentId: toolUseId,
                          status: completedTracker.status,
                          durationMs,
                          error: isError ? this.extractErrorMessage(block.content) : undefined,
                        },
                      });
                    }
                  }
                }

                this.toolCallTracker.untrackToolCall(toolUseId);
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

        // Extract token usage from result event (stream-json format)
        if (result.usage && (result.usage.input_tokens > 0 || result.usage.output_tokens > 0)) {
          events.push(this.handleTokenUsage(
            sessionId, result.usage, result.model || 'unknown',
            null, null, timestamp, 'result',
          ));
        }

        // Emit agent_status complete when result is received
        // This signals the frontend that the response is complete
        // (CLI stays alive with --input-format stream-json, so we can't rely on process exit)
        events.push({
          type: 'agent_status',
          status: 'complete',
          sessionId,
          timestamp,
          context: {
            activeSubAgents: this.getActiveSubAgents(sessionId),
          },
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

          this.toolCallTracker.trackToolCall(toolId, {
            toolId,
            toolName,
            startTime: Date.now(),
            input: block.input || {},
          });

          const agentType = this.toolAnalysis.extractAgentType(sessionId, toolName);
          const decisionLogic = this.toolAnalysis.extractDecisionLogic(toolName, block.input);

          events.push({
            type: 'tool_activity',
            sessionId,
            clientId,
            payload: {
              toolName,
              toolId,
              phase: 'start',
              description: this.toolAnalysis.getToolDescription(toolName, block.input),
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

          // Track subagent start and emit subagent_started event
          const nestingLevel = agentType === 'main' ? 0 : 1;

          // Track all potentially background tasks
          const isBackgroundTask =
            toolName === 'Task' ||           // Task tool (subagent spawning)
            nestingLevel > 0 ||              // Nested tools (subagent context)
            agentType !== 'main' ||          // Non-main agents
            block.input?.run_in_background === true; // Explicitly marked as background

          this.logger.log(
            `[SubAgent] Tool use detected: toolName=${toolName}, toolUseId=${toolId}, isBackgroundTask=${isBackgroundTask}, nestingLevel=${nestingLevel}, agentType=${agentType}, run_in_background=${block.input?.run_in_background}`,
          );

          if (isBackgroundTask) {
            const description = this.toolAnalysis.getToolDescription(toolName, block.input);
            this.subAgentTracker.trackSubAgentStart(sessionId, toolId, agentType, description, nestingLevel, block.input, toolName);

            // Track spawning message for Task tools
            if (toolName === 'Task') {
              const key = `${sessionId}:${toolId}`;
              const spawningMessageId = this.getSpawningMessageId(sessionId);

              if (spawningMessageId) {
                this.backgroundTaskSpawningMessages.set(key, spawningMessageId);
                this.logger.log(
                  `[Background Task] Tracked spawning message: ${spawningMessageId} → Task ${toolId} (session: ${sessionId})`,
                );
              }
            }

            events.push({
              type: 'subagent_started',
              sessionId,
              clientId,
              timestamp,
              payload: {
                subAgentId: toolId,
                agentType: toolName,  // Use toolName for better visibility
                description,
                startedAt: new Date().toISOString(),
                status: 'running',
                nestingLevel,
              },
            });
          }

          if (this.toolAnalysis.isExplorationTool(toolName) && agentType !== 'main') {
            events.push({
              type: 'exploration_activity',
              sessionId,
              timestamp,
              payload: {
                action: this.toolAnalysis.getExplorationAction(toolName),
                target: this.toolAnalysis.getExplorationTarget(toolName, block.input),
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
            delta: cliEvent.delta.text,
            timestamp,
          });
        }
        break;

      case 'content_block_stop':
        break;

      case 'tool_result': {
        const toolResult = cliEvent.tool_result;
        if (!toolResult) break;

        const toolCall = this.toolCallTracker.findToolCall(toolResult.tool_use_id);
        const duration = toolCall ? Date.now() - toolCall.startTime : 0;
        const toolName = toolCall?.toolName || 'unknown';
        const agentType = this.toolAnalysis.extractAgentType(sessionId, toolName);

        events.push({
          type: 'tool_activity',
          sessionId,
          clientId,
          payload: {
            toolName,
            toolId: toolResult.tool_use_id,
            phase: 'end',
            description: `Completed: ${this.toolAnalysis.getToolDescription(toolName, toolCall?.input)}`,
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

        if (toolCall && this.toolAnalysis.isExplorationTool(toolName) && agentType !== 'main') {
          const resultCount = this.toolAnalysis.getExplorationResultCount(toolResult.content);
          events.push({
            type: 'exploration_activity',
            sessionId,
            timestamp,
            payload: {
              action: this.toolAnalysis.getExplorationAction(toolName),
              target: this.toolAnalysis.getExplorationTarget(toolName, toolCall.input),
              agentType,
              phase: 'complete',
              resultCount,
              resultSummary: this.toolAnalysis.getExplorationResultSummary(toolName, toolResult.content, resultCount),
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
          const isError = toolResult.is_error || false;
          const nestingLevel = agentType === 'main' ? 0 : 1;
          const executionOrder = this.getNextExecutionOrder(sessionId);
          const hookResult: ToolResult = {
            toolName,
            input: toolCall.input,
            output: toolResult.content,
            isError,
            durationMs: duration,
            // Enhanced error tracking fields
            errorMessage: isError ? this.extractErrorMessage(toolResult.content) : undefined,
            errorType: isError ? classifyToolError(toolResult.content) : undefined,
            parentToolUseId: this.toolCallTracker.findParentTaskToolId(toolResult.tool_use_id),
            nestingLevel,
            executionOrder,
          };
          const hookContext: ToolHookContext = {
            sessionId,
            clientId,
            toolUseId: toolResult.tool_use_id,
            timestamp,
            parentToolUseId: this.toolCallTracker.findParentTaskToolId(toolResult.tool_use_id),
          };
          // Fire and forget - hooks should not block event processing
          this.executeToolHooks(toolName, hookResult, hookContext).catch((err) => {
            this.logger.error(`Tool hook execution failed: ${err}`);
          });

          this.toolCallTracker.untrackToolCall(toolResult.tool_use_id);
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

        if (!usage) {
          // finish-step should always carry usage; message_delta content-only variants may not
          if (cliEvent.type === 'finish-step') {
            this.logger.warn(
              `Token event 'finish-step' received without usage data for session ${sessionId}`,
            );
          }
          break;
        }

        const accumulator = this.getTokenAccumulator(sessionId);
        this.accumulateTokens(accumulator, {
          inputTokens: usage.input_tokens || 0,
          outputTokens: usage.output_tokens || 0,
          cachedTokens: usage.cache_read_input_tokens || 0,
        });

        const model = usageEvent.model || usageEvent.message?.model || 'unknown';
        const stopReason = usageEvent.finish_reason || usageEvent.stop_reason || null;
        const apiMessageId = usageEvent.id || usageEvent.message?.id || null;

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

        // Inline token persistence — no callback indirection needed
        const session = this.sessionGetter?.(sessionId);
        if (session?.currentAssistantMessageId) {
          this.tokenUsageService.recordUsage({
            messageId: session.currentAssistantMessageId,
            sessionId,
            tenantId: session.tenantId ?? null,
            model,
            inputTokens: usage.input_tokens || 0,
            outputTokens: usage.output_tokens || 0,
            cachedInputTokens: usage.cache_read_input_tokens || 0,
            cacheReadTokens: usage.cache_read_input_tokens || 0,
            cacheCreationTokens: usage.cache_creation_input_tokens || 0,
            reasoningTokens: usage.reasoning_tokens || 0,
            contextWindowUsage: usage.context_window_usage ?? null,
            stopReason,
            apiMessageId,
          }).catch((err) => this.logger.error('Token recording failed', err instanceof Error ? err.stack : err));
        } else if (!session) {
          this.logger.warn(`Cannot record tokens: session ${sessionId} not found in memory`);
        } else {
          this.logger.warn(`Cannot record tokens for session ${sessionId}: no assistant message ID`);
        }
        break;
      }

      default:
        // Always log unhandled events to help diagnose missing data carriers
        this.logger.warn(`Unhandled CLI event type: ${cliEvent.type} | keys: ${Object.keys(cliEvent).join(',')}`);
    }

    return events;
  }

  /**
   * Clear session state (on session cleanup)
   */
  clearSessionState(sessionId: string): void {
    // Delegate to service cleanup
    this.toolCallTracker.clearSessionState(sessionId);
    this.subAgentTracker.clearSessionState(sessionId);

    // Clear local state
    this.sessionTokenAccumulators.delete(sessionId);
    this.activeThinkingBlocks.delete(sessionId);
    this.sessionExecutionCounters.delete(sessionId);

    // Clean up background task tracking for this session
    // Remove all entries with this sessionId prefix
    const keysToDelete: string[] = [];
    for (const key of this.backgroundTaskSpawningMessages.keys()) {
      if (key.startsWith(`${sessionId}:`)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.backgroundTaskSpawningMessages.delete(key);
    }

    if (keysToDelete.length > 0) {
      this.logger.debug(
        `Cleaned up ${keysToDelete.length} background task tracking entries for session ${sessionId}`,
      );
    }
  }

  // =========================================================================
  // Private Helper Methods
  // =========================================================================

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
    } else if (Array.isArray(result)) {
      // MCP tool results come as content block arrays: [{ type: 'text', text: '...' }]
      const textBlock = result.find(
        (b: any) => b.type === 'text' && typeof b.text === 'string',
      );
      if (textBlock) {
        try {
          parsedResult = JSON.parse(textBlock.text);
        } catch {
          parsedResult = { raw: textBlock.text };
        }
      }
    } else if (typeof result === 'object' && result !== null) {
      parsedResult = result as Record<string, unknown>;
    }

    const buildOutputUpdate = (): FrontendEvent => ({
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

    switch (normalizedName) {
      case 'write_output':
      case 'attach_file':
        events.push(buildOutputUpdate());
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

    // Check tenant-configured toolEventTriggers (from solution.json mcpServers).
    // Skip tools already handled by the switch above to avoid duplicate events.
    const session = this.sessionGetter?.(sessionId);
    if (session?.tenantId && !EventMapperService.TRIGGER_HANDLED_TOOLS.has(normalizedName)) {
      const triggers = this.tenantToolTriggers.get(session.tenantId) ?? [];
      for (const trigger of triggers) {
        if (trigger.toolName !== normalizedName) continue;
        // Forward-compatible: when new eventTypes are added, only matching ones fire
        if (trigger.eventType === 'output_update') {
          events.push(buildOutputUpdate());
        }
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

  /**
   * Extract error message from tool output
   */
  private extractErrorMessage(content: unknown): string | undefined {
    if (typeof content === 'string') {
      // Truncate very long error messages
      return content.length > 2000 ? content.slice(0, 2000) + '...' : content;
    }
    if (typeof content === 'object' && content !== null) {
      // Try to extract error message from object
      const obj = content as Record<string, unknown>;
      if (typeof obj.error === 'string') return obj.error;
      if (typeof obj.message === 'string') return obj.message;
      // Fallback to JSON stringification
      const json = JSON.stringify(content);
      return json.length > 2000 ? json.slice(0, 2000) + '...' : json;
    }
    return undefined;
  }

  /**
   * Track Task tool start for parent-child relationship
   */
  trackTaskToolStart(sessionId: string, toolUseId: string): void {
    this.toolCallTracker.trackTaskToolStart(sessionId, toolUseId);
  }

  /**
   * Clear Task tool tracking on completion
   */
  clearTaskToolTracking(sessionId: string): void {
    this.toolCallTracker.clearTaskToolTracking(sessionId);
  }

  /**
   * Get the next execution order for a session
   */
  private getNextExecutionOrder(sessionId: string): number {
    const current = this.sessionExecutionCounters.get(sessionId) || 0;
    const next = current + 1;
    this.sessionExecutionCounters.set(sessionId, next);
    return next;
  }

  /**
   * Reset execution order counter for a session
   * Should be called when a new message starts
   */
  resetExecutionOrder(sessionId: string): void {
    this.sessionExecutionCounters.delete(sessionId);
  }

  /**
   * Get active sub-agents for a session
   */
  public getActiveSubAgents(sessionId: string): Array<{
    subAgentId: string;
    agentType: string;
    description?: string;
    startedAt: string;
    status: 'running' | 'completed' | 'failed';
    nestingLevel?: number;
  }> {
    return this.subAgentTracker.getActiveSubAgents(sessionId);
  }

  /**
   * Register callback for background task registration
   */
  registerBackgroundTaskCallback(callback: (sessionId: string, tracker: SubAgentTracker) => void): void {
    this.backgroundTaskCallbacks.push(callback);
  }

  /**
   * Get the spawning message ID for a session
   * This is the message ID at the time a background task is created
   */
  private getSpawningMessageId(sessionId: string): string | undefined {
    // The spawning message is the one currently being processed
    return this.sessionGetter?.(sessionId)?.currentAssistantMessageId;
  }

  /**
   * Get spawning message ID for a tool use ID
   * Used for background task file tracking
   */
  private getSpawningMessageForTool(sessionId: string, toolUseId: string): string | undefined {
    const key = `${sessionId}:${toolUseId}`;
    return this.backgroundTaskSpawningMessages.get(key);
  }

  /**
   * Emit background task registration event
   */
  private emitBackgroundTaskRegistration(sessionId: string, tracker: SubAgentTracker): void {
    for (const callback of this.backgroundTaskCallbacks) {
      try {
        callback(sessionId, tracker);
      } catch (error) {
        this.logger.error(`Background task callback error: ${error}`);
      }
    }
  }

  /**
   * Mark background task as complete (called by SessionService)
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
    return this.subAgentTracker.markBackgroundTaskComplete(sessionId, subAgentId, status, error);
  }
}
