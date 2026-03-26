/**
 * Format an ISO timestamp as a relative time string (Chinese localized).
 * Returns empty string for invalid input.
 */
export function formatRelativeTime(iso: string): string {
  const date = new Date(iso)
  if (isNaN(date.getTime())) return ''

  const now = Date.now()
  const diffMs = now - date.getTime()

  if (diffMs < 0) return ''
  if (diffMs < 60_000) return '刚刚'

  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 60) return `${diffMin} 分钟前`

  const diffHour = Math.floor(diffMs / 3_600_000)
  if (diffHour < 24) return `${diffHour} 小时前`

  const diffDay = Math.floor(diffMs / 86_400_000)
  if (diffDay < 30) return `${diffDay} 天前`

  const diffMonth = Math.floor(diffDay / 30)
  if (diffMonth < 12) return `${diffMonth} 个月前`

  const diffYear = Math.floor(diffDay / 365)
  return `${diffYear} 年前`
}
