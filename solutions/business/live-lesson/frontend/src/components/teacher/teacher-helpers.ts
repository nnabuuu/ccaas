import type { ClassroomState } from '../../hooks/useClassroom'
import type { ReadingManifest, ReadingStep, PhaseConfig } from '../../types/reading'
// Side-effect import: populates the exercise plugin registry. We dispatch
// `getObserveType` through the registry below so each plugin owns its own
// `observeType` declaration — no hardcoded switch in this file.
import '../student/exercise/plugins/built-in'
import { getExerciseType } from '../student/exercise/plugins'

export const STUCK_THRESHOLD_MS = 180_000 // 3 minutes
export const HIGHLIGHT_MATCH_TOLERANCE_MS = 120_000 // 2 minutes

/** Build a lookup map from highlights: studentName → detectedAt timestamps */
export function buildHighlightLookup(highlights: Array<{ studentName: string; detectedAt: number }>): Map<string, number[]> {
  const map = new Map<string, number[]>()
  for (const h of highlights) {
    const arr = map.get(h.studentName) ?? []
    arr.push(h.detectedAt)
    map.set(h.studentName, arr)
  }
  return map
}

/** Check if a (studentName, timestamp) pair matches any highlight within tolerance */
export function isHighlightMatch(lookup: Map<string, number[]>, name: string, ts: number): boolean {
  const times = lookup.get(name)
  return times ? times.some(t => Math.abs(t - ts) < HIGHLIGHT_MATCH_TOLERANCE_MS) : false
}

/** Find the matching highlight object for a (studentName, timestamp) pair — single O(1) map + O(k) scan */
export function findHighlightGist(
  lookup: Map<string, number[]>,
  highlights: Array<{ studentName: string; detectedAt: number; gist?: string }>,
  name: string,
  ts: number,
): string | undefined {
  const times = lookup.get(name)
  if (!times) return undefined
  const matchTs = times.find(t => Math.abs(t - ts) < HIGHLIGHT_MATCH_TOLERANCE_MS)
  if (matchTs === undefined) return undefined
  return highlights.find(h => h.studentName === name && h.detectedAt === matchTs)?.gist
}

export type StudentStatus = 'done' | 'prog' | 'stuck' | 'reading'

// ── Question Clustering ──

type Question = ClassroomState['questions'][number]

export interface QuestionCluster {
  representative: Question
  category: string
  students: string[]
  items: Question[]
}

function normalizeQuestion(text: string): string {
  return text.toLowerCase().replace(/[^\w\u4e00-\u9fff]/g, '').trim()
}

function tokenOverlap(a: string, b: string): number {
  // For Chinese text, use character-level overlap; for English, token-level
  const tokA = new Set(a.length > 0 && /[\u4e00-\u9fff]/.test(a) ? [...a] : a.split(/\s+/))
  const tokB = new Set(b.length > 0 && /[\u4e00-\u9fff]/.test(b) ? [...b] : b.split(/\s+/))
  if (tokA.size === 0 || tokB.size === 0) return 0
  const intersection = [...tokA].filter(t => tokB.has(t)).length
  return intersection / Math.max(tokA.size, tokB.size)
}

export function clusterQuestions(questions: Question[]): QuestionCluster[] {
  const clusters: Array<QuestionCluster & { normRep: string }> = []

  for (const q of questions) {
    const norm = normalizeQuestion(q.question)
    const match = clusters.find(c =>
      norm === c.normRep || tokenOverlap(norm, c.normRep) > 0.7,
    )

    if (match) {
      if (!match.students.includes(q.studentName)) {
        match.students.push(q.studentName)
      }
      match.items.push(q)
    } else {
      clusters.push({
        representative: q,
        category: q.category || '其他',
        students: [q.studentName],
        items: [q],
        normRep: norm,
      })
    }
  }

  return clusters.sort((a, b) => b.students.length - a.students.length)
}

export function computeHealthCards(state: ClassroomState | null, stepNames: Record<number, string> = {}) {
  const getName = (n: number) => stepNames[n] || `T${n}`
  if (!state || !state.students.length) {
    return { fastest: { step: '--', count: 0 }, median: { step: '--', pct: 0 }, stuck: { count: 0, where: '' }, ai: { rounds: 0, people: 0 } }
  }
  const tasks = state.students.map(s => s.currentTask)
  const maxTask = Math.max(...tasks)
  const fastCount = tasks.filter(t => t === maxTask).length

  const sorted = [...tasks].sort((a, b) => a - b)
  const medTask = sorted[Math.floor(sorted.length / 2)]
  const medPct = Math.round((tasks.filter(t => t === medTask).length / tasks.length) * 100)

  const now = Date.now()
  const stuckStudents = state.students.filter(s => {
    if (!s.stepStartedAt) return false
    return (now - new Date(s.stepStartedAt).getTime()) > STUCK_THRESHOLD_MS
  })
  const stuckTasks = stuckStudents.map(s => s.currentTask)
  const stuckMode = stuckTasks.length ? mostCommon(stuckTasks) : 0

  return {
    fastest: { step: getName(maxTask), count: fastCount },
    median: { step: getName(medTask), pct: medPct },
    stuck: { count: stuckStudents.length, where: stuckMode ? getName(stuckMode) : '' },
    ai: { rounds: state.questions.length, people: new Set(state.questions.map(q => q.studentId)).size },
  }
}

export function mostCommon(arr: number[]): number {
  const counts: Record<number, number> = {}
  arr.forEach(v => { counts[v] = (counts[v] || 0) + 1 })
  return Number(Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 0)
}

