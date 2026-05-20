interface ProgressBarProps {
  dist: Record<string, number>
  phases: Array<{ id: string }>
  total: number
}

export function ProgressBar({ dist, phases, total }: ProgressBarProps) {
  if (total === 0) return null
  const all = Object.values(dist).reduce((a, b) => a + b, 0)
  if (all === 0) return null
  const base = Math.max(all, total)
  const pct = (n: number) => `${(n / base) * 100}%`

  const cssClass = (id: string) => {
    if (id === 'completed') return 'completed'
    if (id.startsWith('practice')) return 'practice'
    return id
  }

  const title = [...phases.map(p => `${p.id}:${dist[p.id] || 0}`), `done:${dist.completed || 0}`].join(' ')

  return (
    <div className="phase-bar" title={title}>
      {[...phases.map(p => p.id), 'completed'].map(id => {
        const n = dist[id] || 0
        return n > 0 ? <div key={id} className={`pb-seg ${cssClass(id)}`} style={{ width: pct(n) }} /> : null
      })}
    </div>
  )
}
