// GeometryFigure.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Renders a JXGConstruction from the DB.  No geometry logic lives here —
// everything is driven by the spec.
//
// Setup:
//   npm install jsxgraph
//   import 'jsxgraph/distrib/jsxgraph.css'   ← once in your app entry
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, useCallback } from 'react'
import type { JXGConstruction, JXGElement, Parent, SnapValue } from '../types'

const JXG = (window as any).JXG

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _seq = 0
const uid = () => `jxg-${++_seq}`

/** Evaluate a { expr } parent string with the current param value in scope. */
function evalExpr(expr: string, paramName: string, paramValue: number): number {
  try {
    // eslint-disable-next-line no-new-func
    return new Function('Math', paramName, `return ${expr}`)(Math, paramValue)
  } catch {
    return 0
  }
}

/**
 * Resolve a single parent entry to what JSXGraph expects:
 *   - element id string → the live JSXGraph object
 *   - static coord / number → passed through
 *   - { expr } → a reactive function () => evalExpr(...)
 */
function resolveParent(
  p:          Parent,
  registry:   Map<string, any>,
  paramName:  string,
  paramRef:   React.MutableRefObject<number>,
): any {
  if (typeof p === 'string') {
    const el = registry.get(p)
    if (el) return el
    // Not in registry → treat as literal value (text content / expression)
    return p
  }
  if (typeof p === 'number') return p
  if (Array.isArray(p))      return p
  // { expr } — wrap in reactive function so JSXGraph re-evaluates on board.update()
  return () => evalExpr(p.expr, paramName, paramRef.current)
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface GeometryFigureProps {
  spec:       JXGConstruction
  /** Square canvas size in px. Default 400. */
  size?:      number
  className?: string
}

export function GeometryFigure({ spec, size = 400, className }: GeometryFigureProps) {
  const canvasId  = useRef(uid())
  const boardRef  = useRef<any>(null)
  const paramRef  = useRef<number>(spec.animation?.default ?? 0)
  const rafRef    = useRef<number | null>(null)
  const dirRef    = useRef<1 | -1>(1)          // animation direction for bounce

  const [paramVal, setParamVal] = useState(spec.animation?.default ?? 0)
  const [playing,  setPlaying]  = useState(false)
  const [activeSnap, setActiveSnap] = useState<SnapValue | null>(null)

  const anim    = spec.animation
  const hasAnim = !!anim

  // ── Build board ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!JXG) { console.error('JSXGraph not loaded'); return }

    if (boardRef.current) {
      JXG.JSXGraph.freeBoard(boardRef.current)
      boardRef.current = null
    }

    paramRef.current = anim?.default ?? 0
    setParamVal(anim?.default ?? 0)

    boardRef.current = spec.kind === '3d'
      ? buildBoard3D(canvasId.current, spec, paramRef)
      : buildBoard2D(canvasId.current, spec, paramRef)

    return () => {
      stopAnimation()
      if (boardRef.current) {
        JXG.JSXGraph.freeBoard(boardRef.current)
        boardRef.current = null
      }
    }
  }, [spec])

  // ── Slider / snap ──────────────────────────────────────────────────────────
  const setParam = useCallback((val: number) => {
    paramRef.current = val
    setParamVal(val)
    boardRef.current?.update()

    // check snaps
    const snap = anim?.snapValues?.find(sv => Math.abs(sv.value - val) < 1) ?? null
    setActiveSnap(snap)
  }, [anim])

  // ── Animation loop ─────────────────────────────────────────────────────────
  const stopAnimation = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setPlaying(false)
  }, [])

  const startAnimation = useCallback(() => {
    if (!anim) return
    const { range, autoPlay } = anim
    const fps      = autoPlay?.fps      ?? 30
    const duration = autoPlay?.duration ?? 4
    const mode     = autoPlay?.mode     ?? 'bounce'
    const step     = (range[1] - range[0]) / (fps * duration)

    setPlaying(true)
    let last = performance.now()

    const tick = (now: number) => {
      const dt = now - last
      if (dt < 1000 / fps) { rafRef.current = requestAnimationFrame(tick); return }
      last = now

      let next = paramRef.current + step * dirRef.current

      if (next >= range[1]) {
        if (mode === 'once')   { setParam(range[1]); stopAnimation(); return }
        if (mode === 'loop')   { next = range[0] }
        if (mode === 'bounce') { next = range[1]; dirRef.current = -1 }
      } else if (next <= range[0]) {
        if (mode === 'bounce') { next = range[0]; dirRef.current = 1 }
        else                    { next = range[0] }
      }

      setParam(next)
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [anim, setParam, stopAnimation])

  const togglePlay = useCallback(() => {
    if (playing) stopAnimation()
    else         startAnimation()
  }, [playing, startAnimation, stopAnimation])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className={`geometry-figure ${className ?? ''}`}
      style={{ display: 'inline-flex', flexDirection: 'column', gap: 8, fontFamily: 'system-ui, sans-serif' }}
    >
      {/* Canvas */}
      <div
        id={canvasId.current}
        className="jxgbox"
        style={{
          width:  size,
          height: size,
          background:   '#fafaf8',
          border:       '1px solid #e0dbd4',
          borderRadius: 3,
        }}
      />

      {/* Controls — only when animation spec present */}
      {hasAnim && (
        <div style={{ width: size }}>

          {/* Label + value */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#1a1a2e', marginBottom: 3 }}>
            <span>{anim.label ?? anim.param}</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
              {paramVal.toFixed(1)}{anim.label?.includes('°') ? '°' : ''}
            </span>
          </div>

          {/* Slider + play button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="range"
              min={anim.range[0]}
              max={anim.range[1]}
              step={0.5}
              value={paramVal}
              onChange={e => { stopAnimation(); setParam(parseFloat(e.target.value)) }}
              style={{ flex: 1, accentColor: '#2c5f8a' }}
            />
            {anim.autoPlay && (
              <button
                onClick={togglePlay}
                style={{
                  width: 28, height: 28, borderRadius: '50%', border: '1px solid #2c5f8a',
                  background: playing ? '#2c5f8a' : 'white',
                  color:      playing ? 'white'   : '#2c5f8a',
                  cursor: 'pointer', fontSize: 12, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                title={playing ? '暂停' : '播放'}
              >
                {playing ? '⏸' : '▶'}
              </button>
            )}
          </div>

          {/* Snap buttons */}
          {anim.snapValues && (
            <div style={{ display: 'flex', gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
              {anim.snapValues.map(sv => {
                const active = activeSnap?.value === sv.value
                return (
                  <button
                    key={sv.value}
                    onClick={() => { stopAnimation(); setParam(sv.value) }}
                    style={{
                      padding: '2px 9px', fontSize: 12, borderRadius: 3,
                      border:      `1px solid ${active ? '#27ae60' : '#ccc'}`,
                      background:  active ? '#27ae60' : 'white',
                      color:       active ? 'white'   : '#1a1a2e',
                      cursor:      'pointer', fontFamily: 'monospace',
                    }}
                  >
                    {sv.label}
                  </button>
                )
              })}
            </div>
          )}

          {/* Active snap note */}
          {activeSnap?.note && (
            <div style={{
              marginTop: 6, padding: '5px 8px', borderRadius: 3,
              border: '1px solid #27ae60', background: '#f0faf4',
              fontSize: 12, color: '#27ae60', fontWeight: 600,
            }}>
              ✓ {activeSnap.note}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Board builders ───────────────────────────────────────────────────────────

function buildBoard2D(
  id:       string,
  spec:     JXGConstruction,
  paramRef: React.MutableRefObject<number>,
) {
  const board = JXG.JSXGraph.initBoard(id, {
    boundingbox: spec.bbox,
    keepaspectratio: true,
    axis: false, grid: false,
    showNavigation: false, showCopyright: false,
    pan: { enabled: false }, zoom: { enabled: false },
  })

  replayElements(board, null, spec.elements, spec.animation?.param ?? 'param', paramRef)
  return board
}

function buildBoard3D(
  id:       string,
  spec:     JXGConstruction,
  paramRef: React.MutableRefObject<number>,
) {
  const board = JXG.JSXGraph.initBoard(id, {
    boundingbox: [-3.2, 3.2, 3.2, -3.2],
    keepaspectratio: true,
    axis: false, grid: false,
    showNavigation: false, showCopyright: false,
    pan: { enabled: false }, zoom: { enabled: false },
  })

  const bb = spec.bbox3d ?? [[-1.8, 1.8], [-1.8, 1.8], [-0.2, 2.8]]
  const view = board.create('view3d', [[-2.5, -2.5], [5, 5], bb], {
    xPlaneRear: { visible: false }, yPlaneRear: { visible: false },
    zPlaneRear: { visible: false },
    xPlaneRearYAxis: { visible: false }, xPlaneRearZAxis: { visible: false },
    yPlaneRearXAxis: { visible: false }, yPlaneRearZAxis: { visible: false },
    zPlaneRearXAxis: { visible: false }, zPlaneRearYAxis: { visible: false },
    trackball: { enabled: true },
    az: { slider: { visible: false } },
    el: { slider: { visible: false } },
  })

  replayElements(board, view, spec.elements, spec.animation?.param ?? 'param', paramRef)
  return board
}

// ─── High-level sugar expansion ───────────────────────────────────────────────

let _expandSeq = 0

/**
 * Expand high-level geometry types (incenter, circumcenter, orthocenter, centroid)
 * into multiple JSXGraph primitive elements. Pass-through for all other types.
 */
function expandElement(el: JXGElement): JXGElement[] {
  const id = el.id ?? `_auto_${++_expandSeq}`

  switch (el.type) {
    case 'incenter': {
      // Incenter = intersection of two angle bisectors
      const [A, B, C] = el.parents as string[]
      return [
        { type: 'bisector', parents: [B, A, C], attrs: { visible: false }, id: `${id}__bis1` },
        { type: 'bisector', parents: [A, B, C], attrs: { visible: false }, id: `${id}__bis2` },
        { type: 'intersection', parents: [`${id}__bis1`, `${id}__bis2`, 0], attrs: el.attrs, id },
      ]
    }
    case 'circumcenter': {
      // Circumcenter = intersection of two perpendicular bisectors
      const [A, B, C] = el.parents as string[]
      return [
        { type: 'midpoint', parents: [A, B], attrs: { visible: false }, id: `${id}__mid1` },
        { type: 'midpoint', parents: [B, C], attrs: { visible: false }, id: `${id}__mid2` },
        { type: 'line', parents: [A, B], attrs: { visible: false }, id: `${id}__ln1` },
        { type: 'line', parents: [B, C], attrs: { visible: false }, id: `${id}__ln2` },
        { type: 'perpendicular', parents: [`${id}__ln1`, `${id}__mid1`], attrs: { visible: false }, id: `${id}__pb1` },
        { type: 'perpendicular', parents: [`${id}__ln2`, `${id}__mid2`], attrs: { visible: false }, id: `${id}__pb2` },
        { type: 'intersection', parents: [`${id}__pb1`, `${id}__pb2`, 0], attrs: el.attrs, id },
      ]
    }
    case 'orthocenter': {
      // Orthocenter = intersection of two altitudes
      const [A, B, C] = el.parents as string[]
      return [
        { type: 'line', parents: [B, C], attrs: { visible: false }, id: `${id}__ln1` },
        { type: 'line', parents: [A, C], attrs: { visible: false }, id: `${id}__ln2` },
        { type: 'perpendicular', parents: [`${id}__ln1`, A], attrs: { visible: false }, id: `${id}__alt1` },
        { type: 'perpendicular', parents: [`${id}__ln2`, B], attrs: { visible: false }, id: `${id}__alt2` },
        { type: 'intersection', parents: [`${id}__alt1`, `${id}__alt2`, 0], attrs: el.attrs, id },
      ]
    }
    case 'centroid': {
      // Centroid = intersection of two medians
      const [A, B, C] = el.parents as string[]
      return [
        { type: 'midpoint', parents: [B, C], attrs: { visible: false }, id: `${id}__mid1` },
        { type: 'midpoint', parents: [A, C], attrs: { visible: false }, id: `${id}__mid2` },
        { type: 'line', parents: [A, `${id}__mid1`], attrs: { visible: false }, id: `${id}__med1` },
        { type: 'line', parents: [B, `${id}__mid2`], attrs: { visible: false }, id: `${id}__med2` },
        { type: 'intersection', parents: [`${id}__med1`, `${id}__med2`, 0], attrs: el.attrs, id },
      ]
    }
    default:
      return [el]
  }
}

// ─── Core replay ─────────────────────────────────────────────────────────────

function replayElements(
  board:      any,
  view:       any,            // null for 2D
  elements:   JXGElement[],
  paramName:  string,
  paramRef:   React.MutableRefObject<number>,
) {
  const registry = new Map<string, any>()

  for (const el of elements) {
    const expanded = expandElement(el)
    for (const exp of expanded) {
      try {
        let parents = exp.parents.map(p => resolveParent(p, registry, paramName, paramRef))
        // Flatten single coordinate pair: [[x,y]] → [x,y] for point creation
        // Spec format uses "parents": [[0, 0]], JSXGraph expects flat [0, 0]
        if (parents.length === 1 && Array.isArray(parents[0]) &&
            parents[0].every((n: unknown) => typeof n === 'number')) {
          parents = parents[0]
        }
        const creator = view ?? board
        const created = creator.create(exp.type, parents, exp.attrs ?? {})
        if (exp.id) {
          registry.set(exp.id, created)
          // Register sub-elements for composite types (e.g. perpendicularsegment.point)
          const subPoint = created.point ?? created.subs?.point
          if (subPoint) registry.set(`${exp.id}.point`, subPoint)
        }
      } catch (err) {
        console.warn(`GeometryFigure: failed to create element type="${exp.type}" id="${exp.id ?? '(none)'}":`, err)
      }
    }
  }
}
