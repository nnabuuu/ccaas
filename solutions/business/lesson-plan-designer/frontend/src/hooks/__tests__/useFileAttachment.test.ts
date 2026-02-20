import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFileAttachment } from '../useFileAttachment'
import type { FileMetadata } from '@ccaas/react-sdk'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch as any

describe('useFileAttachment', () => {
  const lessonPlanId = 'test-plan-123'
  const mockFile: Partial<FileMetadata> = {
    id: 'file-123',
    filename: 'test-script.md',
    mimeType: 'text/markdown',
    size: 1024,
  }

  beforeEach(() => {
    mockFetch.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with correct default values', () => {
    const { result } = renderHook(() => useFileAttachment(lessonPlanId))

    expect(result.current.isAttaching).toBe(false)
    expect(result.current.error).toBe(null)
    expect(typeof result.current.attachFile).toBe('function')
  })

  it('should attach file successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    })

    const { result } = renderHook(() => useFileAttachment(lessonPlanId))

    let attachResult: any
    await act(async () => {
      attachResult = await result.current.attachFile(mockFile as FileMetadata)
    })

    expect(attachResult).toEqual({ success: true })
    expect(result.current.isAttaching).toBe(false)
    expect(result.current.error).toBe(null)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('should handle attach error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Internal server error' }),
    })

    const { result } = renderHook(() => useFileAttachment(lessonPlanId))

    let attachResult: any
    await act(async () => {
      attachResult = await result.current.attachFile(mockFile as FileMetadata)
    })

    expect(attachResult.success).toBe(false)
    expect(result.current.error).toContain('附加文件失败')
  })

  it('should infer correct file types', async () => {
    const testCases = [
      { mimeType: 'audio/mpeg', expected: 'audio' },
      { mimeType: 'application/vnd.ms-powerpoint', expected: 'ppt' },
      { mimeType: 'application/pdf', expected: 'pdf' },
      { mimeType: 'text/markdown', expected: 'script' },
      { mimeType: 'application/zip', expected: 'other' },
      { mimeType: null, expected: 'other' },
    ]

    for (const testCase of testCases) {
      mockFetch.mockClear()
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) })

      const { result } = renderHook(() => useFileAttachment(lessonPlanId))
      const testFile = { ...mockFile, mimeType: testCase.mimeType }

      await act(async () => {
        await result.current.attachFile(testFile as FileMetadata)
      })

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(requestBody.fileType).toBe(testCase.expected)
    }
  })
})