export function getStudentStatus(student: ClassroomState['students'][0], stepNum: number): StudentStatus {
  const sub = student.submissions
  if (sub && sub[stepNum]?.score) return 'done'
  if (student.currentTask !== stepNum) return 'done' // past this step
  if (student.stepStartedAt) {
    const elapsed = Date.now() - new Date(student.stepStartedAt).getTime()
    if (elapsed > STUCK_THRESHOLD_MS) return 'stuck'
  }
  if (student.currentPhase === 'listen') return 'reading'
  return 'prog'
}

export function getStudentGlobalStatus(student: ClassroomState['students'][0]): StudentStatus {
  if (student.stepStartedAt) {
    const elapsed = Date.now() - new Date(student.stepStartedAt).getTime()
    if (elapsed > STUCK_THRESHOLD_MS) return 'stuck'
  }
  if (student.currentPhase === 'listen') return 'reading'
  const sub = student.submissions
  if (sub && sub[student.currentTask]?.score) return 'done'
  return 'prog'
}

export function hasAI(student: ClassroomState['students'][0], questions: ClassroomState['questions']): boolean {
  return questions.some(q => q.studentId === student.id)
}

export function getCatBadgeClass(cat: string): string {
  switch (cat) {
    case '概念理解': return 'concept'
    case '阅读策略': return 'strategy'
    case '课文内容': return 'content'
    case '解题求助': return 'task-help'
    case 'discuss': return 'discuss'
    default: return 'other'
  }
}

/** Strip [discuss:socratic:rN] prefix from question text */
export function stripDiscussTag(text: string): string {
  return text.replace(/^\[discuss:socratic:r\d+\]\s*/, '')
}

/** Phase display labels */
export const PHASE_LABELS: Record<string, string> = {
  listen: '阅读中',
  practice: '练习中',
  discuss: '讨论中',
  takeaway: '总结中',
}

export const getStepName = (rs: { displayName?: string; label?: string }) =>
  rs.displayName || rs.label || ''

export function formatRelative(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins}分钟前`
  return `${Math.floor(mins / 60)}小时前`
}

/** Phase distribution for a step: count students in each currentPhase */
export function computePhaseDistribution(
  students: ClassroomState['students'],
  stepNum: number,
  phaseIds: string[] = ['listen', 'practice', 'discuss', 'takeaway'],
): Record<string, number> {
  const dist: Record<string, number> = Object.fromEntries(phaseIds.map(id => [id, 0]))
  dist.completed = 0
  for (const s of students) {
    if (s.currentTask === stepNum) {
      const phase = s.currentPhase || phaseIds[0] || 'listen'
      if (phase in dist) dist[phase]++
      else dist[phaseIds[0]]++
    } else if (s.currentTask > stepNum) {
      dist.completed++
    }
  }
  return dist
}

// ── Phase Config Helpers ──

const DEFAULT_PHASE_CONFIG: PhaseConfig[] = [
  { id: 'listen', label: '阅读中', unlockAfter: null },
  { id: 'practice', label: '练习中', unlockAfter: 'listen' },
  { id: 'discuss', label: '讨论中', unlockAfter: 'practice' },
  { id: 'takeaway', label: '总结中', unlockAfter: 'discuss' },
]

export function getEffectivePhaseConfig(
  step: ReadingStep, manifest: ReadingManifest,
): PhaseConfig[] {
  if (step.phaseConfig?.length) return step.phaseConfig
  if (manifest.phaseConfig?.length) return manifest.phaseConfig
  return DEFAULT_PHASE_CONFIG
}

const PHASE_ICONS: Record<string, string> = {
  listen: '🎧', practice: '✏️', discuss: '💬',
  takeaway: '📝', discovery: '🔍',
}

export function getPhaseIcon(phaseId: string): string {
  if (PHASE_ICONS[phaseId]) return PHASE_ICONS[phaseId]
  if (phaseId.startsWith('practice')) return '✏️'
  return '📋'
}

/**
 * Map an answerKey type to its teacher-observe drawer type.
 *
 * Routes through the exercise plugin registry — each plugin's `observeType`
 * declaration is the source of truth. Returns:
 *  - `null` when there's no registered plugin or the plugin opts out
 *    (e.g. stance / fill-blank declare `observeType: null`)
 *  - the plugin's `observeType` when set (e.g. quiz/match/order → 'mc',
 *    select-evidence → 'evidence', rich-content-quiz → 'image-upload')
 *  - the plugin's own `type` as a fallback (matrix/map/guided-discovery/
 *    image-upload — where observe drawer name == plugin type)
 */
export function getObserveType(answerKeyType?: string): string | null {
  if (!answerKeyType) return null
  const plugin = getExerciseType(answerKeyType)
  if (!plugin) return null
  if (plugin.observeType === null) return null
  return plugin.observeType ?? plugin.type
}

/** Count all isHighlight observations across all cluster stats */
export function countHighlights(clusterStats: ClassroomState['clusterStats']): number {
  if (!clusterStats) return 0
  let count = 0
  for (const data of Object.values(clusterStats)) {
    for (const cluster of data.clusters) {
      count += cluster.observations.filter(o => o.isHighlight).length
    }
  }
  return count
}

/** Group students by their current status */
export function groupStudentsByStatus(students: ClassroomState['students']): Record<StudentStatus, ClassroomState['students']> {
  const groups: Record<StudentStatus, ClassroomState['students']> = {
    done: [], prog: [], stuck: [], reading: [],
  }
  for (const s of students) {
    const status = getStudentGlobalStatus(s)
    groups[status].push(s)
  }
  return groups
}
