/**
 * Observe view registry.
 *
 * Replaces 14 conditional renders in ObserveDrawer with a table-driven
 * lookup keyed on observeType. Maps each observe type to its ClassView and
 * StudentView components (lazy-loaded). Aliases (e.g. quiz → mc) are handled
 * upstream by the call site or by ExerciseUIPlugin.observeType.
 *
 * Adding a new observe type requires only one entry here (and the
 * corresponding components on disk).
 */
import { lazy } from 'react'
import type { ComponentType } from 'react'

const McClassView = lazy(() => import('./mc/McClassView'))
const McStudentView = lazy(() => import('./mc/McStudentView'))
const EvidenceClassView = lazy(() => import('./evidence/EvidenceClassView'))
const EvidenceStudentView = lazy(() => import('./evidence/EvidenceStudentView'))
const MapClassView = lazy(() => import('./map/MapClassView'))
const MapStudentView = lazy(() => import('./map/MapStudentView'))
const DiscussClassView = lazy(() => import('./discuss/DiscussClassView'))
const DiscussStudentView = lazy(() => import('./discuss/DiscussStudentView'))
const MatrixClassView = lazy(() => import('./matrix/MatrixClassView'))
const MatrixStudentView = lazy(() => import('./matrix/MatrixStudentView'))
const ImageUploadClassView = lazy(() => import('./image-upload/ImageUploadClassView'))
const ImageUploadStudentView = lazy(() => import('./image-upload/ImageUploadStudentView'))
const GdClassView = lazy(() => import('./guided-discovery/GdClassView'))
const GdStudentView = lazy(() => import('./guided-discovery/GdStudentView'))

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

const registry: Record<string, ObserveViewEntry> = {
  mc: { ClassView: McClassView, StudentView: McStudentView },
  evidence: { ClassView: EvidenceClassView, StudentView: EvidenceStudentView },
  map: { ClassView: MapClassView, StudentView: MapStudentView, useMapData: true },
  discuss: { ClassView: DiscussClassView, StudentView: DiscussStudentView },
  matrix: { ClassView: MatrixClassView, StudentView: MatrixStudentView },
  'image-upload': { ClassView: ImageUploadClassView, StudentView: ImageUploadStudentView },
  'guided-discovery': { ClassView: GdClassView, StudentView: GdStudentView },
}

/** Look up the observe view pair for a given observe type. Returns null when none. */
export function getObserveView(type: string | undefined | null): ObserveViewEntry | null {
  if (!type) return null
  return registry[type] ?? null
}

/** Register an observe view (used by plugins / extension packs). */
export function registerObserveView(type: string, entry: ObserveViewEntry): void {
  if (registry[type]) {
    // eslint-disable-next-line no-console
    console.warn(`[observe-view-registry] duplicate observe type "${type}" — overriding`)
  }
  registry[type] = entry
}

export function getRegisteredObserveTypes(): string[] {
  return Object.keys(registry)
}
