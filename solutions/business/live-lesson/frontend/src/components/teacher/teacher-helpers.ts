import type { ClassroomState } from '../../hooks/useClassroom'

export const STUCK_THRESHOLD_MS = 180_000 // 3 minutes

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
): { listen: number; practice: number; discuss: number; takeaway: number; completed: number } {
  const dist = { listen: 0, practice: 0, discuss: 0, takeaway: 0, completed: 0 }
  for (const s of students) {
    if (s.currentTask === stepNum) {
      const phase = (s.currentPhase || 'listen') as keyof typeof dist
      if (phase in dist) dist[phase]++
    } else if (s.currentTask > stepNum) {
      dist.completed++
    }
  }
  return dist
}

/** Map answerKey type to observe drawer type */
export function getObserveType(answerKeyType?: string): string | null {
  if (!answerKeyType) return null
  switch (answerKeyType) {
    case 'quiz': case 'match': case 'order': return 'mc'
    case 'select-evidence': return 'evidence'
    case 'map': return 'map'
    case 'matrix': return 'matrix'
    default: return null
  }
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
