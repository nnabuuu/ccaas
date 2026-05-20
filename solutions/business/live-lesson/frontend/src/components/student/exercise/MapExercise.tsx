import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import MapGuide from './MapGuide'
import { readGuideSeen, markGuideSeen } from './guide-helpers'
import { useReviewRestore, type ReviewData } from '../../../hooks/useReviewRestore'


interface MapAxis { neg: string; pos: string; label: string }
interface MapItem { id: string; label: string; hint?: string; refs?: number[] }

interface Props {
  prompt: string
  axes: { x: MapAxis; y: MapAxis }
  mapItems: MapItem[]
  minReasonLength: number
  ans: Record<string, any>
  setAns: (fn: (a: Record<string, any>) => Record<string, any>) => void
  allDone: boolean
  feedback?: string | null
  onActiveChange?: (paraRefs: number[]) => void
  givenPlacements?: Record<string, { x: number; y: number }>
  practiceCount?: number
  practiceItemIds?: string[]
  itemResults?: Record<string, { correct: boolean; hint?: string }>
  reviewData?: ReviewData
}

type Placements = Record<string, { x: number; y: number }>
type Reasons = Record<string, string>

function quadrantLabel(val: number, axis: MapAxis): string {
  if (val > 0.15) return axis.pos
  if (val < -0.15) return axis.neg
  return 'Neutral'
}

export function parseMapReview(review: ReviewData) {
  const { data, checkItems } = review
  const ans = {
    placements: data.placements || {},
    reasons: data.reasons || {},
  }
  let feedback: string | null = null
  const itemResults: Record<string, { correct: boolean; hint?: string }> = {}
  checkItems?.forEach(it => {
    if (it.idx === '_llm') { feedback = it.hint ?? null; return }
    itemResults[it.idx as string] = { correct: it.correct, hint: it.hint }
  })
  return { state: { ans, feedback, itemResults }, allDone: true }
}

