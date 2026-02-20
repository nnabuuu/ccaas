// ═══════════════════════════════════════════
// SKELETON RENDERER PRIMITIVES
// Ported from fitness-v3.jsx — do not change visual parameters
// ═══════════════════════════════════════════

interface BoneProps {
  x1: number
  y1: number
  x2: number
  y2: number
  w?: number
  color?: string
  jointR?: number
}

export function Bone({ x1, y1, x2, y2, w = 14, color = '#8cb8d0', jointR }: BoneProps) {
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={w} strokeLinecap="round" />
      <circle cx={x1} cy={y1} r={jointR || w * 0.42} fill="#6a98b0" />
    </g>
  )
}

interface HeadProps {
  x: number
  y: number
  r?: number
  color?: string
  look?: number
}

export function Head({ x, y, r = 20, color = '#8cb8d0', look = 0 }: HeadProps) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={color} />
      <circle cx={x + look * 5} cy={y - 4} r={2.8} fill="#1e3a4e" />
      <ellipse cx={x + look * 2} cy={y + 6} rx={4.5} ry={2.2} fill="#1e3a4e" opacity={0.25} />
    </g>
  )
}

interface HandProps {
  x: number
  y: number
  r?: number
  color?: string
}

export function Hand({ x, y, r = 8, color = '#e8d5c0' }: HandProps) {
  return <circle cx={x} cy={y} r={r} fill={color} />
}

interface FootProps {
  x: number
  y: number
  color?: string
}

export function Foot({ x, y, color = '#7a9fb5' }: FootProps) {
  return <ellipse cx={x + 5} cy={y} rx={13} ry={7} fill={color} />
}

interface GroundProps {
  y: number
}

export function Ground({ y }: GroundProps) {
  return <line x1={20} y1={y} x2={480} y2={y} stroke="#2a3a4a" strokeWidth={2} />
}

interface GlowProps {
  x: number
  y: number
  rx?: number
  ry?: number
  on: boolean
  color?: string
}

export function Glow({ x, y, rx = 25, ry = 15, on, color = '#22d3ee' }: GlowProps) {
  if (!on) return null
  return (
    <g>
      <ellipse cx={x} cy={y} rx={rx + 8} ry={ry + 5} fill={color} opacity={0.07} />
      <ellipse
        cx={x}
        cy={y}
        rx={rx}
        ry={ry}
        fill="none"
        stroke={color}
        strokeWidth={2}
        opacity={0.35}
        strokeDasharray="5,4"
      />
    </g>
  )
}
