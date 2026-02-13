/**
 * 格式化毫秒为友好的时间字符串
 * @param ms 毫秒数
 * @returns "30s" | "1m 5s" | "2m"
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)

  if (totalSeconds < 60) {
    return `${totalSeconds}s`
  }

  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`
}
