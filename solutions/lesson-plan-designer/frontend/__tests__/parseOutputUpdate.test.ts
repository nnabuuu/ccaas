import { describe, it, expect } from 'vitest'
import { parseOutputUpdateEvent } from '../src/utils/outputUpdateParser'
import type { OutputUpdateEvent } from '@ccaas/shared'
import type { SyncField } from '../src/types'

describe('parseOutputUpdateEvent', () => {
  it('should parse nested output_update event with data field', () => {
    // Backend sends this structure via write_output MCP tool
    const event: OutputUpdateEvent = {
      type: 'output_update',
      sessionId: 'test-session',
      clientId: 'test-client',
      payload: {
        data: {
          field: 'objectives',
          value: [{ id: 'obj-1', description: '学习目标1' }],
          preview: '1个教学目标',
        },
        status: 'success',
      },
    }

    const result = parseOutputUpdateEvent(event)

    expect(result).not.toBeNull()
    expect(result?.field).toBe('objectives')
    expect(result?.value).toEqual([{ id: 'obj-1', description: '学习目标1' }])
    expect(result?.preview).toBe('1个教学目标')
    expect(result?.synced).toBe(false)
  })

  it('should parse event with top-level payload field (alternative format)', () => {
    // Alternative format: field directly in payload
    const event: OutputUpdateEvent = {
      type: 'output_update',
      sessionId: 'test-session',
      payload: {
        field: 'title',
        value: 'New Title',
      },
    }

    const result = parseOutputUpdateEvent(event)

    expect(result).not.toBeNull()
    expect(result?.field).toBe('title')
    expect(result?.value).toBe('New Title')
  })

  it('should return null for missing field', () => {
    const event: OutputUpdateEvent = {
      type: 'output_update',
      sessionId: 'test-session',
      payload: {
        status: 'error',
      },
    }

    const result = parseOutputUpdateEvent(event)
    expect(result).toBeNull()
  })

  it('should provide default preview if missing', () => {
    const event: OutputUpdateEvent = {
      type: 'output_update',
      sessionId: 'test-session',
      payload: {
        data: {
          field: 'title',
          value: 'New Title',
        },
      },
    }

    const result = parseOutputUpdateEvent(event)

    expect(result).not.toBeNull()
    expect(result?.preview).toBe('更新 title')
  })

  it('should handle all sync field types', () => {
    const syncFields: SyncField[] = [
      'title', 'subject', 'gradeLevel', 'duration',
      'publisher', 'volume', 'chapterId', 'chapterTitle',
      'objectives', 'standards', 'materials', 'activities',
      'assessment', 'differentiation'
    ]

    for (const field of syncFields) {
      const event: OutputUpdateEvent = {
        type: 'output_update',
        sessionId: 'test-session',
        payload: {
          data: {
            field,
            value: `test-value-for-${field}`,
            preview: `Preview for ${field}`,
          },
        },
      }

      const result = parseOutputUpdateEvent(event)
      expect(result).not.toBeNull()
      expect(result?.field).toBe(field)
    }
  })

  it('should handle complex nested value objects', () => {
    const complexValue = {
      formative: ['观察学生参与度', '课堂提问'],
      summative: ['单元测验'],
      rubric: '评分标准详情',
    }

    const event: OutputUpdateEvent = {
      type: 'output_update',
      sessionId: 'test-session',
      payload: {
        data: {
          field: 'assessment',
          value: complexValue,
          preview: '评估方案',
        },
      },
    }

    const result = parseOutputUpdateEvent(event)

    expect(result).not.toBeNull()
    expect(result?.value).toEqual(complexValue)
  })
})
