/**
 * Manifest helpers.
 *
 * Sanitize used to live here as a hardcoded `sanitizers: Record<string, fn>` dict
 * that mirrored each exercise type's plugin.sanitize() — meaning new types had
 * to be added in two places. That has been removed: sanitize now dispatches
 * through `ExerciseTypeRegistry.sanitize()` (per-type via plugin) and
 * `ExerciseTypeRegistry.sanitizeManifest()` (walks all readingSteps).
 *
 * `seededShuffle` stays here because it's a pure helper used by exercise.service
 * for map randomized practice — no exercise-type knowledge needed.
 */

/** Deterministic shuffle using a string seed (djb2 hash → Fisher-Yates) */
export function seededShuffle<T>(arr: T[], seed: string): T[] {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0;
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    h = ((h << 5) + h + i) >>> 0;
    const j = h % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
