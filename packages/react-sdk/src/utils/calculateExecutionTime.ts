/**
 * Calculate total execution time from content blocks containing tool activities
 */
import type { ContentBlock } from '../types'

/**
 * Calculate total execution time from content blocks
 * @param contentBlocks Message content blocks containing tool activities
 * @returns Total duration in milliseconds
 */
export function calculateExecutionTime(contentBlocks?: ContentBlock[]): number {
  if (!contentBlocks) return 0

  let totalDuration = 0
  for (const block of contentBlocks) {
    if (block.type === 'tool' && block.tool.duration) {
      totalDuration += block.tool.duration
    }
  }

  return totalDuration
}
