/**
 * useFiles Hook Tests
 *
 * Tests for file management hook including:
 * - File fetching and state management
 * - Real-time Socket.io updates
 * - Upload, download, delete operations
 * - Badge state management (new/modified/synced)
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useFiles } from '../src/hooks/useFiles';
import type { UseAgentConnectionReturn } from '../src/types';
import { vi } from 'vitest';

// Mock fetch
global.fetch = vi.fn() as any;

/**
 * Create mock FileTreeNode matching backend structure
 */
function createMockFileNode(overrides: any = {}) {
  return {
    type: 'file',
    fileId: 'file-1',
    name: 'test.md',
    path: '/workspace/test.md',
    size: 1024,
    mimeType: 'text/markdown',
    status: 'new',
    uploadedBy: 'agent',
    currentVersion: '1.0.0',
    lastVersionAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('useFiles', () => {
  let mockConnection: UseAgentConnectionReturn;
  let mockSocket: any;
  const sessionId = 'session-123';
  const tenantId = 'tenant-123';

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    (global.fetch as vi.Mock).mockClear();

    // Mock Socket.io
    mockSocket = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    };

    mockConnection = {
      socket: mockSocket,
      serverUrl: 'http://localhost:3001',
      tenantId,
      connectionState: 'connected',
      isConnected: true,
      error: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  });

  describe('Initial State', () => {
    it('should initialize with empty files array', () => {
      const { result } = renderHook(() =>
        useFiles({ connection: mockConnection, sessionId })
      );

      expect(result.current.files).toEqual([]);
      expect(result.current.isLoading).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('should fetch files on mount', async () => {
      const mockTreeNodes = [createMockFileNode()];

      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tree: mockTreeNodes }),
      });

      const { result } = renderHook(() =>
        useFiles({ connection: mockConnection, sessionId })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // flattenFiles transforms FileTreeNode to FileMetadata
      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0]).toMatchObject({
        id: 'file-1',
        filename: 'test.md',
        originalPath: '/workspace/test.md',
        size: 1024,
        mimeType: 'text/markdown',
        status: 'new',
        uploadedBy: 'agent',
        currentVersion: '1.0.0',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/v1/files/session/${sessionId}/tree`)
      );
    });
  });

  describe('Socket.io Real-time Updates', () => {
    it('should register socket event listeners on mount', () => {
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tree: [] }),
      });

      renderHook(() =>
        useFiles({ connection: mockConnection, sessionId })
      );

      expect(mockSocket.on).toHaveBeenCalledWith(
        'file.created',
        expect.any(Function)
      );
      expect(mockSocket.on).toHaveBeenCalledWith(
        'file.modified',
        expect.any(Function)
      );
    });

    it('should refetch files when file.created event received', async () => {
      const mockNode = createMockFileNode();

      // First fetch: empty
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tree: [] }),
      });

      const { result } = renderHook(() =>
        useFiles({ connection: mockConnection, sessionId })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.files).toHaveLength(0);

      // Second fetch: with new file
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tree: [mockNode] }),
      });

      // Simulate file.created event
      const fileCreatedHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'file.created'
      )[1];

      act(() => {
        fileCreatedHandler({ sessionId });
      });

      await waitFor(() => {
        expect(result.current.files).toHaveLength(1);
      });

      expect(result.current.files[0].id).toBe('file-1');
      expect(result.current.newFilesCount).toBe(1);
    });

    it('should refetch files when file.modified event received', async () => {
      const mockNode = createMockFileNode({ status: 'synced' });

      // First fetch
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tree: [mockNode] }),
      });

      const { result } = renderHook(() =>
        useFiles({ connection: mockConnection, sessionId })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.files[0].status).toBe('synced');

      // Second fetch: file modified
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tree: [createMockFileNode({ status: 'modified' })] }),
      });

      // Simulate file.modified event
      const fileModifiedHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'file.modified'
      )[1];

      act(() => {
        fileModifiedHandler({ sessionId });
      });

      await waitFor(() => {
        expect(result.current.files[0].status).toBe('modified');
      });
    });
  });

  describe('Badge State Management', () => {
    it('should track new files count', async () => {
      const mockNodes = [
        createMockFileNode({ fileId: 'file-1', status: 'new' }),
        createMockFileNode({ fileId: 'file-2', status: 'new', name: 'b.md' }),
        createMockFileNode({ fileId: 'file-3', status: 'synced', name: 'c.md' }),
      ];

      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tree: mockNodes }),
      });

      const { result } = renderHook(() =>
        useFiles({ connection: mockConnection, sessionId })
      );

      await waitFor(() => {
        expect(result.current.newFilesCount).toBe(2);
        expect(result.current.hasNewFiles).toBe(true);
      });
    });

    it('should clear badge when markAsSynced called', async () => {
      const mockNode = createMockFileNode({ status: 'new' });

      (global.fetch as vi.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ tree: [mockNode] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'synced' }),
        });

      const { result } = renderHook(() =>
        useFiles({ connection: mockConnection, sessionId })
      );

      await waitFor(() => {
        expect(result.current.newFilesCount).toBe(1);
      });

      await act(async () => {
        await result.current.markAsSynced('file-1');
      });

      expect(result.current.files[0].status).toBe('synced');
      expect(result.current.newFilesCount).toBe(0);
    });

    it('should clear all badges when markAllSeen called', async () => {
      const mockNodes = [
        createMockFileNode({ fileId: 'file-1', status: 'new' }),
        createMockFileNode({ fileId: 'file-2', status: 'new', name: 'b.md' }),
      ];

      (global.fetch as vi.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ tree: mockNodes }),
        })
        .mockResolvedValueOnce({
          ok: true,
        });

      const { result } = renderHook(() =>
        useFiles({ connection: mockConnection, sessionId })
      );

      await waitFor(() => {
        expect(result.current.newFilesCount).toBe(2);
      });

      await act(async () => {
        await result.current.markAllSeen();
      });

      expect(result.current.newFilesCount).toBe(0);
      expect(result.current.hasNewFiles).toBe(false);
    });
  });

  describe('File Operations', () => {
    it('should upload file successfully', async () => {
      (global.fetch as vi.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ tree: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'file-new',
            filename: 'upload.pdf',
            originalPath: '/workspace/upload.pdf',
            size: 5000,
            mimeType: 'application/pdf',
            status: 'new',
            uploadedBy: 'user',
            currentVersion: '1.0.0',
            lastVersionAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
        });

      const { result } = renderHook(() =>
        useFiles({ connection: mockConnection, sessionId })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const file = new File(['content'], 'upload.pdf', {
        type: 'application/pdf',
      });

      let uploadedFile;
      await act(async () => {
        uploadedFile = await result.current.uploadFile(file);
      });

      expect(uploadedFile).toMatchObject({
        id: 'file-new',
        filename: 'upload.pdf',
        size: 5000,
        status: 'new',
      });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/files/upload'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should download file successfully', async () => {
      const mockNode = createMockFileNode();

      (global.fetch as vi.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ tree: [mockNode] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          blob: async () => new Blob(['file content']),
        })
        .mockResolvedValueOnce({
          ok: true,
        });

      // Mock URL.createObjectURL and revokeObjectURL
      global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = vi.fn();

      // Mock document methods
      const mockLink = document.createElement('a');
      mockLink.click = vi.fn();
      vi.spyOn(document, 'createElement').mockReturnValue(mockLink);
      vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink);
      vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink);

      const { result } = renderHook(() =>
        useFiles({ connection: mockConnection, sessionId })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.downloadFile('file-1');
      });

      expect(mockLink.click).toHaveBeenCalled();
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    it('should handle upload error', async () => {
      (global.fetch as vi.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ tree: [] }),
        })
        .mockResolvedValueOnce({
          ok: false,
          statusText: 'Bad Request',
        });

      const { result } = renderHook(() =>
        useFiles({ connection: mockConnection, sessionId })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const file = new File(['content'], 'bad.pdf', {
        type: 'application/pdf',
      });

      await expect(
        act(async () => {
          await result.current.uploadFile(file);
        })
      ).rejects.toThrow('Upload failed: Bad Request');
    });
  });

  describe('Cleanup', () => {
    it('should remove socket listeners on unmount', () => {
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tree: [] }),
      });

      const { unmount } = renderHook(() =>
        useFiles({ connection: mockConnection, sessionId })
      );

      unmount();

      expect(mockSocket.off).toHaveBeenCalledWith(
        'file.created',
        expect.any(Function)
      );
      expect(mockSocket.off).toHaveBeenCalledWith(
        'file.modified',
        expect.any(Function)
      );
    });
  });
});
