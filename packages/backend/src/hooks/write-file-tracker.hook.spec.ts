/**
 * Write File Tracker Hook Tests
 *
 * Tests for the WriteFileTrackerHook that captures Write tool results,
 * stores files via FilesService, and emits file_created WebSocket events.
 */

import {
  createWriteFileTrackerHook,
  WriteFileTrackerDeps,
  FileCreatedEvent,
} from './write-file-tracker.hook';
import type { FilesService } from '../files/files.service';
import type { ToolResult, ToolHookContext } from './tool-hook.interface';
import type { ManagedSession } from '../common/interfaces';
import type { AgentFile } from '../files/entities/agent-file.entity';

describe('WriteFileTrackerHook', () => {
  let hook: ReturnType<typeof createWriteFileTrackerHook>;
  let mockFilesService: jest.Mocked<FilesService>;
  let mockGetSession: jest.Mock;
  let mockSession: ManagedSession;
  let mockSocket: { emit: jest.Mock };

  // Helper to create a valid ToolHookContext
  const createContext = (
    overrides: Partial<ToolHookContext> = {},
  ): ToolHookContext => ({
    sessionId: 'session-123',
    clientId: 'client-123',
    toolUseId: 'tool-use-123',
    timestamp: new Date().toISOString(),
    ...overrides,
  });

  // Helper to create a valid ToolResult for Write tool
  const createWriteResult = (
    overrides: Partial<ToolResult> = {},
  ): ToolResult => ({
    toolName: 'Write',
    input: { file_path: '/workspace/docs/test.md', content: '# Test' },
    output: 'File written successfully',
    isError: false,
    durationMs: 50,
    ...overrides,
  });

  // Helper to create mock AgentFile
  const createMockAgentFile = (
    overrides: Partial<AgentFile> = {},
  ): AgentFile => ({
    id: 'file-uuid-1',
    messageId: 'msg-123',
    sessionId: 'session-123',
    tenantId: 'tenant-123',
    originalPath: 'docs/test.md',
    storedPath: '/storage/tenant-123/msg-123/test.md',
    filename: 'test.md',
    mimeType: 'text/markdown',
    size: 256,
    status: 'new',
    downloadedAt: null,
    uploadedBy: 'agent',
    createdAt: new Date('2024-01-01'),
    message: null,
    ...overrides,
  });

  beforeEach(() => {
    mockFilesService = {
      createFromWriteTool: jest.fn().mockResolvedValue(createMockAgentFile()),
    } as any;

    mockSocket = { emit: jest.fn() };

    mockSession = {
      sessionId: 'session-123',
      clientId: 'client-123',
      cliProcess: null,
      stdin: null,
      socket: mockSocket as any,
      lastActivity: new Date(),
      status: 'processing',
      createdAt: new Date(),
      messageCount: 5,
      buffer: '',
      workspaceDir: '/tmp/workspace',
      currentAssistantMessageId: 'msg-123',
      tenantId: 'tenant-123',
    };

    mockGetSession = jest.fn().mockReturnValue(mockSession);

    const deps: WriteFileTrackerDeps = {
      filesService: mockFilesService,
      getSession: mockGetSession,
    };

    hook = createWriteFileTrackerHook(deps);
  });

  describe('createWriteFileTrackerHook', () => {
    it('should return a hook targeting Write tool', () => {
      expect(hook.tool).toContain('Write');
    });

    it('should target both "Write" and "write" tool names', () => {
      expect(hook.tool).toEqual(['Write', 'write']);
    });

    it('should have afterToolResult method', () => {
      expect(typeof hook.afterToolResult).toBe('function');
    });
  });

  describe('afterToolResult', () => {
    describe('success path', () => {
      it('should call filesService.createFromWriteTool on successful Write', async () => {
        await hook.afterToolResult(createWriteResult(), createContext());

        expect(mockFilesService.createFromWriteTool).toHaveBeenCalledTimes(1);
      });

      it('should pass correct parameters to filesService.createFromWriteTool', async () => {
        const result = createWriteResult({
          input: { file_path: '/workspace/reports/summary.md', content: 'data' },
        });

        await hook.afterToolResult(result, createContext());

        expect(mockFilesService.createFromWriteTool).toHaveBeenCalledWith({
          messageId: 'msg-123',
          sessionId: 'session-123',
          tenantId: 'tenant-123',
          originalPath: '/workspace/reports/summary.md',
          workspaceDir: '/tmp/workspace',
        });
      });

      it('should emit file_created event via socket', async () => {
        await hook.afterToolResult(createWriteResult(), createContext());

        expect(mockSocket.emit).toHaveBeenCalledTimes(1);
        expect(mockSocket.emit).toHaveBeenCalledWith(
          'file_created',
          expect.any(Object),
        );
      });

      it('should include correct payload in file_created event', async () => {
        const mockFile = createMockAgentFile({
          id: 'specific-file-id',
          filename: 'report.md',
          originalPath: 'docs/report.md',
          mimeType: 'text/markdown',
          size: 1024,
          status: 'new',
          uploadedBy: 'agent',
          createdAt: new Date('2024-06-15'),
        });
        mockFilesService.createFromWriteTool.mockResolvedValue(mockFile);

        await hook.afterToolResult(createWriteResult(), createContext());

        const emittedEvent = mockSocket.emit.mock.calls[0][1] as FileCreatedEvent;
        expect(emittedEvent.type).toBe('file_created');
        expect(emittedEvent.payload).toEqual({
          id: 'specific-file-id',
          filename: 'report.md',
          originalPath: 'docs/report.md',
          mimeType: 'text/markdown',
          size: 1024,
          status: 'new',
          uploadedBy: 'agent',
          createdAt: new Date('2024-06-15'),
          sessionId: 'session-123',
          messageId: 'msg-123',
        });
      });
    });

    describe('error handling', () => {
      it('should skip tracking when result.isError is true', async () => {
        const errorResult = createWriteResult({ isError: true });

        await hook.afterToolResult(errorResult, createContext());

        expect(mockFilesService.createFromWriteTool).not.toHaveBeenCalled();
        expect(mockSocket.emit).not.toHaveBeenCalled();
      });

      it('should skip tracking when file_path is missing from input', async () => {
        const resultNoPath = createWriteResult({
          input: { content: 'some content' }, // no file_path
        });

        await hook.afterToolResult(resultNoPath, createContext());

        expect(mockFilesService.createFromWriteTool).not.toHaveBeenCalled();
        expect(mockSocket.emit).not.toHaveBeenCalled();
      });

      it('should skip tracking when session not found', async () => {
        mockGetSession.mockReturnValue(undefined);

        await hook.afterToolResult(createWriteResult(), createContext());

        expect(mockFilesService.createFromWriteTool).not.toHaveBeenCalled();
      });

      it('should skip tracking when currentAssistantMessageId is missing', async () => {
        mockSession.currentAssistantMessageId = undefined;

        await hook.afterToolResult(createWriteResult(), createContext());

        expect(mockFilesService.createFromWriteTool).not.toHaveBeenCalled();
      });

      it('should not throw when filesService throws (graceful degradation)', async () => {
        mockFilesService.createFromWriteTool.mockRejectedValue(
          new Error('Database error'),
        );

        // Should not throw
        await expect(
          hook.afterToolResult(createWriteResult(), createContext()),
        ).resolves.not.toThrow();
      });

      it('should not emit event when filesService throws', async () => {
        mockFilesService.createFromWriteTool.mockRejectedValue(
          new Error('File not found'),
        );

        await hook.afterToolResult(createWriteResult(), createContext());

        expect(mockSocket.emit).not.toHaveBeenCalled();
      });
    });

    describe('socket handling', () => {
      it('should not emit event when socket is null', async () => {
        mockSession.socket = null;

        await hook.afterToolResult(createWriteResult(), createContext());

        // Should still create file record
        expect(mockFilesService.createFromWriteTool).toHaveBeenCalled();
        // But no emit since socket is null
      });

      it('should emit event with correct sessionId and messageId', async () => {
        const context = createContext({ sessionId: 'different-session' });
        mockSession.sessionId = 'different-session';
        mockSession.currentAssistantMessageId = 'different-msg';
        mockGetSession.mockReturnValue(mockSession);

        await hook.afterToolResult(createWriteResult(), context);

        const emittedEvent = mockSocket.emit.mock.calls[0][1] as FileCreatedEvent;
        expect(emittedEvent.payload.sessionId).toBe('different-session');
        expect(emittedEvent.payload.messageId).toBe('different-msg');
      });
    });

    describe('tenantId propagation', () => {
      it('should pass tenantId from session to filesService', async () => {
        mockSession.tenantId = 'custom-tenant';

        await hook.afterToolResult(createWriteResult(), createContext());

        expect(mockFilesService.createFromWriteTool).toHaveBeenCalledWith(
          expect.objectContaining({
            tenantId: 'custom-tenant',
          }),
        );
      });

      it('should handle undefined tenantId', async () => {
        mockSession.tenantId = undefined;

        await hook.afterToolResult(createWriteResult(), createContext());

        expect(mockFilesService.createFromWriteTool).toHaveBeenCalledWith(
          expect.objectContaining({
            tenantId: undefined,
          }),
        );
      });

      it('should handle null tenantId', async () => {
        (mockSession as any).tenantId = null;

        await hook.afterToolResult(createWriteResult(), createContext());

        expect(mockFilesService.createFromWriteTool).toHaveBeenCalledWith(
          expect.objectContaining({
            tenantId: null,
          }),
        );
      });
    });

    describe('case insensitivity', () => {
      it('should handle lowercase "write" tool name', async () => {
        const result = createWriteResult({ toolName: 'write' });

        await hook.afterToolResult(result, createContext());

        expect(mockFilesService.createFromWriteTool).toHaveBeenCalled();
      });
    });
  });
});
