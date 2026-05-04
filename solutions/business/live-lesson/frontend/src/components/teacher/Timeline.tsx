import { useRef, useCallback, useState } from 'react'
import type { ReadingStep } from '../../types/reading'
import type { StateSnapshot } from '../../hooks/useClassroom'

interface TimelineProps {
  steps: ReadingStep[]
  snapshots: StateSnapshot[]
  sessionStartedAt: number
  isLive: boolean
  seekTimestamp: number | null
  onSeek: (snapshot: StateSnapshot | null) => void
}

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function findNearestSnapshot(snapshots: StateSnapshot[], targetTs: number): StateSnapshot | null {
  if (snapshots.length === 0) return null
  let lo = 0, hi = snapshots.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (snapshots[mid].timestamp <= targetTs) lo = mid
    else hi = mid - 1
  }
  return snapshots[lo]
}

export function Timeline({ steps, snapshots, sessionStartedAt, isLive, seekTimestamp, onSeek }: TimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const [hoverPct, setHoverPct] = useState<number | null>(null)

  const now = Date.now()
  const elapsed = now - sessionStartedAt
  const endTs = snapshots.length > 0 ? Math.max(snapshots[snapshots.length - 1].timestamp, now) : now
  const range = endTs - sessionStartedAt

  // Current position as percentage
  const thumbPct = isLive
    ? 100
    : seekTimestamp != null && range > 0
      ? Math.min(100, Math.max(0, ((seekTimestamp - sessionStartedAt) / range) * 100))
      : 100

  const elapsedDisplay = isLive
    ? formatTime(elapsed)
    : seekTimestamp != null
      ? formatTime(seekTimestamp - sessionStartedAt)
      : formatTime(elapsed)

  const totalDuration = steps.reduce((sum, s) => sum + (s.duration || 0), 0)

  const pctToTimestamp = useCallback((pct: number) => {
    const clamped = Math.min(100, Math.max(0, pct))
    return sessionStartedAt + (clamped / 100) * (endTs - sessionStartedAt)
  }, [sessionStartedAt, endTs])

  const getPointerPct = useCallback((clientX: number) => {
    const track = trackRef.current
    if (!track) return 0
    const rect = track.getBoundingClientRect()
    return ((clientX - rect.left) / rect.width) * 100
  }, [])

  const handleSeekAt = useCallback((pct: number) => {
    const ts = pctToTimestamp(pct)
    const snap = findNearestSnapshot(snapshots, ts)
    if (snap) onSeek(snap)
  }, [pctToTimestamp, snapshots, onSeek])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    setDragging(true)
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    const pct = getPointerPct(e.clientX)
    handleSeekAt(pct)
  }, [getPointerPct, handleSeekAt])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const pct = getPointerPct(e.clientX)
    if (dragging) {
      handleSeekAt(pct)
    } else {
      setHoverPct(pct)
    }
  }, [dragging, getPointerPct, handleSeekAt])

  const handlePointerUp = useCallback(() => {
    setDragging(false)
  }, [])

  const handlePointerLeave = useCallback(() => {
    setHoverPct(null)
  }, [])

  const handleGoLive = useCallback(() => {
    onSeek(null)
  }, [onSeek])

  // Step markers — evenly spaced as visual dividers
  const markers = steps.map((_, i) => ((i + 1) / steps.length) * 100)

  return (
    <div className={`timeline${!isLive ? ' replay' : ''}`}>
      <div className="tl-time">{elapsedDisplay}</div>
      <div
        className="tl-track-wrap"
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
      >
        <div className="tl-track">
          {markers.slice(0, -1).map((pos, i) => (
            <div key={i} className="tl-marker task" style={{ left: `${pos}%` }} />
          ))}
          <div className="tl-fill" style={{ width: `${thumbPct}%` }} />
        </div>
        <div
          className={`tl-thumb${dragging ? ' dragging' : ''}`}
          style={{ left: `${thumbPct}%` }}
        />
        {hoverPct != null && !dragging && (
          <div className="tl-hover-tip" style={{ left: `${hoverPct}%` }}>
            {formatTime(pctToTimestamp(hoverPct) - sessionStartedAt)}
          </div>
        )}
      </div>
      <div className="tl-total">{totalDuration}:00</div>
      {isLive ? (
        <div className="tl-label live">实时</div>
      ) : (
        <div className="tl-label replay" onClick={handleGoLive}>回到实时</div>
      )}
    </div>
  )
}
