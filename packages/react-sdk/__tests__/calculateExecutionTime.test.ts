/**
 * Tests for calculateExecutionTime utility
 */
import { describe, it, expect } from 'vitest'
import { calculateExecutionTime } from '../src/utils/calculateExecutionTime'
import type { ContentBlock } from '../src/types'

describe('calculateExecutionTime', () => {
  it('should return 0 for undefined contentBlocks', () => {
    expect(calculateExecutionTime(undefined)).toBe(0)
  })

  it('should return 0 for empty contentBlocks array', () => {
    expect(calculateExecutionTime([])).toBe(0)
  })

  it('should return 0 for contentBlocks with only text blocks', () => {
    const blocks: ContentBlock[] = [
      { type: 'text', text: 'Hello' },
      { type: 'text', text: 'World' },
    ]
    expect(calculateExecutionTime(blocks)).toBe(0)
  })

  it('should sum durations from tool blocks', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'tool',
        tool: {
          toolName: 'Read',
          toolId: '1',
          phase: 'end',
          timestamp: new Date(),
          duration: 1000,
        },
      },
      {
        type: 'tool',
        tool: {
          toolName: 'Write',
          toolId: '2',
          phase: 'end',
          timestamp: new Date(),
          duration: 2000,
        },
      },
    ]
    expect(calculateExecutionTime(blocks)).toBe(3000)
  })

  it('should handle mixed text and tool blocks', () => {
    const blocks: ContentBlock[] = [
      { type: 'text', text: 'Starting...' },
      {
        type: 'tool',
        tool: {
          toolName: 'Bash',
          toolId: '1',
          phase: 'end',
          timestamp: new Date(),
          duration: 500,
        },
      },
      { type: 'text', text: 'Middle text' },
      {
        type: 'tool',
        tool: {
          toolName: 'Read',
          toolId: '2',
          phase: 'end',
          timestamp: new Date(),
          duration: 1500,
        },
      },
      { type: 'text', text: 'Done!' },
    ]
    expect(calculateExecutionTime(blocks)).toBe(2000)
  })

  it('should ignore tool blocks without duration', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'tool',
        tool: {
          toolName: 'Read',
          toolId: '1',
          phase: 'start',  // Start phase typically has no duration
          timestamp: new Date(),
        },
      },
      {
        type: 'tool',
        tool: {
          toolName: 'Write',
          toolId: '2',
          phase: 'end',
          timestamp: new Date(),
          duration: 1000,
        },
      },
    ]
    expect(calculateExecutionTime(blocks)).toBe(1000)
  })

  it('should handle tool blocks with zero duration', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'tool',
        tool: {
          toolName: 'Bash',
          toolId: '1',
          phase: 'end',
          timestamp: new Date(),
          duration: 0,
        },
      },
      {
        type: 'tool',
        tool: {
          toolName: 'Read',
          toolId: '2',
          phase: 'end',
          timestamp: new Date(),
          duration: 500,
        },
      },
    ]
    expect(calculateExecutionTime(blocks)).toBe(500)
  })

  it('should handle large numbers of tool blocks', () => {
    const blocks: ContentBlock[] = Array.from({ length: 100 }, (_, i) => ({
      type: 'tool' as const,
      tool: {
        toolName: 'Task',
        toolId: String(i),
        phase: 'end' as const,
        timestamp: new Date(),
        duration: 100,
      },
    }))
    expect(calculateExecutionTime(blocks)).toBe(10000)
  })

  it('should accumulate fractional milliseconds correctly', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'tool',
        tool: {
          toolName: 'Read',
          toolId: '1',
          phase: 'end',
          timestamp: new Date(),
          duration: 123.45,
        },
      },
      {
        type: 'tool',
        tool: {
          toolName: 'Write',
          toolId: '2',
          phase: 'end',
          timestamp: new Date(),
          duration: 456.78,
        },
      },
    ]
    expect(calculateExecutionTime(blocks)).toBeCloseTo(580.23, 2)
  })
})
