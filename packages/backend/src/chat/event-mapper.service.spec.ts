/**
 * EventMapperService Unit Tests
 *
 * Tests the mapping of CLI events to frontend events, with focus on
 * CLI tool result format handling (type: 'user' with tool_result content blocks).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventMapperService } from './event-mapper.service';
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

  const testSessionId = 'test-session-123';
  const testClientId = 'test-client';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({ debug: false })],
        }),
      ],
      providers: [EventMapperService],
    }).compile();

    service = module.get<EventMapperService>(EventMapperService);
  });

  afterEach(() => {
    // Clear session state between tests
    service.clearSessionState(testSessionId);
  });

  describe('mapToFrontendEvents', () => {
    describe('CLI user message with tool_result', () => {
      it('should emit tool_activity end event for CLI format', () => {
        // First, emit tool start to register the tool call
        service.mapToFrontendEvents(writeToolCallEvent as any, testSessionId, testClientId);

        // Then emit CLI format tool result
        const events = service.mapToFrontendEvents(
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
        service.mapToFrontendEvents(writeToolCallEvent as any, testSessionId, testClientId);

        // Emit CLI format result (no is_error = success)
        const events = service.mapToFrontendEvents(
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
        service.mapToFrontendEvents(
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
        const events = service.mapToFrontendEvents(
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
        service.mapToFrontendEvents(readToolCallEvent as any, testSessionId, testClientId);

        // Emit CLI format result with content
        const events = service.mapToFrontendEvents(
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
        service.mapToFrontendEvents(writeToolCallEvent as any, testSessionId, testClientId);

        // Emit CLI format result
        service.mapToFrontendEvents(
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
        service.mapToFrontendEvents(
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
        const events = service.mapToFrontendEvents(
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
        service.mapToFrontendEvents(
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

        service.mapToFrontendEvents(
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
        const events = service.mapToFrontendEvents(
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
        const events = service.mapToFrontendEvents(
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
        service.mapToFrontendEvents(writeToolCallEvent as any, testSessionId, testClientId);

        // Wait a bit to create measurable duration
        await new Promise((resolve) => setTimeout(resolve, 20));

        // Emit CLI format result
        const events = service.mapToFrontendEvents(
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
        service.mapToFrontendEvents(writeToolCallEvent as any, testSessionId, testClientId);

        // Emit CLI format result
        const events = service.mapToFrontendEvents(
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
        service.mapToFrontendEvents(writeToolCallEvent as any, testSessionId, testClientId);

        // Emit CLI format result
        service.mapToFrontendEvents(
          cliWriteToolResultEvent as any,
          testSessionId,
          testClientId,
        );

        // Emit the same tool result again - should not find the tool call
        const events = service.mapToFrontendEvents(
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
        service.mapToFrontendEvents(writeToolCallEvent as any, testSessionId, testClientId);
        service.mapToFrontendEvents(
          cliWriteToolResultEvent as any,
          testSessionId,
          testClientId,
        );

        // Test with Read tool
        service.mapToFrontendEvents(readToolCallEvent as any, testSessionId, testClientId);
        service.mapToFrontendEvents(
          cliReadToolResultEvent as any,
          testSessionId,
          testClientId,
        );

        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(hookCalls).toContain('Write');
        expect(hookCalls).toContain('Read');
      });
    });

    describe('comparison with tool_result format', () => {
      it('should produce equivalent events for CLI format and tool_result format', () => {
        // Test CLI format
        service.mapToFrontendEvents(writeToolCallEvent as any, testSessionId, testClientId);
        const cliEvents = service.mapToFrontendEvents(
          cliWriteToolResultEvent as any,
          testSessionId,
          testClientId,
        );

        // Clear and test tool_result format
        service.clearSessionState(testSessionId);
        service.mapToFrontendEvents(writeToolCallEvent as any, testSessionId, testClientId);
        const toolResultEvents = service.mapToFrontendEvents(
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
        service.mapToFrontendEvents(writeToolCallEvent as any, testSessionId, testClientId);
        service.mapToFrontendEvents(cliWriteToolResultEvent as any, testSessionId, testClientId);

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
        service.mapToFrontendEvents(writeToolCallEvent as any, testSessionId, testClientId);
        service.mapToFrontendEvents(cliWriteToolResultEvent as any, testSessionId, testClientId);

        // Second tool
        service.mapToFrontendEvents(readToolCallEvent as any, testSessionId, testClientId);
        service.mapToFrontendEvents(cliReadToolResultEvent as any, testSessionId, testClientId);

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
        service.mapToFrontendEvents(writeToolCallEvent as any, testSessionId, testClientId);
        service.mapToFrontendEvents(cliWriteToolResultEvent as any, testSessionId, testClientId);

        // Reset the execution order
        service.resetExecutionOrder(testSessionId);

        // Next tool should start at 1 again
        service.mapToFrontendEvents(readToolCallEvent as any, testSessionId, testClientId);
        service.mapToFrontendEvents(cliReadToolResultEvent as any, testSessionId, testClientId);

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
        service.mapToFrontendEvents(writeToolCallEvent as any, session1, testClientId);
        service.mapToFrontendEvents(cliWriteToolResultEvent as any, session1, testClientId);

        // Tool in session 2
        service.mapToFrontendEvents(readToolCallEvent as any, session2, testClientId);
        service.mapToFrontendEvents(cliReadToolResultEvent as any, session2, testClientId);

        // Another tool in session 1
        service.mapToFrontendEvents(readToolCallEvent as any, session1, testClientId);
        service.mapToFrontendEvents(cliReadToolResultEvent as any, session1, testClientId);

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
        service.mapToFrontendEvents(writeToolCallEvent as any, testSessionId, testClientId);
        service.mapToFrontendEvents(cliWriteToolResultEvent as any, testSessionId, testClientId);

        // Clear session state (simulates session cleanup)
        service.clearSessionState(testSessionId);

        // Next tool should start at 1 again
        service.mapToFrontendEvents(readToolCallEvent as any, testSessionId, testClientId);
        service.mapToFrontendEvents(cliReadToolResultEvent as any, testSessionId, testClientId);

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
        service.mapToFrontendEvents(
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

        service.mapToFrontendEvents(
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

        service.mapToFrontendEvents(writeToolCallEvent as any, testSessionId, testClientId);
        service.mapToFrontendEvents(cliWriteToolResultEvent as any, testSessionId, testClientId);

        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(hookResults[0].isError).toBe(false);
        expect(hookResults[0].errorType).toBeUndefined();
      });
    });
  });
});
