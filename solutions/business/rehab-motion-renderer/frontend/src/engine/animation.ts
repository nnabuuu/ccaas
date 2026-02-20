// ═══════════════════════════════════════════
// ANIMATION ENGINE
// Ported from fitness-v3.jsx — do not change easing/interpolation logic
// ═══════════════════════════════════════════

import type { Keyframe } from '../types'

/** Sine easing: smooth in-out curve */
export function ease(t: number): number {
  return (1 - Math.cos(Math.PI * Math.max(0, Math.min(1, t)))) / 2
}

/** Forward kinematics: compute endpoint given origin, angle, and length */
export function jointPos(
  x: number,
  y: number,
  angleDeg: number,
  length: number
): { x: number; y: number } {
  const r = (angleDeg * Math.PI) / 180
  return { x: x + Math.cos(r) * length, y: y + Math.sin(r) * length }
}

/**
 * Interpolate between keyframes given a continuous progress value.
 * progress: 0 → keyframes.length-1 (continuous float)
 */
export function interpolate(keyframes: Keyframe[], progress: number): Keyframe {
  const maxIdx = keyframes.length - 1
  const clamped = Math.max(0, Math.min(progress, maxIdx))
  const i = Math.min(Math.floor(clamped), maxIdx - 1)
  const t = ease(clamped - i)
  const from = keyframes[i]
  const to = keyframes[i + 1] || from
  const result: Keyframe = {}
  for (const k of Object.keys(from)) {
    if (typeof from[k] === 'number') {
      result[k] = from[k] + (to[k] - from[k]) * t
    }
  }
  return result
}

/**
 * Compute animation speed: keyframes per second
 * numKF: number of keyframes, totalDur: total phase duration in seconds
 */
export function animationSpeed(numKF: number, totalDur: number): number {
  return (numKF - 1) / totalDur
}
