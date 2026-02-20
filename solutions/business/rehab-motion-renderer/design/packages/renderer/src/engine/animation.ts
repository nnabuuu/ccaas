/**
 * Animation Engine
 *
 * Core functions extracted from the fitness-v3.jsx reference implementation.
 * Handles keyframe interpolation and forward kinematics for SVG skeleton rendering.
 */

import type { Keyframe } from "../types/config";

/**
 * Sine easing function.
 * Maps linear t (0→1) to smooth ease-in-out curve.
 */
export function ease(t: number): number {
  return (1 - Math.cos(Math.PI * Math.max(0, Math.min(1, t)))) / 2;
}

/**
 * Forward kinematics: compute end position from joint angle.
 *
 * @param x - Joint origin X
 * @param y - Joint origin Y
 * @param angleDeg - Joint angle in degrees (0=right, -90=up, +90=down)
 * @param length - Bone length in SVG units
 * @returns End position {x, y}
 */
export function jointPos(
  x: number,
  y: number,
  angleDeg: number,
  length: number
): { x: number; y: number } {
  const r = (angleDeg * Math.PI) / 180;
  return {
    x: x + Math.cos(r) * length,
    y: y + Math.sin(r) * length,
  };
}

/**
 * Interpolate between keyframes with sine easing.
 *
 * @param keyframes - Array of keyframe objects (all must have same numeric keys)
 * @param progress - Continuous value from 0 to keyframes.length-1
 * @returns Interpolated keyframe with all numeric fields blended
 *
 * @example
 * ```ts
 * const kf = [
 *   { rHip: -75, rKnee: 75, tilt: 0 },
 *   { rHip: -78, rKnee: 75, tilt: 1 },
 * ];
 * interpolate(kf, 0.5);
 * // → { rHip: -76.5, rKnee: 75, tilt: 0.5 } (approximately, with sine easing)
 * ```
 */
export function interpolate(
  keyframes: Keyframe[],
  progress: number
): Keyframe {
  const maxIdx = keyframes.length - 1;
  const clamped = Math.max(0, Math.min(progress, maxIdx));
  const i = Math.min(Math.floor(clamped), maxIdx - 1);
  const t = ease(clamped - i);
  const from = keyframes[i];
  const to = keyframes[i + 1] || from;

  const result: Keyframe = {};
  for (const k of Object.keys(from)) {
    if (typeof from[k] === "number") {
      result[k] = from[k] + ((to[k] as number) - from[k]) * t;
    }
  }
  return result;
}

/**
 * Compute which phase index we're currently in, given progress and phase durations.
 *
 * @param progress - Current progress (0 → numKeyframes-1)
 * @param numKeyframes - Total number of keyframes
 * @param phaseDurations - Duration of each phase in seconds
 * @returns Current phase index (0-based)
 */
export function currentPhaseIndex(
  progress: number,
  numKeyframes: number,
  phaseDurations: number[]
): number {
  const totalDur = phaseDurations.reduce((a, b) => a + b, 0);
  const progressRatio = progress / (numKeyframes - 1);

  let cumDur = 0;
  for (let i = 0; i < phaseDurations.length; i++) {
    cumDur += phaseDurations[i];
    if (progressRatio <= cumDur / totalDur) {
      return i;
    }
  }
  return phaseDurations.length - 1;
}

/**
 * Compute animation speed: how fast progress advances per second.
 *
 * @param numKeyframes - Total keyframes
 * @param phaseDurations - Duration array
 * @returns Progress units per second
 */
export function animationSpeed(
  numKeyframes: number,
  phaseDurations: number[]
): number {
  const totalDur = phaseDurations.reduce((a, b) => a + b, 0);
  return (numKeyframes - 1) / totalDur;
}
