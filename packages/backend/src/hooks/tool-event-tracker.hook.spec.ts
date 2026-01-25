/**
 * Tool Event Tracker Hook Tests
 *
 * Tests for tenantId propagation in tool event tracking.
 */

import { createToolEventTrackerHook, ToolEventTrackerDeps } from './tool-event-tracker.hook';
import type { ToolEventsService } from '../messages/tool-events.service';
import type { ToolStartInfo, ToolResult, ToolHookContext } from './tool-hook.interface';
import type { ManagedSession } from '../common/interfaces';

describe('ToolEventTrackerHook', () => {
  let hook: ReturnType<typeof createToolEventTrackerHook>;
  let mockToolEventsService: jest.Mocked<ToolEventsService>;
  let mockGetSession: jest.Mock;
  let mockSession: ManagedSession;

  // Helper to create a valid ToolHookContext
  const createContext = (overrides: Partial<ToolHookContext> = {}): ToolHookContext => ({
    sessionId: 'session-123',
    clientId: 'client-123',
    toolUseId: 'tool-use-123',
    timestamp: new Date().toISOString(),
    ...overrides,
  });

  // Helper to create a valid ToolResult
  const createResult = (overrides: Partial<ToolResult> = {}): ToolResult => ({
    toolName: 'Read',
    input: {},
    output: '',
    isError: false,
    durationMs: 50,
    ...overrides,
  });

  beforeEach(() => {
    mockToolEventsService = {
      recordStart: jest.fn().mockResolvedValue({}),
      recordEnd: jest.fn().mockResolvedValue({}),
    } as any;

    mockSession = {
      sessionId: 'session-123',
      clientId: 'client-123',
      cliProcess: null,
      stdin: null,
      socket: null,
      lastActivity: new Date(),
      status: 'processing',
      createdAt: new Date(),
      messageCount: 5,
      buffer: '',
      workspaceDir: '/tmp/session-123',
      currentAssistantMessageId: 'msg-123',
      tenantId: 'tenant-tool',
    };

    mockGetSession = jest.fn().mockReturnValue(mockSession);

    const deps: ToolEventTrackerDeps = {
      toolEventsService: mockToolEventsService,
      getSession: mockGetSession,
    };

    hook = createToolEventTrackerHook(deps);
  });

  describe('onToolStart', () => {
    const baseStartInfo: ToolStartInfo = {
      toolId: 'tool-use-123',
      toolName: 'Read',
      input: { file_path: '/tmp/test.txt' },
      agentType: 'main',
    };

    it('should pass tenantId from session to recordStart', async () => {
      await hook.onToolStart!(baseStartInfo, createContext());

      expect(mockToolEventsService.recordStart).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-tool',
        }),
      );
    });

    it('should pass null tenantId when session has no tenantId', async () => {
      mockSession.tenantId = undefined;

      await hook.onToolStart!(baseStartInfo, createContext());

      expect(mockToolEventsService.recordStart).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: null,
        }),
      );
    });

    it('should include all required fields in recordStart call', async () => {
      await hook.onToolStart!(baseStartInfo, createContext());

      expect(mockToolEventsService.recordStart).toHaveBeenCalledWith({
        messageId: 'msg-123',
        sessionId: 'session-123',
        tenantId: 'tenant-tool',
        toolUseId: 'tool-use-123',
        toolName: 'Read',
        toolInput: { file_path: '/tmp/test.txt' },
        agentType: 'main',
        decisionLogic: undefined,
      });
    });

    it('should not call recordStart when session not found', async () => {
      mockGetSession.mockReturnValue(undefined);

      await hook.onToolStart!(baseStartInfo, createContext());

      expect(mockToolEventsService.recordStart).not.toHaveBeenCalled();
    });

    it('should not call recordStart when no assistant message context', async () => {
      mockSession.currentAssistantMessageId = undefined;

      await hook.onToolStart!(baseStartInfo, createContext());

      expect(mockToolEventsService.recordStart).not.toHaveBeenCalled();
    });

    it('should handle recordStart errors gracefully', async () => {
      mockToolEventsService.recordStart = jest.fn().mockRejectedValue(new Error('Database error'));

      // Should not throw
      await expect(hook.onToolStart!(baseStartInfo, createContext())).resolves.not.toThrow();
    });

    it('should include decisionLogic when provided', async () => {
      const startInfoWithLogic: ToolStartInfo = {
        ...baseStartInfo,
        decisionLogic: {
          why: 'To read the file contents',
          benefit: 'Understand the code structure',
          nextStep: 'Analyze the file',
        },
      };

      await hook.onToolStart!(startInfoWithLogic, createContext());

      expect(mockToolEventsService.recordStart).toHaveBeenCalledWith(
        expect.objectContaining({
          decisionLogic: {
            why: 'To read the file contents',
            benefit: 'Understand the code structure',
            nextStep: 'Analyze the file',
          },
        }),
      );
    });
  });

  describe('afterToolResult', () => {
    const baseResult: ToolResult = {
      toolName: 'Read',
      input: { file_path: '/tmp/test.txt' },
      output: 'File contents here',
      isError: false,
      durationMs: 50,
    };

    it('should pass tenantId from session to recordEnd', async () => {
      await hook.afterToolResult!(baseResult, createContext());

      expect(mockToolEventsService.recordEnd).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-tool',
        }),
      );
    });

    it('should pass null tenantId when session has no tenantId', async () => {
      mockSession.tenantId = undefined;

      await hook.afterToolResult!(baseResult, createContext());

      expect(mockToolEventsService.recordEnd).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: null,
        }),
      );
    });

    it('should include all required fields in recordEnd call', async () => {
      await hook.afterToolResult!(baseResult, createContext());

      expect(mockToolEventsService.recordEnd).toHaveBeenCalledWith({
        messageId: 'msg-123',
        sessionId: 'session-123',
        tenantId: 'tenant-tool',
        toolUseId: 'tool-use-123',
        toolName: 'Read',
        toolInput: { file_path: '/tmp/test.txt' },
        toolOutput: 'File contents here',
        success: true,
        durationMs: 50,
        agentType: 'main',
      });
    });

    it('should set success to false when isError is true', async () => {
      const errorResult: ToolResult = {
        ...baseResult,
        isError: true,
        output: 'Error: File not found',
      };

      await hook.afterToolResult!(errorResult, createContext());

      expect(mockToolEventsService.recordEnd).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        }),
      );
    });

    it('should not call recordEnd when session not found', async () => {
      mockGetSession.mockReturnValue(undefined);

      await hook.afterToolResult!(baseResult, createContext());

      expect(mockToolEventsService.recordEnd).not.toHaveBeenCalled();
    });

    it('should not call recordEnd when no assistant message context', async () => {
      mockSession.currentAssistantMessageId = undefined;

      await hook.afterToolResult!(baseResult, createContext());

      expect(mockToolEventsService.recordEnd).not.toHaveBeenCalled();
    });

    it('should handle recordEnd errors gracefully', async () => {
      mockToolEventsService.recordEnd = jest.fn().mockRejectedValue(new Error('Database error'));

      // Should not throw
      await expect(hook.afterToolResult!(baseResult, createContext())).resolves.not.toThrow();
    });
  });

  describe('agent type extraction', () => {
    it('should extract Explore agent type from session ID', async () => {
      const context = createContext({ sessionId: 'session_Explore_123' });

      await hook.afterToolResult!(createResult({ toolName: 'Read' }), context);

      expect(mockToolEventsService.recordEnd).toHaveBeenCalledWith(
        expect.objectContaining({
          agentType: 'Explore',
        }),
      );
    });

    it('should extract Plan agent type from session ID', async () => {
      const context = createContext({ sessionId: 'session_Plan_456' });

      await hook.afterToolResult!(createResult({ toolName: 'Read' }), context);

      expect(mockToolEventsService.recordEnd).toHaveBeenCalledWith(
        expect.objectContaining({
          agentType: 'Plan',
        }),
      );
    });

    it('should extract lesson-plan-designer agent type from session ID', async () => {
      const context = createContext({ sessionId: 'session_lesson-plan-designer_789' });

      await hook.afterToolResult!(createResult({ toolName: 'Read' }), context);

      expect(mockToolEventsService.recordEnd).toHaveBeenCalledWith(
        expect.objectContaining({
          agentType: 'lesson-plan-designer',
        }),
      );
    });

    it('should return Task agent type for Task tool', async () => {
      const context = createContext({ sessionId: 'session-123' });

      await hook.afterToolResult!(createResult({ toolName: 'Task' }), context);

      expect(mockToolEventsService.recordEnd).toHaveBeenCalledWith(
        expect.objectContaining({
          agentType: 'Task',
        }),
      );
    });

    it('should return main agent type for regular session', async () => {
      const context = createContext({ sessionId: 'session-123' });

      await hook.afterToolResult!(createResult({ toolName: 'Read' }), context);

      expect(mockToolEventsService.recordEnd).toHaveBeenCalledWith(
        expect.objectContaining({
          agentType: 'main',
        }),
      );
    });
  });

  describe('tool property', () => {
    it('should match all tools with wildcard', () => {
      expect(hook.tool).toBe('*');
    });
  });

  describe('tenantId edge cases', () => {
    it('should handle empty string tenantId', async () => {
      mockSession.tenantId = '';

      await hook.onToolStart!(
        { toolId: 'tool-123', toolName: 'Read', input: {} },
        createContext({ toolUseId: 'tool-123' }),
      );

      // Empty string is falsy, should become null
      expect(mockToolEventsService.recordStart).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: null,
        }),
      );
    });

    it('should preserve tenantId between start and end events', async () => {
      const context = createContext();

      await hook.onToolStart!(
        { toolId: 'tool-use-123', toolName: 'Read', input: {} },
        context,
      );

      await hook.afterToolResult!(
        createResult({ toolName: 'Read' }),
        context,
      );

      expect(mockToolEventsService.recordStart).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-tool' }),
      );
      expect(mockToolEventsService.recordEnd).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-tool' }),
      );
    });
  });
});
