/**
 * 格式化毫秒为友好的时间字符串
 * @param ms 毫秒数（负数或 NaN 将被视为 0）
 * @returns "30s" | "1m 5s" | "2m"
 */
export function formatDuration(ms: number): string {
  // Handle negative or invalid values
  if (!Number.isFinite(ms) || ms < 0) {
    return '0s'
  }

  const totalSeconds = Math.floor(ms / 1000)

  if (totalSeconds < 60) {
    return `${totalSeconds}s`
  }

  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`
}
