/**
 * useSkills Hook Tests
 *
 * Tests for skill management hook including:
 * - Fetching skills on mount
 * - Toggle skill via PATCH
 * - Error re-throw on toggle failure
 * - Search/filter functionality
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useSkills } from '../src/hooks/useSkills';
import { vi } from 'vitest';

global.fetch = vi.fn() as any;

const serverUrl = 'http://localhost:3001';
const tenantId = 'tenant-123';
const apiKey = 'test-api-key';

const mockSkills = [
  { id: 's1', name: 'Greeting', slug: 'greeting', description: 'Say hello', type: 'skill', enabled: true, version: 1, content: '', status: 'published', createdAt: '', updatedAt: '' },
  { id: 's2', name: 'Farewell', slug: 'farewell', description: 'Say goodbye', type: 'skill', enabled: false, version: 1, content: '', status: 'published', createdAt: '', updatedAt: '' },
];

beforeEach(() => {
  vi.clearAllMocks();
  (global.fetch as ReturnType<typeof vi.fn>).mockClear();
});

describe('useSkills', () => {
  it('should fetch skills on mount', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSkills,
    });

    const { result } = renderHook(() =>
      useSkills({ serverUrl, tenantId, apiKey }),
    );

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.skills).toHaveLength(2);
    expect(result.current.skills[0].name).toBe('Greeting');
    expect(global.fetch).toHaveBeenCalledWith(
      `${serverUrl}/api/v1/skills`,
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Tenant-Id': tenantId,
          'X-API-Key': apiKey,
        }),
      }),
    );
  });

  it('should toggle skill via PATCH and update local state', async () => {
    // Initial fetch
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSkills,
    });

    const { result } = renderHook(() =>
      useSkills({ serverUrl, tenantId, apiKey }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Toggle PATCH
    const toggledSkill = { ...mockSkills[0], enabled: false };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => toggledSkill,
    });

    await act(async () => {
      await result.current.toggleSkill('s1');
    });

    // Verify PATCH was called
    expect(global.fetch).toHaveBeenCalledWith(
      `${serverUrl}/api/v1/skills/s1/toggle`,
      expect.objectContaining({ method: 'PATCH' }),
    );

    // Verify local state updated
    expect(result.current.skills.find(s => s.id === 's1')).toMatchObject({
      enabled: false,
    });
  });

  it('should re-throw toggle errors', async () => {
    // Initial fetch
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSkills,
    });

    const { result } = renderHook(() =>
      useSkills({ serverUrl, tenantId, apiKey }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Toggle returns 500
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    // toggleSkill should re-throw
    let caughtError: Error | undefined;
    await act(async () => {
      try {
        await result.current.toggleSkill('s1');
      } catch (err) {
        caughtError = err as Error;
      }
    });

    expect(caughtError).toBeDefined();
    expect(caughtError!.message).toBe('HTTP 500: Internal Server Error');

    // Error state should also be set
    await waitFor(() => {
      expect(result.current.error).toBe('HTTP 500: Internal Server Error');
    });
  });

  it('should filter skills by searchQuery', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSkills,
    });

    const { result } = renderHook(() =>
      useSkills({ serverUrl, tenantId, apiKey }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // All skills visible initially
    expect(result.current.filteredSkills).toHaveLength(2);

    // Set search query
    act(() => {
      result.current.setSearchQuery('greet');
    });

    // Only matching skill visible
    expect(result.current.filteredSkills).toHaveLength(1);
    expect(result.current.filteredSkills[0].slug).toBe('greeting');
  });
});
