interface ProgressBarProps {
  dist: { listen: number; practice: number; discuss: number; takeaway: number; completed: number }
  total: number
}

export function ProgressBar({ dist, total }: ProgressBarProps) {
  if (total === 0) return null
  const all = dist.listen + dist.practice + dist.discuss + dist.takeaway + dist.completed
  if (all === 0) return null
  const base = Math.max(all, total)
  const pct = (n: number) => `${(n / base) * 100}%`
  return (
    <div className="phase-bar" title={`Listen:${dist.listen} Practice:${dist.practice} Discuss:${dist.discuss} Takeaway:${dist.takeaway} Done:${dist.completed}`}>
      {dist.listen > 0 && <div className="pb-seg listen" style={{ width: pct(dist.listen) }} />}
      {dist.practice > 0 && <div className="pb-seg practice" style={{ width: pct(dist.practice) }} />}
      {dist.discuss > 0 && <div className="pb-seg discuss" style={{ width: pct(dist.discuss) }} />}
      {dist.takeaway > 0 && <div className="pb-seg takeaway" style={{ width: pct(dist.takeaway) }} />}
      {dist.completed > 0 && <div className="pb-seg completed" style={{ width: pct(dist.completed) }} />}
    </div>
  )
}
