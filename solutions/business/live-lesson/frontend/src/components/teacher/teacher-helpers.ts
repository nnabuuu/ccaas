import type { ClassroomState } from '../../hooks/useClassroom'

export const STUCK_THRESHOLD_MS = 180_000 // 3 minutes

export type StudentStatus = 'done' | 'prog' | 'stuck' | 'reading'

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
    default: return 'other'
  }
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
