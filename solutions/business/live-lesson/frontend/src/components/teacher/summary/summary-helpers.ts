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

export function buildStepMapping(taskSteps: Array<{ idx: number; duration?: number }>): {
  stepToTask: Record<number, number>
  taskToStep: Record<number, number>
  taskDurations: Record<number, number>
} {
  const stepToTask: Record<number, number> = {}
  const taskToStep: Record<number, number> = {}
  const taskDurations: Record<number, number> = {}
  taskSteps.forEach((rs, i) => {
    const taskNum = i + 1
    stepToTask[rs.idx] = taskNum
    taskToStep[taskNum] = rs.idx
    if (rs.duration != null) taskDurations[taskNum] = rs.duration
  })
  return { stepToTask, taskToStep, taskDurations }
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
  taskDurations?: Record<number, number>,  // taskNum → expected minutes
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
    const expectedDuration = taskDurations?.[s.currentTask]
    const engagement = computeEngagement(s, totalSteps, aiCountByStudent.get(s.id) || 0, expectedDuration)
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

function computeEngagement(student: Student, totalSteps: number, aiRounds: number, expectedDuration?: number): number {
  // progressRate: how far through the lesson (currentTask is 1-indexed)
  const progressRate = totalSteps > 0
    ? Math.min(1, student.currentTask / totalSteps)
    : 0

  // stuckPenalty: 0 until 1.5× expected duration, then linear ramp to 1.0 at 3.0×
  let stuckPenalty = 0
  if (student.stepStartedAt) {
    const elapsed = Date.now() - new Date(student.stepStartedAt).getTime()
    if (!Number.isNaN(elapsed) && elapsed > 0) {
      const thresholdMs = (expectedDuration ?? 5) * 60_000 * 1.5
      if (thresholdMs > 0) {
        stuckPenalty = Math.min(1, Math.max(0, (elapsed - thresholdMs) / thresholdMs))
      }
    }
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

// ── Shared Utilities ──

export function formatDuration(seconds: number): string {
  const total = Math.round(seconds)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// ── Transition Insight Types ──

export interface TimingInsight {
  stepNum: number
  stepName: string
  studentCount: number   // how many students spent the most time on this step
  percentage: number     // 0-100
  medianTime: number | null // seconds
}

export interface RepresentativeQuestion {
  step: number
  stepName: string
  question: string
  isAnonymous: true
  category: string | null
}

export interface AiHeatStep {
  stepNum: number
  stepName: string
  aiRounds: number
  aiPeople: number
}

// ── Transition Insight Functions ──

/**
 * Find the step where the most students spent their longest time.
 * Returns null if no duration data is available.
 */
export function computeTimingInsight(
  students: Student[],
  stepToTask: Record<number, number>,
  stepMetrics: StepMetrics | undefined,
  stepNames: Record<number, string>,
): TimingInsight | null {
  // For each student, find the taskNum where they spent the most time
  const longestStepCounts = new Map<number, number>()
  let totalWithData = 0

  for (const s of students) {
    if (!s.submissions) continue
    let maxDuration = -1
    let maxTaskNum = -1

    for (const [stepStr, sub] of Object.entries(s.submissions)) {
      if (!sub?.duration || sub.duration <= 0) continue
      const stepIdx = Number(stepStr)
      const taskNum = stepToTask[stepIdx]
      if (taskNum == null) continue
      if (sub.duration > maxDuration) {
        maxDuration = sub.duration
        maxTaskNum = taskNum
      }
    }

    if (maxTaskNum > 0) {
      totalWithData++
      longestStepCounts.set(maxTaskNum, (longestStepCounts.get(maxTaskNum) || 0) + 1)
    }
  }

  if (totalWithData === 0) return null

  // Find the taskNum with the highest count
  let topTaskNum = -1
  let topCount = 0
  for (const [taskNum, count] of longestStepCounts) {
    if (count > topCount) {
      topCount = count
      topTaskNum = taskNum
    }
  }

  if (topTaskNum < 0) return null

  const medianTime = stepMetrics?.[topTaskNum]?.medianTime ?? null

  return {
    stepNum: topTaskNum,
    stepName: stepNames[topTaskNum] || `Step ${topTaskNum}`,
    studentCount: topCount,
    percentage: Math.round((topCount / totalWithData) * 100),
    medianTime,
  }
}

/**
 * Pick 1-3 representative student questions worth discussing in class.
 * Always anonymized — no student names.
 */
export function pickRepresentativeQuestions(
  questions: Questions,
  stepNames: Record<number, string>,
  limit = 3,
): RepresentativeQuestion[] {
  // Filter out very short questions
  const filtered = questions.filter(q => q.question && q.question.length >= 10)

  if (filtered.length === 0) return []

  // Personal keywords that indicate deeper engagement
  const personalPattern = /我|我的|为什么|怎么|如果|难道|可是|但是|觉得/

  // Score each question: personal keywords boost priority, then length as tiebreak
  const scored = filtered.map(q => ({
    ...q,
    isPersonal: personalPattern.test(q.question),
    len: q.question.length,
  }))

  // Sort: personal first, then by length descending
  scored.sort((a, b) => {
    if (a.isPersonal !== b.isPersonal) return a.isPersonal ? -1 : 1
    return b.len - a.len
  })

  // Pick at most 1 per step
  // NOTE: q.step is already a taskNum (set by backend from the AI ask endpoint).
  // No stepToTask mapping needed here — that's only for submissions keys.
  const seenSteps = new Set<number>()
  const result: RepresentativeQuestion[] = []

  for (const q of scored) {
    if (result.length >= limit) break
    const taskNum = q.step
    if (seenSteps.has(taskNum)) continue
    seenSteps.add(taskNum)

    result.push({
      step: taskNum,
      stepName: stepNames[taskNum] || `Step ${taskNum}`,
      question: q.question,
      isAnonymous: true,
      category: q.category ?? null,
    })
  }

  return result
}

/**
 * Rank steps by AI interaction density (aiRounds descending).
 * Only includes steps that have at least 1 AI round.
 */
export function computeAiHeat(
  stepMetrics: StepMetrics | undefined,
  stepNames: Record<number, string>,
): AiHeatStep[] {
  if (!stepMetrics) return []

  const result: AiHeatStep[] = []
  for (const [stepStr, sm] of Object.entries(stepMetrics)) {
    const stepNum = Number(stepStr)
    const aiRounds = sm?.aiRounds ?? 0
    const aiPeople = sm?.aiPeople ?? 0
    if (aiRounds <= 0) continue
    result.push({
      stepNum,
      stepName: stepNames[stepNum] || `Step ${stepNum}`,
      aiRounds,
      aiPeople,
    })
  }

  return result.sort((a, b) => b.aiRounds - a.aiRounds)
}
