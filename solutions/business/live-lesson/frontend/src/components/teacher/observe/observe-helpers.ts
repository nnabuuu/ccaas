/** Shared helpers for observe views */

export function pct(n: number, total: number): string {
  if (total === 0) return '0%'
  return `${Math.round((n / total) * 100)}%`
}

export function severityColor(severity: string): string {
  switch (severity) {
    case 'high': return 'var(--red)'
    case 'medium': return 'var(--amber)'
    case 'low': return 'var(--t3)'
    default: return 'var(--t3)'
  }
}

export function severityBg(severity: string): string {
  switch (severity) {
    case 'high': return 'var(--red-soft)'
    case 'medium': return 'var(--amber-soft)'
    case 'low': return 'var(--surface2)'
    default: return 'var(--surface2)'
  }
}

export function scoreColor(score: number): string {
  if (score >= 80) return 'var(--green)'
  if (score >= 50) return 'var(--amber)'
  return 'var(--red)'
}

export function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
