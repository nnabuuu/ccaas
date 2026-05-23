/**
 * Observe view registry — thin dispatcher.
 *
 * Each exercise-type plugin now declares its own `ObserveClassView` +
 * `ObserveStudentView` (see `student/exercise/plugins/built-in.tsx`). This
 * file routes a given observeType to the right pair by walking the plugin
 * registry first; only the discuss observe drawer (not an exercise type)
 * still lives in the local fallback table.
 *
 * Adding a new exercise observe type: declare the views on the plugin —
 * nothing to add here.
 */
import { lazy } from 'react'
import type { ComponentType } from 'react'
// Side-effect: register all built-in exercise plugins so their observe
// views are reachable via getExerciseType().
import '../../student/exercise/plugins/built-in'
import { getRegisteredTypes, getExerciseType } from '../../student/exercise/plugins'

const DiscussClassView = lazy(() => import('./discuss/DiscussClassView'))
const DiscussStudentView = lazy(() => import('./discuss/DiscussStudentView'))

export interface ObserveClassViewProps {
  data: any // eslint-disable-line @typescript-eslint/no-explicit-any
  onStudentSelect: (studentId: string) => void
}

export interface ObserveStudentViewProps {
  data: any // eslint-disable-line @typescript-eslint/no-explicit-any
  studentId: string
}

export interface ObserveViewEntry {
  ClassView: ComponentType<ObserveClassViewProps>
  StudentView: ComponentType<ObserveStudentViewProps>
  /** Whether ClassView expects `mapData` rather than plain `data` (legacy quirk) */
  useMapData?: boolean
}

/**
 * Fallback registry for observe types that aren't exercise plugins —
 * `discuss` is a phase, not a question type, so it has no
 * ExerciseUIPlugin to attach to.
 */
const fallbackRegistry: Record<string, ObserveViewEntry> = {
  discuss: { ClassView: DiscussClassView, StudentView: DiscussStudentView },
}

/** Find the plugin whose observeType (defaulting to plugin.type) matches. */
function findPluginByObserveType(observeType: string): ReturnType<typeof getExerciseType> | undefined {
  for (const type of getRegisteredTypes()) {
    const plugin = getExerciseType(type)
    if (!plugin) continue
    if (plugin.observeType === null) continue
    const effective = plugin.observeType ?? plugin.type
    if (effective !== observeType) continue
    if (plugin.ObserveClassView && plugin.ObserveStudentView) return plugin
  }
  return undefined
}

/**
 * Look up the observe view pair for a given observe type.
 * Plugin registry wins; falls back to the local table (discuss only).
 * Returns null when nothing matches.
 */
export function getObserveView(type: string | undefined | null): ObserveViewEntry | null {
  if (!type) return null
  const plugin = findPluginByObserveType(type)
  if (plugin?.ObserveClassView && plugin?.ObserveStudentView) {
    return {
      ClassView: plugin.ObserveClassView as ComponentType<ObserveClassViewProps>,
      StudentView: plugin.ObserveStudentView as ComponentType<ObserveStudentViewProps>,
      ...(plugin.observeUseMapData && { useMapData: true }),
    }
  }
  return fallbackRegistry[type] ?? null
}

export function getRegisteredObserveTypes(): string[] {
  const fromPlugins = new Set<string>()
  for (const type of getRegisteredTypes()) {
    const plugin = getExerciseType(type)
    if (!plugin || plugin.observeType === null) continue
    if (!plugin.ObserveClassView || !plugin.ObserveStudentView) continue
    fromPlugins.add(plugin.observeType ?? plugin.type)
  }
  return [...fromPlugins, ...Object.keys(fallbackRegistry)]
}
