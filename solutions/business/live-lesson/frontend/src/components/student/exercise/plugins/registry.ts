/**
 * Frontend Exercise Type Plugin Registry.
 *
 * Lightweight Map-based registry (no React Context needed). Plugins register
 * themselves via `registerExerciseType()` at module load time. Look-up via
 * `getExerciseType()`. The `built-in.ts` side-effect import wires all 11
 * existing types automatically.
 */
import type { ExerciseUIPlugin } from './types'

const registry = new Map<string, ExerciseUIPlugin>()

/** Register a plugin. Last writer wins; warns on duplicates. */
export function registerExerciseType(plugin: ExerciseUIPlugin): void {
  if (registry.has(plugin.type)) {
    // eslint-disable-next-line no-console
    console.warn(`[ExerciseRegistry] duplicate plugin for "${plugin.type}" — overriding`)
  }
  registry.set(plugin.type, plugin)
}

/** Look up a plugin by its type identifier. Returns undefined when none registered. */
export function getExerciseType(type: string | undefined | null): ExerciseUIPlugin | undefined {
  if (!type) return undefined
  return registry.get(type)
}

/** All registered type identifiers (used by Inspector/debug). */
export function getRegisteredTypes(): string[] {
  return [...registry.keys()]
}

/** Reset the registry — only for tests. */
export function __resetRegistryForTests(): void {
  registry.clear()
}
