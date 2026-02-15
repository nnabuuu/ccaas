import type { TokenUsage } from '../types'

export interface TokenBadgeProps {
  tokenUsage: TokenUsage
  variant?: 'compact' | 'detailed'
}

/**
 * TokenBadge - Display token usage information
 *
 * Shows input/output token counts in a compact or detailed format.
 *
 * @example
 * ```tsx
 * // Compact format (default)
 * <TokenBadge tokenUsage={{ inputTokens: 500, outputTokens: 988 }} />
 * // → "↓ 1,488 tokens"
 *
 * // Detailed format
 * <TokenBadge tokenUsage={{ inputTokens: 500, outputTokens: 988 }} variant="detailed" />
 * // → "↑ 500  ↓ 988"
 * ```
 */
export function TokenBadge({ tokenUsage, variant = 'compact' }: TokenBadgeProps) {
  const total = tokenUsage.inputTokens + tokenUsage.outputTokens

  if (variant === 'compact') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
          />
        </svg>
        {total.toLocaleString()} tokens
      </span>
    )
  }

  return (
    <div className="flex gap-3 text-xs text-gray-500">
      <span>↑ {tokenUsage.inputTokens.toLocaleString()}</span>
      <span>↓ {tokenUsage.outputTokens.toLocaleString()}</span>
      {tokenUsage.cacheReadTokens !== undefined && tokenUsage.cacheReadTokens > 0 && (
        <span className="text-green-600">📦 {tokenUsage.cacheReadTokens.toLocaleString()} cached</span>
      )}
    </div>
  )
}
