/** Shared helpers for observe views */

export function pct(n: number, total: number): string {
  if (total === 0) return '0%'
  return `${Math.round((n / total) * 100)}%`
}

export function pctNum(n: number, total: number): number {
  if (total === 0) return 0
  return Math.round((n / total) * 100)
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

/** Map coordinate [-1,1] to percentage [0,100] for positioning */
export function coordToPct(n: number): number {
  return ((n + 1) / 2) * 100
}

/** Deviation-based color: low=green, mid=blue, high=red */
export function deviationColor(d: number): string {
  if (d < 0.3) return 'var(--green-dot)'
  if (d < 0.6) return 'var(--blue)'
  return 'var(--red)'
}

/** Matrix quality score helpers (0-3 scale) */
export const Q_COLORS = ['var(--t3)', 'var(--amber)', 'var(--blue)', 'var(--green)']
export const Q_BGS = ['var(--surface2)', 'var(--amber-soft)', 'var(--blue-soft)', 'var(--green-soft)']
export const Q_LABELS = ['未填', '基本', '良好', '优秀']
export function qColor(q: number): string { return Q_COLORS[q] || Q_COLORS[0] }
export function qBg(q: number): string { return Q_BGS[q] || Q_BGS[0] }
export function qLabel(q: number): string { return Q_LABELS[q] || Q_LABELS[0] }

/** Status card thresholds */
export function statusLevel(score: number): { level: 'green' | 'blue' | 'amber' | 'red'; title: string } {
  if (score >= 90) return { level: 'green', title: '表现优秀' }
  if (score >= 70) return { level: 'blue', title: '大部分正确' }
  if (score >= 40) return { level: 'amber', title: '需要关注' }
  return { level: 'red', title: '需重点关注' }
}
