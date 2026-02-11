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
import { useFiles } from '../useFiles';
import type { UseAgentConnectionReturn } from '../../types';

// Mock fetch
global.fetch = jest.fn();

describe('useFiles', () => {
  let mockConnection: UseAgentConnectionReturn;
  let mockSocket: any;
  const sessionId = 'session-123';
  const tenantId = 'tenant-123';

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();

    // Mock Socket.io
    mockSocket = {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    };

    mockConnection = {
      socket: mockSocket,
      serverUrl: 'http://localhost:3001',
      tenantId,
      connectionState: 'connected',
      isConnected: true,
      error: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
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
      const mockFiles = [
        {
          id: 'file-1',
          filename: 'test.md',
          size: 1024,
          status: 'new',
          mimeType: 'text/markdown',
          currentVersion: '1.0.0',
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockFiles,
      });

      const { result } = renderHook(() =>
        useFiles({ connection: mockConnection, sessionId })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.files).toEqual(mockFiles);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/v1/sessions/${sessionId}/files`),
        expect.any(Object)
      );
    });
  });

  describe('Socket.io Real-time Updates', () => {
    it('should register socket event listeners on mount', () => {
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
      expect(mockSocket.on).toHaveBeenCalledWith(
        'file.deleted',
        expect.any(Function)
      );
    });

    it('should add new file when file.created event received', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() =>
        useFiles({ connection: mockConnection, sessionId })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Simulate file.created event
      const fileCreatedHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'file.created'
      )[1];

      const newFile = {
        id: 'file-2',
        filename: 'new.md',
        size: 2048,
        status: 'new',
        sessionId,
        mimeType: 'text/markdown',
      };

      act(() => {
        fileCreatedHandler({ file: newFile, sessionId });
      });

      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0]).toMatchObject(newFile);
      expect(result.current.newFilesCount).toBe(1);
    });

    it('should update file when file.modified event received', async () => {
      const initialFile = {
        id: 'file-1',
        filename: 'test.md',
        size: 1024,
        status: 'new' as const,
        mimeType: 'text/markdown',
        currentVersion: '1.0.0',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [initialFile],
      });

      const { result } = renderHook(() =>
        useFiles({ connection: mockConnection, sessionId })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Simulate file.modified event
      const fileModifiedHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'file.modified'
      )[1];

      act(() => {
        fileModifiedHandler({
          fileId: 'file-1',
          sessionId,
          status: 'modified',
          size: 2048,
        });
      });

      expect(result.current.files[0].status).toBe('modified');
      expect(result.current.files[0].size).toBe(2048);
    });

    it('should remove file when file.deleted event received', async () => {
      const initialFiles = [
        {
          id: 'file-1',
          filename: 'test.md',
          size: 1024,
          status: 'new' as const,
          mimeType: 'text/markdown',
        },
        {
          id: 'file-2',
          filename: 'another.md',
          size: 2048,
          status: 'synced' as const,
          mimeType: 'text/markdown',
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => initialFiles,
      });

      const { result } = renderHook(() =>
        useFiles({ connection: mockConnection, sessionId })
      );

      await waitFor(() => {
        expect(result.current.files).toHaveLength(2);
      });

      // Simulate file.deleted event
      const fileDeletedHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'file.deleted'
      )[1];

      act(() => {
        fileDeletedHandler({ fileId: 'file-1', sessionId });
      });

      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0].id).toBe('file-2');
    });
  });

  describe('Badge State Management', () => {
    it('should track new files count', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 'file-1', status: 'new', filename: 'a.md', size: 100 },
          { id: 'file-2', status: 'new', filename: 'b.md', size: 200 },
          { id: 'file-3', status: 'synced', filename: 'c.md', size: 300 },
        ],
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
      const files = [
        { id: 'file-1', status: 'new', filename: 'test.md', size: 100 },
      ];

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => files,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...files[0], status: 'synced' }),
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
      const files = [
        { id: 'file-1', status: 'new', filename: 'a.md', size: 100 },
        { id: 'file-2', status: 'modified', filename: 'b.md', size: 200 },
      ];

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => files,
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
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'file-new',
            filename: 'upload.pdf',
            size: 5000,
            status: 'new',
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
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            { id: 'file-1', filename: 'test.md', size: 1024 },
          ],
        })
        .mockResolvedValueOnce({
          ok: true,
          blob: async () => new Blob(['file content']),
          headers: {
            get: () => 'attachment; filename="test.md"',
          },
        });

      // Mock URL.createObjectURL and revokeObjectURL
      global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = jest.fn();

      // Mock document.createElement and click
      const mockLink = {
        href: '',
        download: '',
        click: jest.fn(),
      };
      jest.spyOn(document, 'createElement').mockReturnValue(mockLink as any);

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
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
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
      ).rejects.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('should remove socket listeners on unmount', () => {
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
      expect(mockSocket.off).toHaveBeenCalledWith(
        'file.deleted',
        expect.any(Function)
      );
    });
  });
});