export function MapExercise({ prompt, axes, mapItems, minReasonLength, ans, setAns, allDone, feedback, onActiveChange, givenPlacements, practiceCount, practiceItemIds, itemResults, reviewData }: Props) {
  const restored = useReviewRestore(reviewData, parseMapReview)
  const effectiveAns = restored?.ans ?? ans
  const effectiveFeedback = restored?.feedback ?? feedback
  const effectiveItemResults = restored?.itemResults ?? itemResults
  const effectiveAllDone = restored ? true : allDone

  const placements: Placements = effectiveAns.placements || {}
  const reasons: Reasons = effectiveAns.reasons || {}
  const [activeId, setActiveId] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [guideOpen, setGuideOpen] = useState(false)
  const guideSeen = useRef(readGuideSeen('guide-seen-map'))
  const planeRef = useRef<HTMLDivElement>(null)
  const hasDragged = useRef(false)

  // Inject practiceItemIds into ans for submission to grader
  useEffect(() => {
    if (practiceItemIds && !ans.practiceItemIds) {
      setAns(prev => ({ ...prev, practiceItemIds }))
    }
  }, [practiceItemIds, ans.practiceItemIds, setAns])

  // Split items into practice (tray) and given (pre-placed)
  const givenIds = useMemo(
    () => new Set(givenPlacements ? Object.keys(givenPlacements) : []),
    [givenPlacements],
  )
  const practiceItemIdSet = useMemo(
    () => practiceItemIds ? new Set(practiceItemIds) : null,
    [practiceItemIds],
  )
  const practiceItems = practiceItemIdSet
    ? mapItems.filter(it => practiceItemIdSet.has(it.id))
    : practiceCount
      ? mapItems.slice(0, practiceCount)
      : mapItems.filter(it => !givenIds.has(it.id))
  const givenItems = practiceItemIdSet
    ? mapItems.filter(it => !practiceItemIdSet.has(it.id))
    : practiceCount
      ? mapItems.slice(practiceCount)
      : mapItems.filter(it => givenIds.has(it.id))

  const unplaced = practiceItems.filter(it => !placements[it.id])
  const placed = practiceItems.filter(it => !!placements[it.id])
  const reasonedCount = placed.filter(it => (reasons[it.id] || '').trim().length >= minReasonLength).length

  // Fire onActiveChange when activeId or pendingTrayChip changes
  const [pendingTrayChip, setPendingTrayChip] = useState<string | null>(null)

  // Auto-select when only 1 practice item configured (avoids confusing 2-step flow)
  useEffect(() => {
    if (practiceItems.length === 1 && unplaced.length === 1 && !pendingTrayChip && !effectiveAllDone) {
      setPendingTrayChip(unplaced[0].id)
      setActiveId(unplaced[0].id)
    }
  }, [practiceItems.length, unplaced.length, pendingTrayChip, effectiveAllDone])

  const onActiveChangeRef = useRef(onActiveChange)
  onActiveChangeRef.current = onActiveChange

  useEffect(() => {
    const cb = onActiveChangeRef.current
    if (!cb) return
    const selectedId = pendingTrayChip || activeId
    if (selectedId) {
      const item = mapItems.find(it => it.id === selectedId)
      if (item?.refs?.length) {
        cb(item.refs)
        return () => { onActiveChangeRef.current?.([]) }
      }
    }
    cb([])
    return undefined
  }, [activeId, pendingTrayChip, mapItems])

  const updatePlacements = useCallback((id: string, x: number, y: number) => {
    setAns(a => ({
      ...a,
      placements: { ...(a.placements || {}), [id]: { x: clamp(x), y: clamp(y) } },
    }))
  }, [setAns])

  const removePlacement = useCallback((id: string) => {
    setAns(a => {
      const p = { ...(a.placements || {}) }
      const r = { ...(a.reasons || {}) }
      delete p[id]
      delete r[id]
      return { ...a, placements: p, reasons: r }
    })
    setActiveId(null)
  }, [setAns])

  const setReason = useCallback((id: string, text: string) => {
    setAns(a => ({
      ...a,
      reasons: { ...(a.reasons || {}), [id]: text },
    }))
  }, [setAns])

  // Convert pointer position to normalized [-1, 1] coords (y inverted: up = positive)
  const pointerToCoords = useCallback((clientX: number, clientY: number) => {
    const rect = planeRef.current?.getBoundingClientRect()
    if (!rect) return null
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1
    const ny = -(((clientY - rect.top) / rect.height) * 2 - 1) // invert y
    return { x: clamp(nx), y: clamp(ny) }
  }, [])

  // Drag handling via pointer events
  const handlePlanePointerDown = useCallback((e: React.PointerEvent) => {
    if (effectiveAllDone) return
    hasDragged.current = false
    // Only start drag if clicking on a placed chip
    const chipEl = (e.target as HTMLElement).closest('[data-chip-id]')
    if (!chipEl) return
    const id = chipEl.getAttribute('data-chip-id')!
    // Don't allow dragging given items
    if (givenIds.has(id)) return
    setDragging(id)
    setActiveId(id)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    e.preventDefault()
  }, [effectiveAllDone, givenIds])

  const handlePlanePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return
    hasDragged.current = true
    const coords = pointerToCoords(e.clientX, e.clientY)
    if (coords) updatePlacements(dragging, coords.x, coords.y)
  }, [dragging, pointerToCoords, updatePlacements])

  const handlePlanePointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragging) return
    // If dragged outside bounds, remove
    const rect = planeRef.current?.getBoundingClientRect()
    if (rect) {
      const margin = 20
      if (e.clientX < rect.left - margin || e.clientX > rect.right + margin ||
          e.clientY < rect.top - margin || e.clientY > rect.bottom + margin) {
        removePlacement(dragging)
      }
    }
    setDragging(null)
  }, [dragging, removePlacement])

  // Drop from tray: click tray chip → click on plane
  const handleTrayChipClick = useCallback((id: string) => {
    if (effectiveAllDone) return
    setPendingTrayChip(id)
    setActiveId(id)
  }, [effectiveAllDone])

  const handlePlaneClick = useCallback((e: React.MouseEvent) => {
    if (hasDragged.current || !pendingTrayChip || effectiveAllDone) return
    const coords = pointerToCoords(e.clientX, e.clientY)
    if (coords) {
      updatePlacements(pendingTrayChip, coords.x, coords.y)
      setActiveId(pendingTrayChip)
    }
    setPendingTrayChip(null)
  }, [pendingTrayChip, effectiveAllDone, pointerToCoords, updatePlacements])

  // Auto-scroll to reasoning card when a chip is placed
  const reasonRefs = useRef<Record<string, HTMLDivElement | null>>({})
  useEffect(() => {
    if (activeId && placements[activeId] && reasonRefs.current[activeId]) {
      reasonRefs.current[activeId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [activeId, placements])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Prompt + guide button */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, fontSize: 13, color: 'var(--t2)', lineHeight: 1.6 }}>
          {mdLiteNodes(prompt)}
        </div>
        <button
          className={`se-guide-btn${!guideSeen.current && !guideOpen ? ' pulse' : ''}`}
          aria-label="Map exercise guide"
          onClick={() => {
            setGuideOpen(true)
            markGuideSeen('guide-seen-map')
            guideSeen.current = true
          }}
        >?</button>
      </div>
      <MapGuide open={guideOpen} onClose={() => setGuideOpen(false)} />

      {/* Chip tray */}
      {unplaced.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {unplaced.map(it => (
            <button
              key={it.id}
              onClick={() => handleTrayChipClick(it.id)}
              style={{
                ...chipStyle,
                ...(pendingTrayChip === it.id ? chipActiveStyle : {}),
                cursor: effectiveAllDone ? 'default' : 'pointer',
              }}
            >
              <span style={chipDotStyle} />
              {it.label}
              {it.hint && <span style={{ fontSize: 10, color: 'var(--t3)', marginLeft: 2 }}>{it.hint}</span>}
            </button>
          ))}
        </div>
      )}

      {pendingTrayChip && (
        <div style={{ fontSize: 11, color: 'var(--purple)', fontWeight: 500, textAlign: 'center' }}>
          Click on the plane to place "{mapItems.find(i => i.id === pendingTrayChip)?.label}"
        </div>
      )}

      {/* Coordinate plane */}
      <div
        ref={planeRef}
        style={planeStyle}
        onClick={handlePlaneClick}
        onPointerDown={handlePlanePointerDown}
        onPointerMove={handlePlanePointerMove}
        onPointerUp={handlePlanePointerUp}
      >
        {/* Grid lines */}
        <div style={{ ...gridLine, top: '50%', left: 0, right: 0, height: 1 }} />
        <div style={{ ...gridLine, left: '50%', top: 0, bottom: 0, width: 1 }} />
        <div style={{ ...gridLine, top: '25%', left: 0, right: 0, height: 1, opacity: 0.3 }} />
        <div style={{ ...gridLine, top: '75%', left: 0, right: 0, height: 1, opacity: 0.3 }} />
        <div style={{ ...gridLine, left: '25%', top: 0, bottom: 0, width: 1, opacity: 0.3 }} />
        <div style={{ ...gridLine, left: '75%', top: 0, bottom: 0, width: 1, opacity: 0.3 }} />

        {/* Axis labels */}
        <div style={{ ...axisLabel, top: 4, left: '50%', transform: 'translateX(-50%)' }}>{axes.y.pos}</div>
        <div style={{ ...axisLabel, bottom: 4, left: '50%', transform: 'translateX(-50%)' }}>{axes.y.neg}</div>
        <div style={{ ...axisLabel, left: 4, top: '50%', transform: 'translateY(-50%)' }}>{axes.x.neg}</div>
        <div style={{ ...axisLabel, right: 4, top: '50%', transform: 'translateY(-50%)' }}>{axes.x.pos}</div>

        {/* Given (pre-placed) chips */}
        {givenItems.map(it => {
          const gp = givenPlacements?.[it.id]
          if (!gp) return null
          const pctX = ((gp.x + 1) / 2) * 100
          const pctY = ((1 - (gp.y + 1) / 2)) * 100
          return (
            <div
              key={it.id}
              style={{
                ...placedChipStyle,
                left: `${pctX}%`,
                top: `${pctY}%`,
                background: 'var(--surface2, var(--surface))',
                border: '1.5px dashed var(--border)',
                opacity: 0.65,
                pointerEvents: 'none',
                color: 'var(--t3)',
              }}
            >
              <span style={{ ...chipDotStyle, background: 'var(--border)' }} />
              <span style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{it.label}</span>
            </div>
          )
        })}

        {/* Placed chips (student) */}
        {placed.map(it => {
          const p = placements[it.id]
          const pctX = ((p.x + 1) / 2) * 100
          const pctY = ((1 - (p.y + 1) / 2)) * 100 // invert y for CSS
          const ir = effectiveItemResults?.[it.id]
          return (
            <div
              key={it.id}
              data-chip-id={it.id}
              onClick={(e) => { e.stopPropagation(); setActiveId(it.id) }}
              style={{
                ...placedChipStyle,
                left: `${pctX}%`,
                top: `${pctY}%`,
                ...(activeId === it.id ? chipActiveStyle : {}),
                ...(dragging === it.id ? { cursor: 'grabbing', zIndex: 50 } : {}),
                ...(ir ? { borderColor: ir.correct ? 'var(--green)' : 'var(--amber, #f59e0b)' } : {}),
              }}
            >
              <span style={chipDotStyle} />
              <span style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{it.label}</span>
            </div>
          )
        })}
      </div>

      {/* Axis legend */}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', fontSize: 10, color: 'var(--t3)' }}>
        <span>← {axes.x.label} →</span>
        <span>↕ {axes.y.label}</span>
      </div>

      {/* Reasoning cards */}
      {placed.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Reasoning ({reasonedCount}/{practiceItems.length})
          </div>
          {placed.map(it => {
            const p = placements[it.id]
            const reason = reasons[it.id] || ''
            const isActive = activeId === it.id
            const done = reason.trim().length >= minReasonLength
            const ir = effectiveItemResults?.[it.id]
            return (
              <div
                key={it.id}
                ref={el => { reasonRefs.current[it.id] = el }}
                onClick={() => setActiveId(it.id)}
                style={{
                  ...reasonCardStyle,
                  ...(isActive ? { borderColor: 'var(--purple)', boxShadow: '0 0 0 3px var(--purple-bg)' } : {}),
                  ...(ir ? { borderLeft: `3px solid ${ir.correct ? 'var(--green)' : 'var(--amber, #f59e0b)'}` } : {}),
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ ...chipStyle, padding: '3px 8px', fontSize: 11, cursor: 'default' }}>
                    <span style={chipDotStyle} />{it.label}
                  </span>
                  <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: 'var(--t3)', marginLeft: 'auto' }}>
                    ({p.x.toFixed(2)}, {p.y.toFixed(2)})
                  </span>
                </div>

                {/* Axis summary */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <div style={axisCellStyle}>
                    <div style={axisCellLabel}>X: {axes.x.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)' }}>{quadrantLabel(p.x, axes.x)}</div>
                  </div>
                  <div style={axisCellStyle}>
                    <div style={axisCellLabel}>Y: {axes.y.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)' }}>{quadrantLabel(p.y, axes.y)}</div>
                  </div>
                </div>

                {/* Reason textarea */}
                <textarea
                  style={{
                    ...textareaStyle,
                    ...(done ? { borderColor: 'var(--green)', background: 'var(--green-bg)' } : {}),
                  }}
                  placeholder="Why did you place it here?"
                  value={reason}
                  onChange={e => setReason(it.id, e.target.value)}
                  disabled={effectiveAllDone}
                  rows={2}
                />

                {/* Per-item LLM comment */}
                {ir?.hint && (
                  <div style={{
                    fontSize: 12, color: 'var(--t2)', lineHeight: 1.5,
                    marginTop: 6, padding: '6px 8px',
                    background: 'var(--surface)', borderRadius: 6,
                    borderLeft: `2px solid ${ir.correct ? 'var(--green)' : 'var(--amber, #f59e0b)'}`,
                  }}>
                    {ir.hint}
                  </div>
                )}

                {/* Footer */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 10, color: 'var(--t3)' }}>
                  <span>{reason.trim().length} chars{!done && ` · need ≥${minReasonLength}`}</span>
                  {!effectiveAllDone && (
                    <button
                      onClick={(e) => { e.stopPropagation(); removePlacement(it.id) }}
                      style={removeBtnStyle}
                    >
                      Return ↩
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* LLM feedback banner */}
      {effectiveFeedback && (
        <div style={{
          padding: '10px 14px', borderRadius: 8,
          background: 'var(--purple-bg)', border: '1px solid var(--purple)',
          fontSize: 13, color: 'var(--t1)', lineHeight: 1.6,
        }}>
          {effectiveFeedback}
        </div>
      )}

      {/* Progress bar */}
      {practiceItems.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--t3)' }}>
          <span>{reasonedCount}/{practiceItems.length}</span>
          <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${(reasonedCount / practiceItems.length) * 100}%`,
              background: reasonedCount === practiceItems.length ? 'var(--green)' : 'var(--purple)',
              borderRadius: 2,
              transition: 'width .2s',
            }} />
          </div>
        </div>
      )}
    </div>
  )
}

function clamp(v: number): number {
  return Math.max(-1, Math.min(1, v))
}

/** Render simple **bold** and *italic* as React nodes (no raw HTML) */
function mdLiteNodes(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let key = 0
  // Split on **bold** and *italic* patterns
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    if (m[2]) parts.push(<strong key={key++}>{m[2]}</strong>)
    else if (m[3]) parts.push(<em key={key++}>{m[3]}</em>)
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

// ── Styles ──

const chipStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '6px 10px', borderRadius: 999,
  background: 'var(--surface)', border: '1.5px solid var(--border)',
  fontSize: 12, color: 'var(--t1)', fontWeight: 500,
  cursor: 'grab', userSelect: 'none', fontFamily: 'inherit',
  transition: 'border-color .12s, box-shadow .12s',
}

const chipActiveStyle: React.CSSProperties = {
  borderColor: 'var(--purple)', boxShadow: '0 0 0 3px var(--purple-bg)',
}

const chipDotStyle: React.CSSProperties = {
  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
  background: 'var(--t3)',
}

const planeStyle: React.CSSProperties = {
  position: 'relative', aspectRatio: '1/1',
  maxHeight: 'min(360px, calc(100vh - 280px))',
  width: '100%', background: 'var(--surface)',
  border: '1px solid var(--border)', borderRadius: 8,
  cursor: 'crosshair', overflow: 'hidden', touchAction: 'none',
}

const gridLine: React.CSSProperties = {
  position: 'absolute', background: 'var(--border)',
  pointerEvents: 'none',
}

const axisLabel: React.CSSProperties = {
  position: 'absolute', fontSize: 10, fontWeight: 600,
  color: 'var(--t3)', pointerEvents: 'none',
  padding: '0 4px', whiteSpace: 'nowrap',
}

const placedChipStyle: React.CSSProperties = {
  position: 'absolute', transform: 'translate(-50%, -50%)',
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '4px 8px', borderRadius: 999,
  background: 'var(--surface)', border: '1.5px solid var(--border)',
  fontSize: 11, color: 'var(--t1)', fontWeight: 500,
  cursor: 'grab', userSelect: 'none', zIndex: 10,
  boxShadow: '0 1px 3px rgba(0,0,0,.08)',
  transition: 'border-color .12s, box-shadow .12s',
}

const reasonCardStyle: React.CSSProperties = {
  padding: 12, background: 'var(--bg)', borderRadius: 8,
  border: '1px solid var(--border)',
  transition: 'border-color .15s, box-shadow .15s',
  cursor: 'pointer',
}

const axisCellStyle: React.CSSProperties = {
  flex: 1, padding: '6px 8px', background: 'var(--surface)',
  border: '1px solid var(--border)', borderRadius: 6,
}

const axisCellLabel: React.CSSProperties = {
  fontSize: 9, fontWeight: 600, color: 'var(--t3)',
  textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2,
}

const textareaStyle: React.CSSProperties = {
  width: '100%', border: '1px solid var(--border)', borderRadius: 6,
  padding: '8px 10px', fontSize: 12, fontFamily: 'inherit',
  background: 'var(--surface)', resize: 'vertical', lineHeight: 1.5,
  color: 'var(--t1)', minHeight: 48,
}

const removeBtnStyle: React.CSSProperties = {
  fontSize: 10, color: 'var(--t3)', background: 'transparent',
  border: 'none', cursor: 'pointer', padding: '2px 6px',
  borderRadius: 4, marginLeft: 'auto', fontFamily: 'inherit',
}
