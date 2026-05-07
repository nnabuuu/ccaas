import type { ClassroomState } from '../../../hooks/useClassroom'

type Student = ClassroomState['students'][number]
type StepMetrics = NonNullable<ClassroomState['stepMetrics']>
type Questions = ClassroomState['questions']

// ── Types ──

export type Quadrant = 'star' | 'struggling' | 'coasting' | 'at-risk'

export interface StudentQuadrantData {
  id: string
  name: string
  mastery: number      // 0-100
  engagement: number   // 0-100
  quadrant: Quadrant
  /** Steps where student scored below class average */
  weakSteps: number[]
  /** Total submissions count */
  submissionCount: number
}

export interface SummaryMetrics {
  overallMastery: number
  starCount: number
  atRiskCount: number
  coastingCount: number
  strugglingCount: number
  weakDimensionCount: number
}

export interface WeakDimension {
  stepNum: number
  stepName: string
  dimension: string
  wrongRate: number    // 0-100
}

export interface QuestionCandidate {
  student: StudentQuadrantData
  intent: 'showcase' | 'verify' | 'expose'
  intentLabel: string
  reason: string
}

// ── Step Mapping ──

export function buildStepMapping(taskSteps: Array<{ idx: number }>): {
  stepToTask: Record<number, number>
  taskToStep: Record<number, number>
} {
  const stepToTask: Record<number, number> = {}
  const taskToStep: Record<number, number> = {}
  taskSteps.forEach((rs, i) => {
    const taskNum = i + 1
    stepToTask[rs.idx] = taskNum
    taskToStep[taskNum] = rs.idx
  })
  return { stepToTask, taskToStep }
}

// ── Constants ──

const MASTERY_THRESHOLD = 50
const ENGAGEMENT_THRESHOLD = 50

// ── Core Computation ──

export function computeStudentQuadrants(
  students: Student[],
  stepMetrics: StepMetrics | undefined,
  questions: Questions,
  totalSteps: number,
  stepToTask?: Record<number, number>,
): { students: StudentQuadrantData[]; metrics: SummaryMetrics } {
  const result: StudentQuadrantData[] = []

  // Pre-compute AI activity per student
  const aiCountByStudent = new Map<string, number>()
  for (const q of questions) {
    aiCountByStudent.set(q.studentId, (aiCountByStudent.get(q.studentId) || 0) + 1)
  }

  // Compute per-student metrics
  for (const s of students) {
    const mastery = computeMastery(s, totalSteps)
    const engagement = computeEngagement(s, totalSteps, aiCountByStudent.get(s.id) || 0)
    const quadrant = classifyQuadrant(mastery, engagement)

    // Find weak steps (below step avg)
    // submissions keys are stepIdx; stepMetrics keys are taskNum
    const weakSteps: number[] = []
    if (s.submissions && stepMetrics) {
      for (const [stepStr, sub] of Object.entries(s.submissions)) {
        const stepIdx = Number(stepStr)
        const taskNum = stepToTask ? stepToTask[stepIdx] : stepIdx
        if (taskNum == null) continue
        const sm = stepMetrics[taskNum]
        if (sub?.score?.total != null && sm?.avgScore != null && sub.score.total < sm.avgScore) {
          weakSteps.push(taskNum)
        }
      }
    }

    const submissionCount = s.submissions ? Object.keys(s.submissions).filter(k => s.submissions![Number(k)]?.score).length : 0

    result.push({ id: s.id, name: s.name, mastery, engagement, quadrant, weakSteps, submissionCount })
  }

  // Aggregate metrics
  const overallMastery = result.length > 0
    ? Math.round(result.reduce((sum, s) => sum + s.mastery, 0) / result.length)
    : 0

  const metrics: SummaryMetrics = {
    overallMastery,
    starCount: result.filter(s => s.quadrant === 'star').length,
    atRiskCount: result.filter(s => s.quadrant === 'at-risk').length,
    coastingCount: result.filter(s => s.quadrant === 'coasting').length,
    strugglingCount: result.filter(s => s.quadrant === 'struggling').length,
    weakDimensionCount: 0, // filled by caller
  }

  return { students: result, metrics }
}

