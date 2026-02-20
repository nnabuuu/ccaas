// ═══════════════════════════════════════════
// SEATED FIGURE RENDERER (坐姿)
// Ported from fitness-v3.jsx SeatedFigure — do not change joint positions or z-ordering
// ═══════════════════════════════════════════

import { Bone, Head, Hand, Foot, Ground, Glow } from './Primitives'
import type { Keyframe } from '../../types'

interface SeatedFigureProps {
  angles: Keyframe
}

export function SeatedFigure({ angles }: SeatedFigureProps) {
  const GY = 280
  const seatY = 200, hipY = seatY - 8
  const shoulderY = 125, headY = 82
  const cx = 200

  const lEndX = cx - 15 + (angles.lArmX as number)
  const lEndY = shoulderY + 8 + (angles.lArmY as number)
  const rEndX = cx + 15 + (angles.rArmX as number)
  const rEndY = shoulderY + 8 + (angles.rArmY as number)
  const lPunch = (angles.lArmX as number) > 30
  const rPunch = (angles.rArmX as number) > 30

  // Determine punch label
  let label = '', labelColor = '#8cb8d0'
  if ((angles.lArmX as number) > 100 && (angles.lArmY as number) > -20) {
    label = 'JAB →'; labelColor = '#5ec4db'
  } else if ((angles.rArmX as number) > 100 && (angles.rArmY as number) > -20) {
    label = 'CROSS →'; labelColor = '#a78bfa'
  } else if ((angles.lArmX as number) > 50 && (angles.lArmY as number) < -20) {
    label = 'HOOK ↗'; labelColor = '#5ec4db'
  } else if ((angles.rArmY as number) < -40) {
    label = 'UPPERCUT ↑'; labelColor = '#a78bfa'
  }

  return (
    <g>
      <Ground y={GY} />

      {/* ── CHAIR (background) ── */}
      <rect x={148} y={100} width={10} height={seatY - 95} rx={4} fill="#4a5568" />
      <rect x={155} y={seatY} width={90} height={8} rx={3} fill="#4a5568" />
      <rect x={155} y={seatY + 8} width={8} height={GY - seatY - 10} fill="#4a5568" />
      <rect x={237} y={seatY + 8} width={8} height={GY - seatY - 10} fill="#4a5568" />

      {/* ── FAR SIDE (behind body) ── */}
      <Bone x1={cx + 15} y1={hipY} x2={cx + 25} y2={hipY + 48} w={14} color="#6a98b0" />
      <Bone x1={cx + 25} y1={hipY + 48} x2={cx + 35} y2={GY - 12} w={12} color="#6a98b0" />
      <Foot x={cx + 35} y={GY - 8} color="#5a8898" />

      <Bone x1={cx + 15} y1={shoulderY + 4} x2={rEndX} y2={rEndY} w={12}
        color={rPunch ? '#9080cc' : '#6a98b0'} />
      <Hand x={rEndX} y={rEndY} r={9} color={rPunch ? '#a78bfa' : '#d0c0a5'} />

      {/* ── BODY CENTER ── */}
      <Glow x={cx} y={hipY - 22} rx={20} ry={12} on={lPunch || rPunch} color="#f59e0b" />
      <Bone x1={cx} y1={hipY} x2={cx} y2={shoulderY} w={22} color="#8cb8d0" />

      {/* ── NEAR SIDE (in front of body) ── */}
      <Bone x1={cx - 15} y1={hipY} x2={cx - 25} y2={hipY + 48} w={16} color="#8cb8d0" />
      <Bone x1={cx - 25} y1={hipY + 48} x2={cx - 35} y2={GY - 12} w={14} color="#8cb8d0" />
      <Foot x={cx - 35} y={GY - 8} />

      {/* ── HEAD (in front of torso) ── */}
      <Head x={cx} y={headY} r={22} look={1} />

      {/* ── NEAR ARM (left, always in front) ── */}
      <Bone x1={cx - 15} y1={shoulderY + 4} x2={lEndX} y2={lEndY} w={13}
        color={lPunch ? '#5ec4db' : '#8cb8d0'} />
      <Hand x={lEndX} y={lEndY} r={10} color={lPunch ? '#22d3ee' : '#e8d5c0'} />

      {/* ── EFFECTS & LABELS ── */}
      {(lPunch || rPunch) && (
        <circle
          cx={lPunch ? lEndX : rEndX}
          cy={lPunch ? lEndY : rEndY}
          r={16}
          fill={labelColor}
          opacity={0.12}
        />
      )}
      {label && (
        <text x={370} y={72} fill={labelColor} fontSize="15" fontWeight="bold" fontFamily="monospace">
          {label}
        </text>
      )}
    </g>
  )
}
