// ═══════════════════════════════════════════
// TRAINING PAGE PREVIEW
// Renders SVG skeleton animation for exercises.
// Ported from fitness-v3.jsx main component animation logic.
// ═══════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react'
import { interpolate, animationSpeed } from '../engine/animation'
import { LyingFigure } from './figures/LyingFigure'
import { CatFigure } from './figures/CatFigure'
import { SeatedFigure } from './figures/SeatedFigure'
import type { ExerciseRenderData } from '../types'
import { MONO_FONT } from '../constants'

interface TrainingPagePreviewProps {
  exercises: ExerciseRenderData[]
}

type FigureComponent = React.ComponentType<{ angles: Record<string, number>; exerciseId?: string }>

const FIGURE_MAP: Record<string, FigureComponent> = {
  lying: ({ angles, exerciseId }) => <LyingFigure angles={angles} exerciseId={exerciseId || ''} />,
  cat: ({ angles }) => <CatFigure angles={angles} />,
  seated: ({ angles }) => <SeatedFigure angles={angles} />,
}

export function TrainingPagePreview({ exercises }: TrainingPagePreviewProps) {
  const [selIdx, setSelIdx] = useState(0)
  const [progress, setProgress] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [curSet, setCurSet] = useState(1)
  const [curRep, setCurRep] = useState(1)
  const [elapsed, setElapsed] = useState(0)
  const [resting, setResting] = useState(false)
  const [restLeft, setRestLeft] = useState(0)
  const [done, setDone] = useState<Record<string, boolean>>({})

  const rafRef = useRef<number | null>(null)
  const lastRef = useRef<number | null>(null)
  const stateRef = useRef({ curSet: 1, curRep: 1 })

  useEffect(() => {
    stateRef.current = { curSet, curRep }
  }, [curSet, curRep])

  // Derive exercise-dependent values before hooks that depend on them
  const ex = exercises.length > 0 ? exercises[Math.min(selIdx, exercises.length - 1)] : undefined
  const numKF = ex ? ex.keyframes.length : 0
  const totalDur = ex ? ex.phaseDurations.reduce((a, b) => a + b, 0) : 0

  // All hooks must be declared unconditionally (before any early return)
  const tick = useCallback(() => {
    if (!ex) return
    const now = Date.now()
    if (!lastRef.current) lastRef.current = now
    const dt = (now - lastRef.current) / 1000
    lastRef.current = now

    if (resting) {
      setRestLeft((p) => {
        if (p - dt <= 0) {
          setResting(false)
          setCurSet((s) => s + 1)
          setCurRep(1)
          return 0
        }
        return p - dt
      })
    } else {
      setElapsed((t) => t + dt)
      setProgress((prev) => {
        const speed = animationSpeed(numKF, totalDur)
        let next = prev + dt * speed
        if (next >= numKF - 1) {
          next = 0
          const { curSet: cs, curRep: cr } = stateRef.current
          if (cr >= ex.reps) {
            if (cs >= ex.sets) {
              setPlaying(false)
              setDone((d) => ({ ...d, [ex.id]: true }))
              setCurRep(1)
              return 0
            }
            setResting(true)
            setRestLeft(ex.restSec)
          } else {
            setCurRep((r) => r + 1)
          }
        }
        return next
      })
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [resting, ex, numKF, totalDur])

  useEffect(() => {
    if (!playing || !ex) return
    lastRef.current = Date.now()
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [playing, tick, ex])

  const reset = () => {
    setPlaying(false)
    setProgress(0)
    setCurSet(1)
    setCurRep(1)
    setElapsed(0)
    setResting(false)
    setRestLeft(0)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }

  const selectEx = (i: number) => {
    reset()
    setSelIdx(i)
  }

  // Early return after all hooks
  if (!ex) {
    return (
      <div style={{
        background: '#0c1525',
        borderRadius: 12,
        border: '1px solid #1a2a3c',
        padding: '40px 20px',
        textAlign: 'center',
        color: '#3a5060',
        fontFamily: MONO_FONT,
      }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🦴</div>
        <div style={{ fontSize: 13 }}>同步训练方案后，此处显示 SVG 骨架动画</div>
      </div>
    )
  }

  const angles = interpolate(ex.keyframes, progress)
  // Guard division by zero when numKF === 1
  const progressRatio = numKF > 1 ? progress / (numKF - 1) : 0

  // Compute current phase index
  let cumDur = 0
  let phaseIdx = 0
  for (let i = 0; i < ex.phaseDurations.length; i++) {
    cumDur += ex.phaseDurations[i]
    if (progressRatio <= cumDur / totalDur) {
      phaseIdx = i
      break
    }
    phaseIdx = i
  }

  const Figure = FIGURE_MAP[ex.figure] || FIGURE_MAP.lying
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(Math.floor(elapsed % 60)).padStart(2, '0')

  return (
    <div style={{ fontFamily: MONO_FONT }}>
      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: 4,
        padding: '8px 0',
        overflowX: 'auto',
        marginBottom: 8,
      }}>
        {exercises.map((e, i) => (
          <button
            key={e.id}
            onClick={() => selectEx(i)}
            style={{
              background: i === selIdx ? '#162033' : 'transparent',
              border: i === selIdx ? '1px solid #22d3ee44' : '1px solid transparent',
              borderRadius: 8,
              padding: '6px 12px',
              cursor: 'pointer',
              color: i === selIdx ? '#22d3ee' : '#4a6070',
              fontSize: 12,
              fontFamily: MONO_FONT,
              fontWeight: i === selIdx ? 700 : 400,
              whiteSpace: 'nowrap',
              transition: 'all .2s',
            }}
          >
            {done[e.id] ? '✓ ' : ''}{e.nameZh}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 700, color: '#e2e8f0', padding: '6px 0' }}>
          {mm}:{ss}
        </div>
      </div>

      {/* Canvas */}
      <div style={{
        background: 'linear-gradient(160deg,#0c1525,#101d30)',
        borderRadius: 12,
        border: '1px solid #1a2a3c',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Phase badge */}
        <div style={{
          position: 'absolute',
          top: 10,
          left: 12,
          zIndex: 5,
          background: resting ? '#78350f88' : '#0e454d88',
          border: `1px solid ${resting ? '#f59e0b66' : '#22d3ee55'}`,
          borderRadius: 6,
          padding: '3px 10px',
          fontSize: 12,
          fontWeight: 600,
          backdropFilter: 'blur(4px)',
          color: resting ? '#fbbf24' : '#22d3ee',
        }}>
          {resting ? `休息 ${Math.ceil(restLeft)}s` : ex.phases[phaseIdx]}
        </div>

        {/* Rep counter */}
        <div style={{ position: 'absolute', top: 10, right: 12, zIndex: 5, textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9' }}>
            {curRep}<span style={{ fontSize: 12, color: '#4a6070' }}>/{ex.reps}</span>
          </div>
          <div style={{ fontSize: 10, color: '#4a6070' }}>第{curSet}/{ex.sets}组</div>
        </div>

        <svg viewBox="0 0 500 300" style={{ width: '100%', display: 'block' }}>
          <defs>
            <pattern id="rehab-grid" width={25} height={25} patternUnits="userSpaceOnUse">
              <path d="M 25 0 L 0 0 0 25" fill="none" stroke="#14202e" strokeWidth={0.5} />
            </pattern>
          </defs>
          <rect width={500} height={300} fill="url(#rehab-grid)" opacity={0.6} />
          <Figure angles={angles} exerciseId={ex.id} />
        </svg>

        {/* Progress bar */}
        <div style={{ height: 3, background: '#111a2e' }}>
          <div style={{
            height: '100%',
            width: `${progressRatio * 100}%`,
            background: 'linear-gradient(90deg,#22d3ee,#a78bfa)',
            transition: 'width .08s linear',
            borderRadius: 2,
          }} />
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, padding: '10px 0 6px' }}>
        <button
          onClick={reset}
          style={{
            background: '#111a2e',
            border: '1px solid #1e2d40',
            borderRadius: 10,
            padding: '10px 18px',
            color: '#7a8fa0',
            fontSize: 13,
            fontFamily: MONO_FONT,
            cursor: 'pointer',
          }}
        >
          ↺ 重置
        </button>
        <button
          onClick={() => setPlaying((p) => !p)}
          style={{
            background: playing
              ? 'linear-gradient(135deg,#dc2626,#991b1b)'
              : 'linear-gradient(135deg,#0891b2,#06b6d4)',
            border: 'none',
            borderRadius: 10,
            padding: '10px 36px',
            color: '#fff',
            fontSize: 14,
            fontWeight: 700,
            fontFamily: MONO_FONT,
            cursor: 'pointer',
            boxShadow: playing ? '0 4px 20px #dc262655' : '0 4px 20px #06b6d455',
          }}
        >
          {playing ? '⏸ 暂停' : '▶ 开始'}
        </button>
      </div>

      {/* Phase timeline */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 10 }}>
        {ex.phases.map((name, i) => {
          const active = phaseIdx === i && playing
          return (
            <div
              key={i}
              style={{
                flex: ex.phaseDurations[i],
                background: active ? '#0e454d' : '#111a2e',
                border: active ? '1px solid #22d3ee55' : '1px solid #151f30',
                borderRadius: 5,
                padding: '5px 2px',
                textAlign: 'center',
                transition: 'all .25s',
              }}
            >
              <div style={{
                fontSize: 9,
                color: active ? '#22d3ee' : '#3a5060',
                fontWeight: active ? 700 : 400,
              }}>
                {name}
              </div>
              <div style={{ fontSize: 8, color: '#2a3a48', marginTop: 2 }}>
                {ex.phaseDurations[i]}s
              </div>
            </div>
          )
        })}
      </div>

      {/* How-to instructions */}
      <div style={{
        background: '#0c1525',
        borderRadius: 10,
        border: '1px solid #152030',
        padding: '10px 12px',
      }}>
        <div style={{
          fontSize: 9,
          color: '#22d3ee',
          letterSpacing: 1.5,
          marginBottom: 8,
          textTransform: 'uppercase',
        }}>
          动作要领 · {ex.nameZh}
        </div>
        {ex.howTo.map((step, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 5, alignItems: 'flex-start' }}>
            <div style={{
              width: 16,
              height: 16,
              borderRadius: 4,
              flexShrink: 0,
              marginTop: 1,
              background: '#111d30',
              border: '1px solid #22d3ee33',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 9,
              color: '#22d3ee',
              fontWeight: 700,
            }}>
              {i + 1}
            </div>
            <div style={{ fontSize: 11, color: '#b0c4d4', lineHeight: 1.6 }}>{step}</div>
          </div>
        ))}
        {ex.safety.length > 0 && (
          <div style={{
            marginTop: 8,
            paddingTop: 8,
            borderTop: '1px solid #1a2332',
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
          }}>
            {ex.safety.map((s, i) => (
              <div key={i} style={{
                fontSize: 10,
                color: '#f59e0b',
                background: '#1a150a',
                border: '1px solid #f59e0b22',
                borderRadius: 5,
                padding: '3px 8px',
              }}>
                ⚠ {s}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
        <div style={{
          background: '#0c1525',
          borderRadius: 8,
          padding: '8px 10px',
          border: '1px solid #151f30',
        }}>
          <div style={{ fontSize: 8, color: '#3a5060', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 3 }}>
            训练量
          </div>
          <div style={{ fontSize: 11, color: '#b0c4d4' }}>{ex.sets}组 × {ex.reps}次</div>
          <div style={{ fontSize: 10, color: '#3a5060', marginTop: 1 }}>休息{ex.restSec}s · {ex.tempo}</div>
        </div>
        <div style={{
          background: '#0c1525',
          borderRadius: 8,
          padding: '8px 10px',
          border: '1px solid #151f30',
        }}>
          <div style={{ fontSize: 8, color: '#3a5060', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 3 }}>
            目标肌群
          </div>
          <div style={{ fontSize: 11, color: '#b0c4d4' }}>{ex.muscles}</div>
        </div>
      </div>
    </div>
  )
}