function computeMastery(student: Student, totalSteps: number): number {
  const subs = student.submissions
  if (!subs) return 0

  let totalScore = 0
  let count = 0
  for (const sub of Object.values(subs)) {
    if (sub?.score?.total != null) {
      totalScore += sub.score.total
      count++
    }
  }

  if (count === 0) return 0
  // Weight by completion: average score × completion ratio
  const avgScore = totalScore / count
  const completionRatio = totalSteps > 0 ? Math.min(1, count / totalSteps) : 1
  return Math.round(avgScore * completionRatio)
}

function computeEngagement(student: Student, totalSteps: number, aiRounds: number): number {
  // progressRate: how far through the lesson (currentTask is 1-indexed)
  const progressRate = totalSteps > 0
    ? Math.min(1, student.currentTask / totalSteps)
    : 0

  // stuckPenalty: 1 if stuck, 0 otherwise
  let stuckPenalty = 0
  if (student.stepStartedAt) {
    const elapsed = Date.now() - new Date(student.stepStartedAt).getTime()
    if (elapsed > 180_000) stuckPenalty = 1
  }

  // aiActivity: normalized, cap at 1
  const aiActivity = Math.min(1, aiRounds / 5)

  // Weighted composite
  const raw = 0.4 * progressRate + 0.3 * (1 - stuckPenalty) + 0.3 * aiActivity
  return Math.round(raw * 100)
}

function classifyQuadrant(mastery: number, engagement: number): Quadrant {
  if (mastery >= MASTERY_THRESHOLD && engagement >= ENGAGEMENT_THRESHOLD) return 'star'
  if (mastery < MASTERY_THRESHOLD && engagement >= ENGAGEMENT_THRESHOLD) return 'struggling'
  if (mastery >= MASTERY_THRESHOLD && engagement < ENGAGEMENT_THRESHOLD) return 'coasting'
  return 'at-risk'
}

// ── Weak Dimensions ──

export function computeWeakDimensions(
  stepMetrics: StepMetrics | undefined,
  stepNames: Record<number, string>,
): WeakDimension[] {
  if (!stepMetrics) return []

  const result: WeakDimension[] = []
  for (const [stepStr, sm] of Object.entries(stepMetrics)) {
    const stepNum = Number(stepStr)
    if (!sm?.byDimension) continue

    for (const [dim, vals] of Object.entries(sm.byDimension)) {
      const total = vals.good + vals.partial + vals.wrong
      if (total === 0) continue
      const wrongRate = Math.round((vals.wrong / total) * 100)
      if (wrongRate > 30) {
        result.push({
          stepNum,
          stepName: stepNames[stepNum] || `Step ${stepNum}`,
          dimension: dim,
          wrongRate,
        })
      }
    }
  }

  return result.sort((a, b) => b.wrongRate - a.wrongRate)
}

// ── Knowledge Point Bars ──

export interface KnowledgePoint {
  stepNum: number
  dimension: string
  label: string
  masteryRate: number  // 0-100
}

export function computeKnowledgePoints(
  stepMetrics: StepMetrics | undefined,
  stepNames: Record<number, string>,
): KnowledgePoint[] {
  if (!stepMetrics) return []

  const result: KnowledgePoint[] = []
  for (const [stepStr, sm] of Object.entries(stepMetrics)) {
    const stepNum = Number(stepStr)
    if (!sm?.byDimension) continue

    for (const [dim, vals] of Object.entries(sm.byDimension)) {
      const total = vals.good + vals.partial + vals.wrong
      if (total === 0) continue
      const masteryRate = Math.round(((vals.good + vals.partial * 0.5) / total) * 100)
      result.push({
        stepNum,
        dimension: dim,
        label: `${stepNames[stepNum] || `T${stepNum}`} · ${dim}`,
        masteryRate,
      })
    }
  }

  return result.sort((a, b) => a.masteryRate - b.masteryRate)
}

