/**
 * Format utilities for admin dashboard
 */

/**
 * Format duration in milliseconds to human-readable string
 * @param ms - Duration in milliseconds
 * @returns Formatted string (e.g., "2m 30s", "45s", "1h 5m")
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return 'N/A'

  const totalSeconds = Math.floor(ms / 1000)

  // Less than 1 minute
  if (totalSeconds < 60) {
    return `${totalSeconds}s`
  }

  // Less than 1 hour
  if (totalSeconds < 3600) {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`
  }

  // 1 hour or more
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
}

/**
 * Format number with thousand separators
 * @param value - Number to format
 * @returns Formatted string (e.g., "1,234,567")
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

/**
 * Format token count with K/M suffix
 * @param tokens - Token count
 * @returns Formatted string (e.g., "1.2K", "3.5M")
 */
export function formatTokens(tokens: number): string {
  if (tokens === 0) return '0'
  if (tokens < 1000) return tokens.toString()
  if (tokens < 1_000_000) return `${(tokens / 1000).toFixed(1)}K`
  return `${(tokens / 1_000_000).toFixed(1)}M`
}

/**
 * Format cost in USD
 * @param dollars - Cost in dollars (not cents)
 * @param precision - Number of decimal places (default: 2)
 * @returns Formatted string (e.g., "$0.15", "$1.23")
 */
export function formatCost(dollars: number, precision: number = 2): string {
  if (dollars === 0) return '$0.00'
  return `$${dollars.toFixed(precision)}`
}
