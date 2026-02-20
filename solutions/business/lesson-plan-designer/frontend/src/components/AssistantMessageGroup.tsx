import type { SplitMessage } from '@kedge-agentic/react-sdk'
import type { MessageTokenUsage } from '../types'
import { SegmentBubble } from './SegmentBubble'

interface AssistantMessageGroupProps {
  splitMessage: SplitMessage
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function formatModelName(model: string): string {
  return model.replace('claude-', '').replace(/-\d+$/, '')
}

function TokenUsageFooter({ usage }: { usage: MessageTokenUsage }) {
  const cacheTokens = usage.cacheReadTokens ?? usage.cachedInputTokens ?? 0
  return (
    <div className="mt-1.5 pt-1.5 border-t border-gray-200/60 flex items-center gap-3 text-[11px] text-gray-400">
      {usage.model && <span>{formatModelName(usage.model)}</span>}
      <span>{'\u2193'}{formatTokens(usage.inputTokens)} {'\u2191'}{formatTokens(usage.outputTokens)}</span>
      {cacheTokens > 0 && (
        <span>{'\u26A1'}{formatTokens(cacheTokens)} cached</span>
      )}
      {usage.estimatedCostUsd !== undefined && (
        <span>${usage.estimatedCostUsd.toFixed(4)}</span>
      )}
    </div>
  )
}

/**
 * Renders a split assistant message as a group of segments.
 *
 * **Layout**:
 * - Avatar displayed once at the top
 * - Each segment rendered via SegmentBubble
 * - Token usage and timestamp displayed at the bottom
 *
 * **Example**:
 * ```
 * [Avatar] Segment 1 (text bubble)
 *          Segment 2 (tool cards, indented)
 *          Segment 3 (text bubble)
 *          ---
 *          Token Usage Footer
 *          Timestamp
 * ```
 */
export function AssistantMessageGroup({ splitMessage }: AssistantMessageGroupProps) {
  const { segments, tokenUsage, timestamp } = splitMessage

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%]">
        <div className="flex items-start gap-2">
          {/* Avatar */}
          <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gray-200 text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>

          <div className="flex-1">
            {/* Segments */}
            <div className="space-y-1">
              {segments.map((segment, index) => (
                <SegmentBubble
                  key={segment.id}
                  segment={segment}
                  isLast={index === segments.length - 1}
                />
              ))}
            </div>

            {/* Token Usage */}
            {tokenUsage && (
              <TokenUsageFooter usage={tokenUsage} />
            )}

            {/* Timestamp */}
            {timestamp && (
              <div className="mt-1 text-xs text-gray-400">
                {timestamp.toLocaleTimeString('zh-CN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
