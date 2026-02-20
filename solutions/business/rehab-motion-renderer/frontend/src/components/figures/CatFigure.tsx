// ═══════════════════════════════════════════
// CAT FIGURE RENDERER (四点跪姿 / 猫式)
// Ported from fitness-v3.jsx CatFigure — do not change joint positions or z-ordering
// ═══════════════════════════════════════════

import { Bone, Head, Hand, Ground } from './Primitives'
import type { Keyframe } from '../../types'

interface CatFigureProps {
  angles: Keyframe
}

export function CatFigure({ angles }: CatFigureProps) {
  const GY = 270
  const sp = angles.spine as number // -1 (cat/up) to +0.3 (cow/down)
  const shoulderX = 150, hipX = 350
  const spineY = 150 + sp * 40
  const headY = spineY - 18 + (angles.headDrop as number)
  const handY = GY - 10, kneeY = GY - 10
  const isCat = sp < -0.3, isCow = sp > 0.15

  // Render order: ground → far knee+leg → far hand+arm → spine → near knee+leg → near hand+arm → head → labels

  return (
    <g>
      <Ground y={GY} />

      {/* ── FAR SIDE (behind body) ── */}
      <circle cx={hipX + 28} cy={kneeY} r={6} fill="#5a8898" />
      <Bone x1={hipX + 28} y1={kneeY} x2={hipX - 3} y2={spineY + 16} w={13} color="#6a98b0" />
      <Bone x1={shoulderX} y1={handY} x2={shoulderX + 20} y2={spineY + 12} w={12} color="#6a98b0" />
      <Hand x={shoulderX} y={handY} r={8} color="#d0c0a5" />

      {/* ── SPINE (center body) ── */}
      <path
        d={`M ${shoulderX + 25} ${spineY + 8} Q ${250} ${spineY + sp * 28 - 14} ${hipX - 12} ${spineY + 10}`}
        fill="none"
        stroke={isCat ? '#5ec4db' : isCow ? '#f59e0b' : '#8cb8d0'}
        strokeWidth={24}
        strokeLinecap="round"
      />
      {isCat && (
        <path
          d={`M ${shoulderX + 25} ${spineY + 8} Q ${250} ${spineY + sp * 28 - 14} ${hipX - 12} ${spineY + 10}`}
          fill="none"
          stroke="#22d3ee"
          strokeWidth={36}
          strokeLinecap="round"
          opacity={0.1}
        />
      )}

      {/* Tail hint */}
      <path
        d={`M ${hipX} ${spineY + 5} Q ${hipX + 15} ${spineY - 10} ${hipX + 5} ${spineY - 5}`}
        fill="none"
        stroke="#6a98b0"
        strokeWidth={4}
        strokeLinecap="round"
        opacity={0.4}
      />

      {/* ── NEAR SIDE (in front of body) ── */}
      <circle cx={hipX + 15} cy={kneeY} r={7} fill="#6a98b0" />
      <Bone x1={hipX + 15} y1={kneeY} x2={hipX - 8} y2={spineY + 14} w={15} color="#8cb8d0" />
      <Bone x1={shoulderX - 15} y1={handY} x2={shoulderX + 15} y2={spineY + 10} w={14} color="#8cb8d0" />
      <Hand x={shoulderX - 15} y={handY} r={9} />

      {/* ── HEAD (always in front) ── */}
      <Head
        x={shoulderX - 10}
        y={headY}
        r={20}
        color={isCat ? '#5ec4db' : isCow ? '#d4a574' : '#8cb8d0'}
        look={-1}
      />

      {/* ── LABELS ── */}
      {isCat && (
        <>
          <text x={250} y={spineY - 38} fill="#22d3ee" fontSize="14" fontWeight="bold"
            fontFamily="monospace" textAnchor="middle">
            ↑ 弓背 · 呼气
          </text>
          <text x={250} y={spineY - 22} fill="#22d3ee" fontSize="10"
            fontFamily="monospace" textAnchor="middle" opacity={0.7}>
            椎管空间打开
          </text>
        </>
      )}
      {isCow && (
        <text x={250} y={spineY - 28} fill="#f59e0b" fontSize="12" fontWeight="bold"
          fontFamily="monospace" textAnchor="middle">
          ↓ 轻微塌腰 · 吸气 · 幅度减半!
        </text>
      )}
    </g>
  )
}
