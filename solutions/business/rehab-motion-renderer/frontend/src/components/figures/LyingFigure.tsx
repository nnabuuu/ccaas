// ═══════════════════════════════════════════
// LYING FIGURE RENDERER (仰卧位)
// Ported from fitness-v3.jsx LyingFigure — do not change joint positions or z-ordering
// ═══════════════════════════════════════════

import { jointPos } from '../../engine/animation'
import { Bone, Head, Hand, Foot, Ground, Glow } from './Primitives'
import type { Keyframe } from '../../types'

interface LyingFigureProps {
  angles: Keyframe
  exerciseId: string
}

export function LyingFigure({ angles, exerciseId }: LyingFigureProps) {
  const GY = 260
  const hipX = 285, hipY = GY - 16
  const shoulderX = 175, shoulderY = hipY
  const tilt = (angles.tilt as number) || 0
  const hipYAdj = hipY - tilt * 6

  // Forward kinematics: legs
  const rKnee = jointPos(hipX, hipYAdj, angles.rHip as number, 50)
  const rFoot = jointPos(rKnee.x, rKnee.y, (angles.rHip as number) + (angles.rKnee as number), 44)
  const lKnee = jointPos(hipX + 5, hipYAdj + 3, angles.lHip as number, 47)
  const lFoot = jointPos(lKnee.x, lKnee.y, (angles.lHip as number) + (angles.lKnee as number), 42)

  // Arms from shoulder area
  const rElbow = jointPos(shoulderX + 30, shoulderY + 2, angles.rSh as number, 28)
  const rHand = jointPos(rElbow.x, rElbow.y, angles.rSh as number, 24)
  const lElbow = jointPos(shoulderX + 15, shoulderY - 2, angles.lSh as number, 30)
  const lHand = jointPos(lElbow.x, lElbow.y, angles.lSh as number, 26)

  const rLegActive = (angles.rHip as number) > -60
  const lLegActive = (angles.lHip as number) > -55
  const rArmActive = (angles.rSh as number) < -120
  const lArmActive = (angles.lSh as number) < -120
  const coreActive = rLegActive || lLegActive || tilt > 0.5

  // Render order: ground → far arm → far leg → torso → head → near leg → near arm → labels

  return (
    <g>
      <Ground y={GY} />
      <text x={400} y={GY - 5} fill="#2a3a4a" fontSize="10" fontFamily="monospace">地面</text>

      {/* Towel */}
      <rect x={210} y={hipY - 3} width={48} height={7} rx={3.5} fill="#f59e0b" opacity={0.35} />

      {/* Back gap indicator for pelvic-tilt */}
      {exerciseId === 'pelvic-tilt' && tilt < 0.6 && (
        <path
          d={`M 215 ${hipY - 8 * (1 - tilt)} Q 234 ${hipY - 14 * (1 - tilt)} 253 ${hipY - 8 * (1 - tilt)}`}
          fill="none"
          stroke="#f87171"
          strokeWidth={1.5}
          strokeDasharray="3,3"
          opacity={0.5 * (1 - tilt)}
        />
      )}
      {exerciseId === 'pelvic-tilt' && tilt > 0.7 && (
        <text x={215} y={hipY - 16} fill="#22d3ee" fontSize="10" fontFamily="monospace" fontWeight="bold">
          ✓ 腰贴地面
        </text>
      )}

      <Glow x={235} y={hipYAdj - 10} rx={38} ry={18} on={coreActive} />

      {/* ── FAR SIDE (behind body) ── */}
      <Bone x1={shoulderX + 30} y1={shoulderY + 2} x2={rElbow.x} y2={rElbow.y} w={10}
        color={rArmActive ? '#9080cc' : '#6a98b0'} />
      <Hand x={rHand.x} y={rHand.y} r={7} color={rArmActive ? '#8a7acc' : '#d4c4aa'} />

      <Bone x1={hipX + 5} y1={hipYAdj + 3} x2={lKnee.x} y2={lKnee.y} w={14}
        color={lLegActive ? '#4aacbf' : '#6a98b0'} />
      <Bone x1={lKnee.x} y1={lKnee.y} x2={lFoot.x} y2={lFoot.y} w={12}
        color={lLegActive ? '#4aacbf' : '#6a98b0'} />
      <Foot x={lFoot.x} y={lFoot.y} color={lLegActive ? '#35a5bf' : '#6a98b0'} />

      {/* ── BODY CENTER ── */}
      <Bone x1={shoulderX + 10} y1={shoulderY} x2={hipX} y2={hipYAdj} w={22} color="#8cb8d0" />
      <Head x={shoulderX - 30} y={shoulderY - 8} r={20} look={0} />

      {/* ── NEAR SIDE (in front of body) ── */}
      <Bone x1={hipX} y1={hipYAdj} x2={rKnee.x} y2={rKnee.y} w={16}
        color={rLegActive ? '#5ec4db' : '#8cb8d0'} />
      <Bone x1={rKnee.x} y1={rKnee.y} x2={rFoot.x} y2={rFoot.y} w={14}
        color={rLegActive ? '#5ec4db' : '#8cb8d0'} />
      <Foot x={rFoot.x} y={rFoot.y} color={rLegActive ? '#3db8d3' : '#7a9fb5'} />

      <Bone x1={shoulderX + 15} y1={shoulderY - 2} x2={lElbow.x} y2={lElbow.y} w={12}
        color={lArmActive ? '#b49aed' : '#8cb8d0'} />
      <Hand x={lHand.x} y={lHand.y} r={8} color={lArmActive ? '#a78bfa' : '#e8d5c0'} />

      {/* ── LABELS ── */}
      {exerciseId === 'pelvic-tilt' && tilt > 0.9 && (
        <text x={230} y={hipYAdj - 42} fill="#22d3ee" fontSize="16" fontWeight="bold"
          fontFamily="monospace" textAnchor="middle">
          HOLD 保持
        </text>
      )}
      {rLegActive && (
        <text x={rFoot.x + 8} y={rFoot.y - 6} fill="#22d3ee" fontSize="15">→</text>
      )}
      {lLegActive && (
        <text x={lFoot.x + 8} y={lFoot.y - 6} fill="#22d3ee" fontSize="15">→</text>
      )}
      {rArmActive && (
        <text x={rHand.x - 18} y={rHand.y - 4} fill="#a78bfa" fontSize="15">←</text>
      )}
      {lArmActive && (
        <text x={lHand.x - 18} y={lHand.y - 4} fill="#a78bfa" fontSize="15">←</text>
      )}
    </g>
  )
}
