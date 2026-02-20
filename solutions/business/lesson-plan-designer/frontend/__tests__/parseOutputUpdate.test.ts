import { describe, it, expect } from 'vitest'
import { parseOutputUpdateEvent } from '../src/utils/outputUpdateParser'
import type { OutputUpdateEvent } from '@kedge-agentic/common'
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
          value: '1. 学习目标1\n2. 学习目标2',
          preview: '2个学习目标',
        },
        status: 'success',
      },
    }

    const result = parseOutputUpdateEvent(event)

    expect(result).not.toBeNull()
    expect(result?.field).toBe('objectives')
    expect(result?.value).toBe('1. 学习目标1\n2. 学习目标2')
    expect(result?.preview).toBe('2个学习目标')
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
      'title', 'subject', 'gradeLevel', 'durationMinutes', 'lessonPlanCode',
      'objectives', 'content', 'teachingMethods', 'materialsNeeded',
      'assessmentMethods', 'curriculumRequirements', 'studentAnalysis',
      'extraProperties', 'status'
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

  it('should handle extraProperties record value', () => {
    const extraProps = {
      '教材分析': '本课是分数单元的第一课',
      '课件': 'PPT 12页',
    }

    const event: OutputUpdateEvent = {
      type: 'output_update',
      sessionId: 'test-session',
      payload: {
        data: {
          field: 'extraProperties',
          value: extraProps,
          preview: '2个额外属性',
        },
      },
    }

    const result = parseOutputUpdateEvent(event)

    expect(result).not.toBeNull()
    expect(result?.value).toEqual(extraProps)
  })
})