// ── Question Candidates ──

export function pickQuestionCandidates(
  quadrantStudents: StudentQuadrantData[],
  weakDimensions: WeakDimension[],
): QuestionCandidate[] {
  const candidates: QuestionCandidate[] = []

  // 1. Showcase: star with highest mastery
  const stars = quadrantStudents
    .filter(s => s.quadrant === 'star')
    .sort((a, b) => b.mastery - a.mastery)
  if (stars.length > 0) {
    const s = stars[0]
    candidates.push({
      student: s,
      intent: 'showcase',
      intentLabel: '展示标杆',
      reason: generateRecommendReason(s, quadrantStudents, weakDimensions, 'showcase'),
    })
  }

  // 2. Verify: star or struggling with mid-high mastery
  const verifyPool = quadrantStudents
    .filter(s => s.mastery >= 40 && s.mastery < 85 && s.quadrant !== 'at-risk')
    .filter(s => !candidates.some(c => c.student.id === s.id))
    .sort((a, b) => b.engagement - a.engagement)
  if (verifyPool.length > 0) {
    const s = verifyPool[0]
    candidates.push({
      student: s,
      intent: 'verify',
      intentLabel: '检验掌握',
      reason: generateRecommendReason(s, quadrantStudents, weakDimensions, 'verify'),
    })
  }

  // 3. Expose: struggling with typical stumbling point
  const struggling = quadrantStudents
    .filter(s => s.quadrant === 'struggling')
    .filter(s => !candidates.some(c => c.student.id === s.id))
    .sort((a, b) => a.mastery - b.mastery)
  if (struggling.length > 0) {
    const s = struggling[0]
    candidates.push({
      student: s,
      intent: 'expose',
      intentLabel: '暴露问题',
      reason: generateRecommendReason(s, quadrantStudents, weakDimensions, 'expose'),
    })
  }

  return candidates
}

function generateRecommendReason(
  student: StudentQuadrantData,
  allStudents: StudentQuadrantData[],
  weakDimensions: WeakDimension[],
  intent: 'showcase' | 'verify' | 'expose',
): string {
  const total = allStudents.length
  const topWeak = weakDimensions[0]

  switch (intent) {
    case 'showcase':
      return `掌握度 ${student.mastery}%，可让全班看到正确解题路径`
    case 'verify': {
      const sameLevelCount = allStudents.filter(s => Math.abs(s.mastery - student.mastery) < 15).length
      return `与 ${sameLevelCount} 名同学水平相近，验证班级中位掌握`
    }
    case 'expose': {
      if (topWeak && student.weakSteps.length > 0) {
        const weakCount = allStudents.filter(s => s.weakSteps.some(ws => student.weakSteps.includes(ws))).length
        const pct = Math.round((weakCount / total) * 100)
        return `卡点与 ${pct}% 班级同学共同，暴露后可精准重讲`
      }
      return `参与度高但掌握不足，卡点具有代表性`
    }
  }
}

// ── Quadrant Metadata ──

export const QUADRANT_META: Record<Quadrant, { label: string; color: string; bgColor: string }> = {
  star:       { label: '学优',       color: 'var(--green)',     bgColor: 'var(--green-soft)' },
  struggling: { label: '努力但困惑', color: 'var(--amber)',     bgColor: 'var(--amber-soft)' },
  coasting:   { label: '游刃有余',   color: 'var(--blue)',      bgColor: 'var(--blue-soft)' },
  'at-risk':  { label: '需要关注',   color: 'var(--red)',       bgColor: 'var(--red-soft)' },
}

export const QUADRANT_ORDER: Quadrant[] = ['star', 'struggling', 'coasting', 'at-risk']
