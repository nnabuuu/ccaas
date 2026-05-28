/**
 * EventMapperService Unit Tests
 *
 * Tests the mapping of CLI events to frontend events, with focus on
 * CLI tool result format handling (type: 'user' with tool_result content blocks).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventMapperService } from './event-mapper.service';
import { ToolCallTrackerService } from './services/tool-call-tracker.service';
import { SubAgentTrackerService } from './services/subagent-tracker.service';
import { ToolAnalysisService } from './services/tool-analysis.service';
import { TokenUsageService } from '../messages/token-usage.service';
import type { ToolHook, ToolResult, ToolHookContext } from '../hooks';
import {
  createToolUseStartEvent,
  createCliToolResultEvent,
  cliWriteToolResultEvent,
  cliReadToolResultEvent,
  cliErrorToolResultEvent,
  cliMultipleToolResultsEvent,
  writeToolCallEvent,
  readToolCallEvent,
  taskToolCallEvent,
} from '../../test/setup/cli-event-fixtures';

describe('EventMapperService', () => {
  let service: EventMapperService;
  let mockTokenUsageService: { recordUsage: jest.Mock };

  const testSessionId = 'test-session-123';
  const testClientId = 'test-client';

  beforeEach(async () => {
    mockTokenUsageService = { recordUsage: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({ debug: false })],
        }),
      ],
      providers: [
        EventMapperService,
        ToolCallTrackerService,
        SubAgentTrackerService,
        ToolAnalysisService,
        {
          provide: TokenUsageService,
          useValue: mockTokenUsageService,
        },
        // EventEmitter2 stub — the new turn-complete emit needs it.
        // Tests don't assert on emissions; we just need DI to resolve.
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<EventMapperService>(EventMapperService);
  });

  afterEach(() => {
    // Clear session state between tests
    service.clearSessionState(testSessionId);
  });

  describe('mapToSessionEvents', () => {
    describe('CLI user message with tool_result', () => {
      it('should emit tool_activity end event for CLI format', () => {
        // First, emit tool start to register the tool call
        service.mapToSessionEvents(writeToolCallEvent as any, testSessionId, testClientId);

        // Then emit CLI format tool result
        const events = service.mapToSessionEvents(
          cliWriteToolResultEvent as any,
          testSessionId,
          testClientId,
        );

        const endEvent = events.find(
          (e) => e.type === 'tool_activity' && (e as any).payload?.phase === 'end',
        );

        expect(endEvent).toBeDefined();
        expect((endEvent as any).payload.toolName).toBe('Write');
        expect((endEvent as any).payload.toolId).toBe('toolu_write_123');
        expect((endEvent as any).payload.phase).toBe('end');
      });

      it('should set success: true when is_error is false or undefined', () => {
        // Register tool call
        service.mapToSessionEvents(writeToolCallEvent as any, testSessionId, testClientId);

        // Emit CLI format result (no is_error = success)
        const events = service.mapToSessionEvents(
          cliWriteToolResultEvent as any,
          testSessionId,
          testClientId,
        );

        const endEvent = events.find(
          (e) => e.type === 'tool_activity' && (e as any).payload?.phase === 'end',
        );

        expect(endEvent).toBeDefined();
        expect((endEvent as any).payload.success).toBe(true);
      });

      it('should set success: false when is_error is true', () => {
        // Register tool call for the error case
        service.mapToSessionEvents(
          {
            type: 'content_block_start',
            content_block: {
              type: 'tool_use',
              id: 'toolu_error_cli',
              name: 'Bash',
              input: { command: 'nonexistent-command' },
            },
          } as any,
          testSessionId,
          testClientId,
        );

        // Emit CLI format error result
        const events = service.mapToSessionEvents(
          cliErrorToolResultEvent as any,
          testSessionId,
          testClientId,
        );

        const endEvent = events.find(
          (e) => e.type === 'tool_activity' && (e as any).payload?.phase === 'end',
        );

        expect(endEvent).toBeDefined();
        expect((endEvent as any).payload.success).toBe(false);
        expect((endEvent as any).payload.toolError).toBeDefined();
      });

      it('should include toolOutput in payload', () => {
        // Register tool call
        service.mapToSessionEvents(readToolCallEvent as any, testSessionId, testClientId);

        // Emit CLI format result with content
        const events = service.mapToSessionEvents(
          cliReadToolResultEvent as any,
          testSessionId,
          testClientId,
        );

        const endEvent = events.find(
          (e) => e.type === 'tool_activity' && (e as any).payload?.phase === 'end',
        );

        expect(endEvent).toBeDefined();
        expect((endEvent as any).payload.toolOutput).toBe('Test content from Claude');
      });

      it('should call registered tool hooks', async () => {
        const hookResults: ToolResult[] = [];

        // Create a mock hook
        const mockHook: ToolHook = {
          tool: 'Write',
          afterToolResult: async (result: ToolResult, context: ToolHookContext) => {
            hookResults.push(result);
          },
        };

        service.registerToolHook(mockHook);

        // Register tool call
        service.mapToSessionEvents(writeToolCallEvent as any, testSessionId, testClientId);

        // Emit CLI format result
        service.mapToSessionEvents(
          cliWriteToolResultEvent as any,
          testSessionId,
          testClientId,
        );

        // Wait for async hook execution
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(hookResults.length).toBe(1);
        expect(hookResults[0].toolName).toBe('Write');
        expect(hookResults[0].output).toBe('File written successfully');
        expect(hookResults[0].isError).toBe(false);
      });

      it('should emit exploration_activity for exploration tools', () => {
        // Register Glob tool call with sub-agent session ID
        const subAgentSessionId = 'session_Explore_123';
        service.mapToSessionEvents(
          {
            type: 'content_block_start',
            content_block: {
              type: 'tool_use',
              id: 'toolu_glob_explore',
              name: 'Glob',
              input: { pattern: '**/*.ts' },
            },
          } as any,
          subAgentSessionId,
          testClientId,
        );

        // Emit CLI format result
        const events = service.mapToSessionEvents(
          createCliToolResultEvent('toolu_glob_explore', ['file1.ts', 'file2.ts']) as any,
          subAgentSessionId,
          testClientId,
        );

        const explorationEvent = events.find((e) => e.type === 'exploration_activity');

        expect(explorationEvent).toBeDefined();
        expect((explorationEvent as any).payload.action).toBe('glob');
        expect((explorationEvent as any).payload.phase).toBe('complete');
      });

      it('should handle multiple tool_result blocks in one message', () => {
        // Register two tool calls
        service.mapToSessionEvents(
          {
            type: 'content_block_start',
            content_block: {
              type: 'tool_use',
              id: 'toolu_multi_1',
              name: 'Read',
              input: { file_path: 'file1.txt' },
            },
          } as any,
          testSessionId,
          testClientId,
        );

        service.mapToSessionEvents(
          {
            type: 'content_block_start',
            content_block: {
              type: 'tool_use',
              id: 'toolu_multi_2',
              name: 'Read',
              input: { file_path: 'file2.txt' },
            },
          } as any,
          testSessionId,
          testClientId,
        );

        // Emit CLI format with multiple results
        const events = service.mapToSessionEvents(
          cliMultipleToolResultsEvent as any,
          testSessionId,
          testClientId,
        );

        // Should have 2 tool_activity end events
        const endEvents = events.filter(
          (e) => e.type === 'tool_activity' && (e as any).payload?.phase === 'end',
        );

        expect(endEvents.length).toBe(2);
        expect(endEvents.map((e) => (e as any).payload.toolId).sort()).toEqual([
          'toolu_multi_1',
          'toolu_multi_2',
        ]);
      });

      it('should handle missing tool call gracefully (unknown tool)', () => {
        // Emit CLI format result without registering the tool call first
        const events = service.mapToSessionEvents(
          {
            type: 'user',
            message: {
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: 'toolu_unknown_xyz',
                  content: 'Some result',
                },
              ],
            },
          } as any,
          testSessionId,
          testClientId,
        );

        // Should still emit an end event, but with 'unknown' tool
        const endEvent = events.find(
          (e) => e.type === 'tool_activity' && (e as any).payload?.phase === 'end',
        );

        expect(endEvent).toBeDefined();
        expect((endEvent as any).payload.toolName).toBe('unknown');
        expect((endEvent as any).payload.toolId).toBe('toolu_unknown_xyz');
      });

      it('should include duration in tool_activity end event', async () => {
        // Register tool call
        service.mapToSessionEvents(writeToolCallEvent as any, testSessionId, testClientId);

        // Wait a bit to create measurable duration
        await new Promise((resolve) => setTimeout(resolve, 20));

        // Emit CLI format result
        const events = service.mapToSessionEvents(
          cliWriteToolResultEvent as any,
          testSessionId,
          testClientId,
        );

        const endEvent = events.find(
          (e) => e.type === 'tool_activity' && (e as any).payload?.phase === 'end',
        );

        expect(endEvent).toBeDefined();
        expect((endEvent as any).payload.duration).toBeGreaterThanOrEqual(0);
      });

      it('should preserve toolInput from start event', () => {
        // Register tool call with specific input
        service.mapToSessionEvents(writeToolCallEvent as any, testSessionId, testClientId);

        // Emit CLI format result
        const events = service.mapToSessionEvents(
          cliWriteToolResultEvent as any,
          testSessionId,
          testClientId,
        );

        const endEvent = events.find(
          (e) => e.type === 'tool_activity' && (e as any).payload?.phase === 'end',
        );

        expect(endEvent).toBeDefined();
        expect((endEvent as any).payload.toolInput).toEqual({
          file_path: 'hello.txt',
          content: 'Hello World!',
        });
      });

      it('should clean up tool call after result is processed', () => {
        // Register tool call
        service.mapToSessionEvents(writeToolCallEvent as any, testSessionId, testClientId);

        // Emit CLI format result
        service.mapToSessionEvents(
          cliWriteToolResultEvent as any,
          testSessionId,
          testClientId,
        );

        // Emit the same tool result again - should not find the tool call
        const events = service.mapToSessionEvents(
          cliWriteToolResultEvent as any,
          testSessionId,
          testClientId,
        );

        const endEvent = events.find(
          (e) => e.type === 'tool_activity' && (e as any).payload?.phase === 'end',
        );

        // Tool should be unknown since it was cleaned up
        expect(endEvent).toBeDefined();
        expect((endEvent as any).payload.toolName).toBe('unknown');
      });
    });

    describe('wildcard tool hooks', () => {
      it('should execute wildcard hooks for all tools', async () => {
        const hookCalls: string[] = [];

        // Register wildcard hook
        const wildcardHook: ToolHook = {
          tool: '*',
          afterToolResult: async (result: ToolResult) => {
            hookCalls.push(result.toolName);
          },
        };

        service.registerToolHook(wildcardHook);

        // Test with Write tool
        service.mapToSessionEvents(writeToolCallEvent as any, testSessionId, testClientId);
        service.mapToSessionEvents(
          cliWriteToolResultEvent as any,
          testSessionId,
          testClientId,
        );

        // Test with Read tool
        service.mapToSessionEvents(readToolCallEvent as any, testSessionId, testClientId);
        service.mapToSessionEvents(
          cliReadToolResultEvent as any,
          testSessionId,
          testClientId,
        );

        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(hookCalls).toContain('Write');
        expect(hookCalls).toContain('Read');
      });
    });

    describe('persistent background tasks', () => {
      it('should NOT emit tool_activity:end for persistent background tasks', () => {
        // Register Task tool with run_in_background=true
        const persistentTaskCall = {
          type: 'content_block_start',
          content_block: {
            type: 'tool_use',
            id: 'toolu_task_persistent',
            name: 'Task',
            input: {
              description: 'Generate PDF',
              prompt: 'Create lesson plan PDF',
              subagent_type: 'notebooklm',
              run_in_background: true,
            },
          },
        };

        service.mapToSessionEvents(persistentTaskCall as any, testSessionId, testClientId);

        // Emit CLI format result with output_file
        const persistentTaskResult = {
          type: 'user',
          message: {
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'toolu_task_persistent',
                content: 'Task started in background\noutput_file: /tmp/task_output.txt\n',
                is_error: false,
              },
            ],
          },
        };

        const events = service.mapToSessionEvents(
          persistentTaskResult as any,
          testSessionId,
          testClientId,
        );

        // Should NOT have tool_activity:end event
        const endEvent = events.find(
          (e) => e.type === 'tool_activity' && (e as any).payload?.phase === 'end',
        );

        expect(endEvent).toBeUndefined();

        // Should NOT have subagent_completed event (task still running)
        const completedEvent = events.find((e) => e.type === 'subagent_completed');
        expect(completedEvent).toBeUndefined();
      });

      it('should emit tool_activity:end for non-persistent Task tools', () => {
        // Register Task tool WITHOUT run_in_background
        const normalTaskCall = {
          type: 'content_block_start',
          content_block: {
            type: 'tool_use',
            id: 'toolu_task_normal',
            name: 'Task',
            input: {
              description: 'Quick search',
              prompt: 'Find TypeScript files',
              subagent_type: 'Explore',
              // run_in_background is NOT set
            },
          },
        };

        service.mapToSessionEvents(normalTaskCall as any, testSessionId, testClientId);

        // Emit CLI format result
        const normalTaskResult = {
          type: 'user',
          message: {
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'toolu_task_normal',
                content: 'Search completed: Found 15 files',
                is_error: false,
              },
            ],
          },
        };

        const events = service.mapToSessionEvents(
          normalTaskResult as any,
          testSessionId,
          testClientId,
        );

        // SHOULD have tool_activity:end event
        const endEvent = events.find(
          (e) => e.type === 'tool_activity' && (e as any).payload?.phase === 'end',
        );

        expect(endEvent).toBeDefined();
        expect((endEvent as any).payload.toolName).toBe('Task');
        expect((endEvent as any).payload.success).toBe(true);
      });

      it('should emit tool_activity:end for persistent tasks that error', () => {
        // Register Task tool with run_in_background=true
        const persistentTaskCall = {
          type: 'content_block_start',
          content_block: {
            type: 'tool_use',
            id: 'toolu_task_error',
            name: 'Task',
            input: {
              description: 'Generate PDF',
              prompt: 'Create lesson plan PDF',
              subagent_type: 'notebooklm',
              run_in_background: true,
            },
          },
        };

        service.mapToSessionEvents(persistentTaskCall as any, testSessionId, testClientId);

        // Emit CLI format error result
        const errorResult = {
          type: 'user',
          message: {
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'toolu_task_error',
                content: 'Error: Failed to spawn agent',
                is_error: true,
              },
            ],
          },
        };

        const events = service.mapToSessionEvents(
          errorResult as any,
          testSessionId,
          testClientId,
        );

        // SHOULD have tool_activity:end event when there's an error
        const endEvent = events.find(
          (e) => e.type === 'tool_activity' && (e as any).payload?.phase === 'end',
        );

        expect(endEvent).toBeDefined();
        expect((endEvent as any).payload.success).toBe(false);
        expect((endEvent as any).payload.toolError).toBeDefined();
      });

      it('should emit tool_activity:end for regular tools regardless of background flag', () => {
        // Register Bash tool (not Task)
        const bashCall = {
          type: 'content_block_start',
          content_block: {
            type: 'tool_use',
            id: 'toolu_bash_regular',
            name: 'Bash',
            input: {
              command: 'npm test',
              run_in_background: true, // Even with this flag
            },
          },
        };

        service.mapToSessionEvents(bashCall as any, testSessionId, testClientId);

        // Emit CLI format result
        const bashResult = {
          type: 'user',
          message: {
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'toolu_bash_regular',
                content: 'Tests passed',
                is_error: false,
              },
            ],
          },
        };

        const events = service.mapToSessionEvents(
          bashResult as any,
          testSessionId,
          testClientId,
        );

        // SHOULD have tool_activity:end event (only Task tool respects run_in_background)
        const endEvent = events.find(
          (e) => e.type === 'tool_activity' && (e as any).payload?.phase === 'end',
        );

        expect(endEvent).toBeDefined();
        expect((endEvent as any).payload.toolName).toBe('Bash');
      });
    });

    describe('comparison with tool_result format', () => {
      it('should produce equivalent events for CLI format and tool_result format', () => {
        // Test CLI format
        service.mapToSessionEvents(writeToolCallEvent as any, testSessionId, testClientId);
        const cliEvents = service.mapToSessionEvents(
          cliWriteToolResultEvent as any,
          testSessionId,
          testClientId,
        );

        // Clear and test tool_result format
        service.clearSessionState(testSessionId);
        service.mapToSessionEvents(writeToolCallEvent as any, testSessionId, testClientId);
        const toolResultEvents = service.mapToSessionEvents(
          {
            type: 'tool_result',
            tool_result: {
              tool_use_id: 'toolu_write_123',
              content: 'File written successfully',
              is_error: false,
            },
          } as any,
          testSessionId,
          testClientId,
        );

        // Both should produce tool_activity end event
        const cliEndEvent = cliEvents.find(
          (e) => e.type === 'tool_activity' && (e as any).payload?.phase === 'end',
        );
        const toolResultEndEvent = toolResultEvents.find(
          (e) => e.type === 'tool_activity' && (e as any).payload?.phase === 'end',
        );

        expect(cliEndEvent).toBeDefined();
        expect(toolResultEndEvent).toBeDefined();

        // Compare key fields
        expect((cliEndEvent as any).payload.toolName).toBe(
          (toolResultEndEvent as any).payload.toolName,
        );
        expect((cliEndEvent as any).payload.success).toBe(
          (toolResultEndEvent as any).payload.success,
        );
        expect((cliEndEvent as any).payload.toolOutput).toBe(
          (toolResultEndEvent as any).payload.toolOutput,
        );
      });
    });

    describe('execution order tracking', () => {
      it('should assign sequential executionOrder starting from 1', async () => {
        const hookResults: ToolResult[] = [];

        const mockHook: ToolHook = {
          tool: '*',
          afterToolResult: async (result: ToolResult) => {
            hookResults.push(result);
          },
        };

        service.registerToolHook(mockHook);

        // First tool
        service.mapToSessionEvents(writeToolCallEvent as any, testSessionId, testClientId);
        service.mapToSessionEvents(cliWriteToolResultEvent as any, testSessionId, testClientId);

        await new Promise((resolve) => setTimeout(resolve, 30));

        expect(hookResults[0].executionOrder).toBe(1);
      });

      it('should increment executionOrder for each tool in sequence', async () => {
        const hookResults: ToolResult[] = [];

        const mockHook: ToolHook = {
          tool: '*',
          afterToolResult: async (result: ToolResult) => {
            hookResults.push(result);
          },
        };

        service.registerToolHook(mockHook);

        // First tool
        service.mapToSessionEvents(writeToolCallEvent as any, testSessionId, testClientId);
        service.mapToSessionEvents(cliWriteToolResultEvent as any, testSessionId, testClientId);

        // Second tool
        service.mapToSessionEvents(readToolCallEvent as any, testSessionId, testClientId);
        service.mapToSessionEvents(cliReadToolResultEvent as any, testSessionId, testClientId);

        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(hookResults).toHaveLength(2);
        expect(hookResults[0].executionOrder).toBe(1);
        expect(hookResults[1].executionOrder).toBe(2);
      });

      it('should reset executionOrder when resetExecutionOrder() is called', async () => {
        const hookResults: ToolResult[] = [];

        const mockHook: ToolHook = {
          tool: '*',
          afterToolResult: async (result: ToolResult) => {
            hookResults.push(result);
          },
        };

        service.registerToolHook(mockHook);

        // First tool gets order 1
        service.mapToSessionEvents(writeToolCallEvent as any, testSessionId, testClientId);
        service.mapToSessionEvents(cliWriteToolResultEvent as any, testSessionId, testClientId);

        // Reset the execution order
        service.resetExecutionOrder(testSessionId);

        // Next tool should start at 1 again
        service.mapToSessionEvents(readToolCallEvent as any, testSessionId, testClientId);
        service.mapToSessionEvents(cliReadToolResultEvent as any, testSessionId, testClientId);

        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(hookResults).toHaveLength(2);
        expect(hookResults[0].executionOrder).toBe(1);
        expect(hookResults[1].executionOrder).toBe(1); // Reset to 1
      });

      it('should track executionOrder independently per session', async () => {
        const hookResults: ToolResult[] = [];

        const mockHook: ToolHook = {
          tool: '*',
          afterToolResult: async (result: ToolResult, context: ToolHookContext) => {
            hookResults.push({ ...result, toolName: `${context.sessionId}:${result.toolName}` });
          },
        };

        service.registerToolHook(mockHook);

        const session1 = 'session-1';
        const session2 = 'session-2';

        // Tool in session 1
        service.mapToSessionEvents(writeToolCallEvent as any, session1, testClientId);
        service.mapToSessionEvents(cliWriteToolResultEvent as any, session1, testClientId);

        // Tool in session 2
        service.mapToSessionEvents(readToolCallEvent as any, session2, testClientId);
        service.mapToSessionEvents(cliReadToolResultEvent as any, session2, testClientId);

        // Another tool in session 1
        service.mapToSessionEvents(readToolCallEvent as any, session1, testClientId);
        service.mapToSessionEvents(cliReadToolResultEvent as any, session1, testClientId);

        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(hookResults).toHaveLength(3);

        const session1Results = hookResults.filter((r) => r.toolName.startsWith('session-1:'));
        const session2Results = hookResults.filter((r) => r.toolName.startsWith('session-2:'));

        expect(session1Results[0].executionOrder).toBe(1);
        expect(session1Results[1].executionOrder).toBe(2);
        expect(session2Results[0].executionOrder).toBe(1); // Independent counter

        // Cleanup
        service.clearSessionState(session1);
        service.clearSessionState(session2);
      });

      it('should clear execution counter in clearSessionState', async () => {
        const hookResults: ToolResult[] = [];

        const mockHook: ToolHook = {
          tool: '*',
          afterToolResult: async (result: ToolResult) => {
            hookResults.push(result);
          },
        };

        service.registerToolHook(mockHook);

        // First tool gets order 1
        service.mapToSessionEvents(writeToolCallEvent as any, testSessionId, testClientId);
        service.mapToSessionEvents(cliWriteToolResultEvent as any, testSessionId, testClientId);

        // Clear session state (simulates session cleanup)
        service.clearSessionState(testSessionId);

        // Next tool should start at 1 again
        service.mapToSessionEvents(readToolCallEvent as any, testSessionId, testClientId);
        service.mapToSessionEvents(cliReadToolResultEvent as any, testSessionId, testClientId);

        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(hookResults).toHaveLength(2);
        expect(hookResults[0].executionOrder).toBe(1);
        expect(hookResults[1].executionOrder).toBe(1); // Reset after clearSessionState
      });
    });

    describe('error type classification', () => {
      it('should classify file not found errors', async () => {
        const hookResults: ToolResult[] = [];

        const mockHook: ToolHook = {
          tool: '*',
          afterToolResult: async (result: ToolResult) => {
            hookResults.push(result);
          },
        };

        service.registerToolHook(mockHook);

        // Register tool and emit error result
        service.mapToSessionEvents(
          {
            type: 'content_block_start',
            content_block: {
              type: 'tool_use',
              id: 'toolu_enoent_test',
              name: 'Read',
              input: { file_path: '/nonexistent.txt' },
            },
          } as any,
          testSessionId,
          testClientId,
        );

        service.mapToSessionEvents(
          {
            type: 'user',
            message: {
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: 'toolu_enoent_test',
                  content: 'Error: ENOENT: no such file or directory',
                  is_error: true,
                },
              ],
            },
          } as any,
          testSessionId,
          testClientId,
        );

        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(hookResults[0].isError).toBe(true);
        expect(hookResults[0].errorType).toBe('file_not_found');
        expect(hookResults[0].errorMessage).toContain('ENOENT');
      });

      it('should not set errorType for successful tools', async () => {
        const hookResults: ToolResult[] = [];

        const mockHook: ToolHook = {
          tool: '*',
          afterToolResult: async (result: ToolResult) => {
            hookResults.push(result);
          },
        };

        service.registerToolHook(mockHook);

        service.mapToSessionEvents(writeToolCallEvent as any, testSessionId, testClientId);
        service.mapToSessionEvents(cliWriteToolResultEvent as any, testSessionId, testClientId);

        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(hookResults[0].isError).toBe(false);
        expect(hookResults[0].errorType).toBeUndefined();
      });
    });

    describe('token usage recording', () => {
      const finishStepWithUsage = {
        type: 'finish-step',
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_read_input_tokens: 10,
          cache_creation_input_tokens: 5,
          reasoning_tokens: 0,
        },
        model: 'claude-sonnet-4-6',
        stop_reason: 'end_turn',
        id: 'msg_abc123',
      };

      const messageDeltaWithUsage = {
        type: 'message_delta',
        message: {
          usage: {
            input_tokens: 80,
            output_tokens: 30,
            cache_read_input_tokens: 0,
            cache_creation_input_tokens: 0,
            reasoning_tokens: 0,
          },
          model: 'claude-haiku-4-5',
          id: 'msg_def456',
        },
        stop_reason: 'end_turn',
      };

      const makeSession = (opts: { messageId?: string; solutionId?: string } = {}) => ({
        sessionId: testSessionId,
        clientId: 'test-client',
        cliProcess: null,
        stdin: null,
        socket: null,
        lastActivity: new Date(),
        status: 'idle' as const,
        createdAt: new Date(),
        messageCount: 0,
        buffer: '',
        workspaceDir: '/tmp/test',
        currentAssistantMessageId: opts.messageId,
        solutionId: opts.solutionId,
      });

      // flush microtask queue (recordUsage is fire-and-forget)
      const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

      it('should call recordUsage for finish-step with usage and session context', async () => {
        service.registerSessionGetter(() => makeSession({ messageId: 'msg-001', solutionId: 'tenant-1' }));

        service.mapToSessionEvents(finishStepWithUsage as any, testSessionId, testClientId);
        await flush();

        expect(mockTokenUsageService.recordUsage).toHaveBeenCalledTimes(1);
        expect(mockTokenUsageService.recordUsage).toHaveBeenCalledWith(
          expect.objectContaining({
            messageId: 'msg-001',
            sessionId: testSessionId,
            solutionId: 'tenant-1',
            model: 'claude-sonnet-4-6',
            inputTokens: 100,
            outputTokens: 50,
            cachedInputTokens: 10,
            cacheCreationTokens: 5,
            stopReason: 'end_turn',
            apiMessageId: 'msg_abc123',
          }),
        );
      });

      it('should call recordUsage for message_delta with usage and session context', async () => {
        service.registerSessionGetter(() => makeSession({ messageId: 'msg-002', solutionId: 'tenant-1' }));

        service.mapToSessionEvents(messageDeltaWithUsage as any, testSessionId, testClientId);
        await flush();

        expect(mockTokenUsageService.recordUsage).toHaveBeenCalledTimes(1);
        expect(mockTokenUsageService.recordUsage).toHaveBeenCalledWith(
          expect.objectContaining({
            messageId: 'msg-002',
            inputTokens: 80,
            outputTokens: 30,
            model: 'claude-haiku-4-5',
          }),
        );
      });

      it('should emit a token_usage frontend event with accumulated totals', () => {
        service.registerSessionGetter(() => makeSession({ messageId: 'msg-003' }));

        const events = service.mapToSessionEvents(finishStepWithUsage as any, testSessionId, testClientId);

        const tokenEvent = events.find((e) => e.type === 'token_usage');
        expect(tokenEvent).toBeDefined();
        expect((tokenEvent as any).payload.inputTokens).toBe(100);
        expect((tokenEvent as any).payload.outputTokens).toBe(50);
        expect((tokenEvent as any).payload.sessionTotalTokens).toBe(150);
        expect((tokenEvent as any).payload.model).toBe('claude-sonnet-4-6');
      });

      it('should store null for stopReason and apiMessageId when absent from event', async () => {
        service.registerSessionGetter(() => makeSession({ messageId: 'msg-004' }));

        service.mapToSessionEvents(
          { type: 'finish-step', usage: { input_tokens: 10, output_tokens: 5 } } as any,
          testSessionId,
          testClientId,
        );
        await flush();

        expect(mockTokenUsageService.recordUsage).toHaveBeenCalledWith(
          expect.objectContaining({ stopReason: null, apiMessageId: null }),
        );
      });

      it('should pass contextWindowUsage when present in event', async () => {
        service.registerSessionGetter(() => makeSession({ messageId: 'msg-ctx' }));
        const contextWindowUsage = { used: 15000, limit: 200000, percentFull: 7.5 };

        service.mapToSessionEvents(
          {
            type: 'finish-step',
            usage: { input_tokens: 10, output_tokens: 5, context_window_usage: contextWindowUsage },
          } as any,
          testSessionId,
          testClientId,
        );
        await flush();

        expect(mockTokenUsageService.recordUsage).toHaveBeenCalledWith(
          expect.objectContaining({ contextWindowUsage }),
        );
      });

      it('should pass null for contextWindowUsage when absent from event', async () => {
        service.registerSessionGetter(() => makeSession({ messageId: 'msg-noctx' }));

        service.mapToSessionEvents(finishStepWithUsage as any, testSessionId, testClientId);
        await flush();

        expect(mockTokenUsageService.recordUsage).toHaveBeenCalledWith(
          expect.objectContaining({ contextWindowUsage: null }),
        );
      });

      it.each<[string, () => void]>([
        ['no session getter registered', () => { /* no-op */ }],
        ['session has no currentAssistantMessageId', () => service.registerSessionGetter(() => makeSession({ messageId: undefined }))],
        ['session getter returns undefined', () => service.registerSessionGetter(() => undefined)],
      ])('should not call recordUsage when %s', async (_, setup) => {
        setup();
        service.mapToSessionEvents(finishStepWithUsage as any, testSessionId, testClientId);
        await flush();

        expect(mockTokenUsageService.recordUsage).not.toHaveBeenCalled();
      });

      it('should warn (not throw) when finish-step arrives without usage data', () => {
        const warnSpy = jest.spyOn((service as any).logger, 'warn');

        const events = service.mapToSessionEvents(
          { type: 'finish-step' } as any,
          testSessionId,
          testClientId,
        );

        expect(events.find((e) => e.type === 'token_usage')).toBeUndefined();
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining("'finish-step' received without usage data"),
        );
      });

      it('should NOT warn when message_delta arrives without usage (content-only delta)', () => {
        const warnSpy = jest.spyOn((service as any).logger, 'warn');

        service.mapToSessionEvents(
          { type: 'message_delta', delta: { type: 'text_delta', text: 'hi' } } as any,
          testSessionId,
          testClientId,
        );

        expect(warnSpy).not.toHaveBeenCalled();
      });

      it('should catch and log errors from recordUsage without throwing', async () => {
        const errorSpy = jest.spyOn((service as any).logger, 'error');
        mockTokenUsageService.recordUsage.mockRejectedValue(new Error('DB connection lost'));
        service.registerSessionGetter(() => makeSession({ messageId: 'msg-005' }));

        // should not throw
        expect(() =>
          service.mapToSessionEvents(finishStepWithUsage as any, testSessionId, testClientId),
        ).not.toThrow();

        await flush();

        expect(errorSpy).toHaveBeenCalledWith(
          'Token recording failed',
          expect.stringContaining('DB connection lost'),
        );
      });

      // -----------------------------------------------------------------------
      // stream-json format: assistant event with message.usage
      // -----------------------------------------------------------------------

      it('should call recordUsage for assistant event with message.usage (stream-json)', async () => {
        service.registerSessionGetter(() => makeSession({ messageId: 'msg-ast-001', solutionId: 'tenant-1' }));

        const assistantWithUsage = {
          type: 'assistant',
          message: {
            id: 'msg_api_ast',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'Hello' }],
            model: 'claude-sonnet-4-20250514',
            stop_reason: 'end_turn',
            usage: {
              input_tokens: 500,
              output_tokens: 150,
              cache_read_input_tokens: 100,
              cache_creation_input_tokens: 50,
              reasoning_tokens: 0,
            },
          },
        };

        service.mapToSessionEvents(assistantWithUsage as any, testSessionId, testClientId);
        await flush();

        expect(mockTokenUsageService.recordUsage).toHaveBeenCalledTimes(1);
        expect(mockTokenUsageService.recordUsage).toHaveBeenCalledWith(
          expect.objectContaining({
            messageId: 'msg-ast-001',
            sessionId: testSessionId,
            solutionId: 'tenant-1',
            model: 'claude-sonnet-4-20250514',
            inputTokens: 500,
            outputTokens: 150,
            cachedInputTokens: 100,
            cacheCreationTokens: 50,
            stopReason: 'end_turn',
            apiMessageId: 'msg_api_ast',
          }),
        );
      });

      it('should emit token_usage frontend event from assistant event usage', () => {
        service.registerSessionGetter(() => makeSession({ messageId: 'msg-ast-002' }));

        const assistantWithUsage = {
          type: 'assistant',
          message: {
            id: 'msg_api_ast2',
            model: 'claude-sonnet-4-20250514',
            content: [],
            usage: { input_tokens: 200, output_tokens: 80 },
          },
        };

        const events = service.mapToSessionEvents(assistantWithUsage as any, testSessionId, testClientId);

        const tokenEvent = events.find((e) => e.type === 'token_usage');
        expect(tokenEvent).toBeDefined();
        expect((tokenEvent as any).payload.inputTokens).toBe(200);
        expect((tokenEvent as any).payload.outputTokens).toBe(80);
        expect((tokenEvent as any).payload.model).toBe('claude-sonnet-4-20250514');
      });

      it('should NOT record usage from assistant event when usage has only zeros', async () => {
        service.registerSessionGetter(() => makeSession({ messageId: 'msg-ast-003' }));

        const assistantNoUsage = {
          type: 'assistant',
          message: {
            content: [{ type: 'text', text: 'Hi' }],
            usage: { input_tokens: 0, output_tokens: 0 },
          },
        };

        service.mapToSessionEvents(assistantNoUsage as any, testSessionId, testClientId);
        await flush();

        expect(mockTokenUsageService.recordUsage).not.toHaveBeenCalled();
      });

      it('should NOT record usage from assistant event when usage is absent', async () => {
        service.registerSessionGetter(() => makeSession({ messageId: 'msg-ast-004' }));

        const assistantWithoutUsage = {
          type: 'assistant',
          message: {
            content: [{ type: 'text', text: 'Hi' }],
          },
        };

        service.mapToSessionEvents(assistantWithoutUsage as any, testSessionId, testClientId);
        await flush();

        expect(mockTokenUsageService.recordUsage).not.toHaveBeenCalled();
      });

      // -----------------------------------------------------------------------
      // stream-json format: result event with usage
      // -----------------------------------------------------------------------

      it('should call recordUsage for result event with usage (stream-json)', async () => {
        service.registerSessionGetter(() => makeSession({ messageId: 'msg-res-001', solutionId: 'tenant-2' }));

        const resultWithUsage = {
          type: 'result',
          subtype: 'success',
          cost_usd: 0.0045,
          result: '',
          model: 'claude-sonnet-4-20250514',
          usage: {
            input_tokens: 600,
            output_tokens: 200,
            cache_read_input_tokens: 150,
            cache_creation_input_tokens: 30,
            reasoning_tokens: 10,
          },
        };

        service.mapToSessionEvents(resultWithUsage as any, testSessionId, testClientId);
        await flush();

        expect(mockTokenUsageService.recordUsage).toHaveBeenCalledTimes(1);
        expect(mockTokenUsageService.recordUsage).toHaveBeenCalledWith(
          expect.objectContaining({
            messageId: 'msg-res-001',
            sessionId: testSessionId,
            solutionId: 'tenant-2',
            model: 'claude-sonnet-4-20250514',
            inputTokens: 600,
            outputTokens: 200,
            cachedInputTokens: 150,
            cacheCreationTokens: 30,
            reasoningTokens: 10,
          }),
        );
      });

      it('should emit token_usage frontend event from result event usage', () => {
        service.registerSessionGetter(() => makeSession({ messageId: 'msg-res-002' }));

        const resultWithUsage = {
          type: 'result',
          subtype: 'success',
          result: '',
          model: 'claude-sonnet-4-20250514',
          usage: { input_tokens: 300, output_tokens: 100 },
        };

        const events = service.mapToSessionEvents(resultWithUsage as any, testSessionId, testClientId);

        const tokenEvent = events.find((e) => e.type === 'token_usage');
        expect(tokenEvent).toBeDefined();
        expect((tokenEvent as any).payload.inputTokens).toBe(300);
        expect((tokenEvent as any).payload.outputTokens).toBe(100);
      });

      it('should NOT record usage from result event when no usage field', async () => {
        service.registerSessionGetter(() => makeSession({ messageId: 'msg-res-003' }));

        const resultNoUsage = {
          type: 'result',
          subtype: 'success',
          cost_usd: 0.001,
          result: 'done',
        };

        service.mapToSessionEvents(resultNoUsage as any, testSessionId, testClientId);
        await flush();

        expect(mockTokenUsageService.recordUsage).not.toHaveBeenCalled();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Solution tool event triggers
  // ---------------------------------------------------------------------------

  describe('tenant toolEventTriggers', () => {
    const solutionId = 'tenant-live-lesson';

    /** Build a CLI tool result event for any mcp tool name */
    const buildMcpToolResult = (toolUseId: string, jsonContent: object) => ({
      type: 'user',
      message: {
        content: [
          {
            type: 'tool_result',
            tool_use_id: toolUseId,
            content: JSON.stringify(jsonContent),
          },
        ],
      },
    });

    /** Register an MCP tool call then emit its result. Returns resulting frontend events. */
    const emitMcpToolCycle = (
      toolUseId: string,
      mcpToolName: string,
      resultPayload: object,
      input: object = {},
    ) => {
      service.mapToSessionEvents(
        {
          type: 'content_block_start',
          content_block: { type: 'tool_use', id: toolUseId, name: mcpToolName, input },
        } as any,
        testSessionId,
        testClientId,
      );
      return service.mapToSessionEvents(
        buildMcpToolResult(toolUseId, resultPayload) as any,
        testSessionId,
        testClientId,
      );
    };

    beforeEach(() => {
      service.registerSessionGetter((id) =>
        id === testSessionId
          ? ({ sessionId: id, clientId: testClientId, solutionId, cliProcess: null, stdin: null, socket: null } as any)
          : undefined,
      );
    });

    it('emits output_update when tool name matches a registered trigger', () => {
      service.registerTenantToolTriggers(solutionId, [
        { toolName: 'advance_beat', eventType: 'output_update' },
      ]);

      const events = emitMcpToolCycle(
        'toolu_ab1', 'mcp__live-lesson-tools__advance_beat',
        { data: { phase: 1 }, status: 'ok' }, { beatId: 'beat-1' },
      );

      const outputUpdate = events.find((e) => e.type === 'output_update');
      expect(outputUpdate).toBeDefined();
      expect((outputUpdate as any).payload.status).toBe('ok');
      expect((outputUpdate as any).payload.data).toEqual({ phase: 1 });
    });

    it('matches triggers when the proxy advertises tools as <namespace>.<name> (Phase 4)', () => {
      // The ToolCallerProxy surfaces tools to Claude Code with their
      // qualified registry name (e.g. `creator.emit_todo_card`).
      // solution.json's toolEventTriggers still use the local name
      // (`emit_todo_card`) because that's what the underlying stdio
      // server originally advertised. Without the namespace-strip
      // fallback, the cards POC's output_update events stop firing
      // the moment proxyEnabled:true lands.
      service.registerTenantToolTriggers(solutionId, [
        { toolName: 'emit_todo_card', eventType: 'output_update', field: 'card' },
      ]);

      const events = emitMcpToolCycle(
        'toolu_proxy1',
        'mcp__tool-caller-proxy__creator.emit_todo_card',
        { kind: 'todo', title: 'Plan', items: [] },
        { title: 'Plan' },
      );

      const outputUpdate = events.find((e) => e.type === 'output_update');
      expect(outputUpdate).toBeDefined();
      // `field: 'card'` wrap from buildOutputUpdate.
      const payload = (outputUpdate as any).payload.data as { field?: string; value?: unknown };
      expect(payload.field).toBe('card');
      expect(payload.value).toEqual({ kind: 'todo', title: 'Plan', items: [] });
    });

    it('does not emit output_update when tool name does not match', () => {
      service.registerTenantToolTriggers(solutionId, [
        { toolName: 'advance_beat', eventType: 'output_update' },
      ]);

      const events = emitMcpToolCycle(
        'toolu_other1', 'mcp__live-lesson-tools__load_lesson',
        { data: {}, status: 'ok' }, { lessonId: 'math-intro' },
      );

      expect(events.find((e) => e.type === 'output_update')).toBeUndefined();
    });

    it('does not emit output_update when tenant has no registered triggers', () => {
      const events = emitMcpToolCycle(
        'toolu_no_trigger', 'mcp__live-lesson-tools__advance_beat', { data: {}, status: 'ok' },
      );

      expect(events.find((e) => e.type === 'output_update')).toBeUndefined();
    });

    it('does not emit output_update when session has no solutionId', () => {
      service.registerSessionGetter((id) =>
        id === testSessionId
          ? ({ sessionId: id, clientId: testClientId, cliProcess: null, stdin: null, socket: null } as any)
          : undefined,
      );
      service.registerTenantToolTriggers(solutionId, [
        { toolName: 'advance_beat', eventType: 'output_update' },
      ]);

      const events = emitMcpToolCycle(
        'toolu_no_tenant', 'mcp__live-lesson-tools__advance_beat', { data: {}, status: 'ok' },
      );

      expect(events.find((e) => e.type === 'output_update')).toBeUndefined();
    });

    it('does not crash when sessionGetter returns undefined', () => {
      service.registerSessionGetter((_id) => undefined);
      service.registerTenantToolTriggers(solutionId, [
        { toolName: 'advance_beat', eventType: 'output_update' },
      ]);

      expect(() =>
        emitMcpToolCycle('toolu_no_session', 'mcp__live-lesson-tools__advance_beat', { data: {}, status: 'ok' }),
      ).not.toThrow();
    });

    it('emits output_update for write_output when trigger is registered', () => {
      service.registerTenantToolTriggers(solutionId, [
        { toolName: 'write_output', eventType: 'output_update' },
      ]);

      const events = emitMcpToolCycle(
        'toolu_write_dup', 'mcp__server__write_output', { data: { text: 'hello' }, status: 'complete' },
      );

      expect(events.filter((e) => e.type === 'output_update')).toHaveLength(1);
    });

    it('includes progress field when present in parsedResult', () => {
      service.registerTenantToolTriggers(solutionId, [
        { toolName: 'advance_beat', eventType: 'output_update' },
      ]);

      const events = emitMcpToolCycle(
        'toolu_progress', 'mcp__live-lesson-tools__advance_beat', { data: {}, status: 'ok', progress: 75 },
      );

      expect((events.find((e) => e.type === 'output_update') as any).payload.progress).toBe(75);
    });

    it('wraps raw tool result with trigger.field when configured', () => {
      service.registerTenantToolTriggers(solutionId, [
        { toolName: 'parse_quiz_content', eventType: 'output_update', field: 'parsedContent' },
      ]);

      const events = emitMcpToolCycle(
        'toolu_parse', 'mcp__quiz-analyzer-tools__parse_quiz_content',
        { stem: 'What is 1+1?', options: ['A. 1', 'B. 2'], quizType: 'choice' },
      );

      const outputUpdate = events.find((e) => e.type === 'output_update');
      expect(outputUpdate).toBeDefined();
      // Raw result should be wrapped as { field, value }
      expect((outputUpdate as any).payload.data).toEqual({
        field: 'parsedContent',
        value: { stem: 'What is 1+1?', options: ['A. 1', 'B. 2'], quizType: 'choice' },
      });
    });

    it('does not wrap when result already has a field property (write_output)', () => {
      service.registerTenantToolTriggers(solutionId, [
        { toolName: 'write_output', eventType: 'output_update', field: 'fallback' },
      ]);

      const events = emitMcpToolCycle(
        'toolu_wo', 'mcp__server__write_output',
        { field: 'parsedQuiz', value: { stem: 'Hi' }, success: true },
      );

      const outputUpdate = events.find((e) => e.type === 'output_update');
      expect(outputUpdate).toBeDefined();
      // Should NOT be double-wrapped — existing field is preserved
      expect((outputUpdate as any).payload.data).toEqual({
        field: 'parsedQuiz', value: { stem: 'Hi' }, success: true,
      });
    });

    it('clearAllTenantToolTriggers removes all registered triggers', () => {
      service.registerTenantToolTriggers(solutionId, [
        { toolName: 'advance_beat', eventType: 'output_update' },
      ]);
      service.clearAllTenantToolTriggers();

      const events = emitMcpToolCycle(
        'toolu_after_clear', 'mcp__live-lesson-tools__advance_beat', { data: {}, status: 'ok' },
      );

      expect(events.find((e) => e.type === 'output_update')).toBeUndefined();
    });
  });
});
