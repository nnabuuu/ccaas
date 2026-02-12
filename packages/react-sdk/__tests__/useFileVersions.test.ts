/**
 * useFileVersions Hook Tests
 *
 * Tests for file version management hook including:
 * - Version fetching and state management
 * - Version creation and rollback
 * - Version comparison
 * - Version download
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useFileVersions } from '../src/hooks/useFileVersions';
import type { UseAgentConnectionReturn, FileMetadata } from '../src/types';

// Mock fetch
global.fetch = jest.fn();

describe('useFileVersions', () => {
  let mockConnection: UseAgentConnectionReturn;
  const fileId = 'file-123';
  const mockFile: FileMetadata = {
    id: fileId,
    filename: 'test.md',
    size: 1024,
    status: 'synced',
    mimeType: 'text/markdown',
    currentVersion: '1.0.1',
    lastVersionAt: new Date('2024-01-15'),
    createdAt: new Date('2024-01-01'),
    uploadedBy: 'user',
    sessionId: 'session-123',
    tenantId: 'tenant-123',
    messageId: 'msg-123',
    originalPath: '/test.md',
    storedPath: '/storage/test.md',
    downloadedAt: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();

    mockConnection = {
      socket: {} as any,
      serverUrl: 'http://localhost:3001',
      tenantId: 'tenant-123',
      connectionState: 'connected',
      isConnected: true,
      error: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
    };
  });

  describe('Fetching Versions', () => {
    it('should fetch versions on mount when enabled', async () => {
      const mockVersions = [
        {
          id: 'v1',
          fileId,
          version: '1.0.1',
          size: 1024,
          changelog: 'Updated content',
          createdAt: new Date('2024-01-15'),
        },
        {
          id: 'v0',
          fileId,
          version: '1.0.0',
          size: 512,
          changelog: 'Initial version',
          createdAt: new Date('2024-01-01'),
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockVersions,
      });

      const { result } = renderHook(() =>
        useFileVersions({
          connection: mockConnection,
          fileId,
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.versions).toEqual(mockVersions);
      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:3001/api/v1/files/${fileId}/versions`,
        expect.any(Object)
      );
    });

    it('should not fetch when enabled is false', () => {
      renderHook(() =>
        useFileVersions({
          connection: mockConnection,
          fileId,
          enabled: false,
        })
      );

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should sort versions by createdAt descending', async () => {
      const mockVersions = [
        {
          id: 'v0',
          version: '1.0.0',
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'v2',
          version: '1.0.2',
          createdAt: new Date('2024-01-20'),
        },
        {
          id: 'v1',
          version: '1.0.1',
          createdAt: new Date('2024-01-15'),
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockVersions,
      });

      const { result } = renderHook(() =>
        useFileVersions({
          connection: mockConnection,
          fileId,
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(result.current.versions).toHaveLength(3);
      });

      // Should be sorted: 1.0.2, 1.0.1, 1.0.0
      expect(result.current.versions[0].version).toBe('1.0.2');
      expect(result.current.versions[1].version).toBe('1.0.1');
      expect(result.current.versions[2].version).toBe('1.0.0');
    });
  });

  describe('Creating Versions', () => {
    it('should create a new version', async () => {
      const newVersion = {
        id: 'v-new',
        fileId,
        version: '1.0.2',
        size: 2048,
        changelog: 'Added feature',
        createdAt: new Date(),
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [], // Initial empty versions
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => newVersion,
        });

      const { result } = renderHook(() =>
        useFileVersions({
          connection: mockConnection,
          fileId,
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let createdVersion;
      await act(async () => {
        createdVersion = await result.current.createVersion(
          'Added feature'
        );
      });

      expect(createdVersion).toMatchObject(newVersion);
      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:3001/api/v1/files/${fileId}/versions`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ changelog: 'Added feature' }),
        })
      );
    });

    it('should handle create version error', async () => {
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
        useFileVersions({
          connection: mockConnection,
          fileId,
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.createVersion('Test');
        })
      ).rejects.toThrow();
    });
  });

  describe('Rolling Back Versions', () => {
    it('should rollback to target version', async () => {
      const mockVersions = [
        { id: 'v2', version: '1.0.2', createdAt: new Date('2024-01-20') },
        { id: 'v1', version: '1.0.1', createdAt: new Date('2024-01-15') },
        { id: 'v0', version: '1.0.0', createdAt: new Date('2024-01-01') },
      ];

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockVersions,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ...mockFile,
            currentVersion: '1.0.3',
            status: 'modified',
          }),
        });

      const { result } = renderHook(() =>
        useFileVersions({
          connection: mockConnection,
          fileId,
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(result.current.versions).toHaveLength(3);
      });

      await act(async () => {
        await result.current.rollbackToVersion('1.0.0');
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:3001/api/v1/files/${fileId}/rollback`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ targetVersion: '1.0.0' }),
        })
      );
    });

    it('should handle rollback error', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: false,
          statusText: 'Not Found',
        });

      const { result } = renderHook(() =>
        useFileVersions({
          connection: mockConnection,
          fileId,
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.rollbackToVersion('1.0.0');
        })
      ).rejects.toThrow();
    });
  });

  describe('Comparing Versions', () => {
    it('should compare two versions', async () => {
      const comparison = {
        from: { version: '1.0.0', size: 512, contentHash: 'abc123' },
        to: { version: '1.0.1', size: 1024, contentHash: 'def456' },
        sizeDiff: 512,
        hashChanged: true,
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => comparison,
        });

      const { result } = renderHook(() =>
        useFileVersions({
          connection: mockConnection,
          fileId,
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let comparisonResult;
      await act(async () => {
        comparisonResult = await result.current.compareVersions(
          '1.0.0',
          '1.0.1'
        );
      });

      expect(comparisonResult).toEqual(comparison);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(
          `/api/v1/files/${fileId}/versions/compare?from=1.0.0&to=1.0.1`
        ),
        expect.any(Object)
      );
    });

    it('should detect identical versions (same hash)', async () => {
      const comparison = {
        from: { version: '1.0.0', size: 512, contentHash: 'abc123' },
        to: { version: '1.0.1', size: 512, contentHash: 'abc123' },
        sizeDiff: 0,
        hashChanged: false,
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => comparison,
        });

      const { result } = renderHook(() =>
        useFileVersions({
          connection: mockConnection,
          fileId,
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let comparisonResult;
      await act(async () => {
        comparisonResult = await result.current.compareVersions(
          '1.0.0',
          '1.0.1'
        );
      });

      expect(comparisonResult.hashChanged).toBe(false);
      expect(comparisonResult.sizeDiff).toBe(0);
    });
  });

  describe('Downloading Versions', () => {
    it('should download specific version', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          blob: async () => new Blob(['version content']),
          headers: {
            get: () => 'attachment; filename="test-1.0.0.md"',
          },
        });

      // Mock URL and document methods
      global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = jest.fn();
      const mockLink = {
        href: '',
        download: '',
        click: jest.fn(),
      };
      jest.spyOn(document, 'createElement').mockReturnValue(mockLink as any);

      const { result } = renderHook(() =>
        useFileVersions({
          connection: mockConnection,
          fileId,
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.downloadVersion('1.0.0');
      });

      expect(mockLink.click).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:3001/api/v1/files/${fileId}/versions/1.0.0/download`,
        expect.any(Object)
      );
    });
  });

  describe('Refetch', () => {
    it('should refetch versions when called', async () => {
      const initialVersions = [
        { id: 'v0', version: '1.0.0', createdAt: new Date() },
      ];
      const updatedVersions = [
        { id: 'v1', version: '1.0.1', createdAt: new Date() },
        { id: 'v0', version: '1.0.0', createdAt: new Date() },
      ];

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => initialVersions,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => updatedVersions,
        });

      const { result } = renderHook(() =>
        useFileVersions({
          connection: mockConnection,
          fileId,
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(result.current.versions).toHaveLength(1);
      });

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.versions).toHaveLength(2);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
});
