import { describe, it, expect } from 'vitest'
import { parseOutputUpdate } from '../src/utils/parseOutputUpdate'

describe('parseOutputUpdate', () => {
  it('should parse payload.data.field format (MCP tool)', () => {
    const event = {
      type: 'output_update' as const,
      sessionId: 'test-session',
      payload: {
        status: 'success',
        data: {
          field: 'objectives',
          value: [{ description: 'Learn math' }],
          preview: 'Updated objectives',
        },
      },
    }

    const result = parseOutputUpdate(event)
    expect(result).toEqual({
      field: 'objectives',
      value: [{ description: 'Learn math' }],
      preview: 'Updated objectives',
      synced: false,
    })
  })

  it('should parse payload.field format (generic)', () => {
    const event = {
      type: 'output_update' as const,
      sessionId: 'test-session',
      payload: {
        status: 'success',
        field: 'title',
        value: 'New Title',
      },
    }

    const result = parseOutputUpdate(event)
    expect(result).toEqual({
      field: 'title',
      value: 'New Title',
      preview: 'Update title',
      synced: false,
    })
  })

  it('should parse content blocks array format', () => {
    const event = {
      type: 'output_update' as const,
      sessionId: 'test-session',
      payload: {
        status: 'success',
        data: [
          {
            type: 'text',
            text: JSON.stringify({
              field: 'keyKnowledge',
              value: ['algebra', 'geometry'],
              preview: 'Key concepts',
            }),
          },
        ],
      },
    }

    const result = parseOutputUpdate(event)
    expect(result).toEqual({
      field: 'keyKnowledge',
      value: ['algebra', 'geometry'],
      preview: 'Key concepts',
      synced: false,
    })
  })

  it('should parse wrapped content block format { status, data: { field, ... } }', () => {
    const event = {
      type: 'output_update' as const,
      sessionId: 'test-session',
      payload: {
        status: 'success',
        data: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              data: {
                field: 'solutionSteps',
                value: ['Step 1', 'Step 2'],
                preview: 'Solution steps',
              },
            }),
          },
        ],
      },
    }

    const result = parseOutputUpdate(event)
    expect(result).toEqual({
      field: 'solutionSteps',
      value: ['Step 1', 'Step 2'],
      preview: 'Solution steps',
      synced: false,
    })
  })

  it('should return null for invalid event (no field)', () => {
    const event = {
      type: 'output_update' as const,
      sessionId: 'test-session',
      payload: {
        status: 'success',
        data: { random: 'stuff' },
      },
    }

    const result = parseOutputUpdate(event)
    expect(result).toBeNull()
  })

  it('should return null for empty payload', () => {
    const event = {
      type: 'output_update' as const,
      sessionId: 'test-session',
      payload: {
        status: 'success',
      },
    }

    const result = parseOutputUpdate(event)
    expect(result).toBeNull()
  })

  it('should use default preview when preview is missing', () => {
    const event = {
      type: 'output_update' as const,
      sessionId: 'test-session',
      payload: {
        status: 'success',
        data: {
          field: 'title',
          value: 'My Title',
        },
      },
    }

    const result = parseOutputUpdate(event)
    expect(result?.preview).toBe('Update title')
  })

  it('should handle non-JSON text in content blocks gracefully', () => {
    const event = {
      type: 'output_update' as const,
      sessionId: 'test-session',
      payload: {
        status: 'success',
        data: [
          { type: 'text', text: 'not valid json' },
        ],
      },
    }

    const result = parseOutputUpdate(event)
    expect(result).toBeNull()
  })
})
