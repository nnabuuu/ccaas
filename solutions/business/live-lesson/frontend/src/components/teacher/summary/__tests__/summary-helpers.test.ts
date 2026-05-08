import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  buildStepMapping,
  computeStudentQuadrants,
  computeWeakDimensions,
  computeKnowledgePoints,
  pickQuestionCandidates,
  computeTimingInsight,
  computeAiHeat,
  formatDuration,
  pickRepresentativeQuestions,
} from '../summary-helpers'
import type { StudentQuadrantData, WeakDimension } from '../summary-helpers'

// ── Factories ──

function makeStudent(overrides: Partial<{
  id: string; name: string; currentTask: number; currentPhase: string
  stepStartedAt: string; submissions: Record<number, any>
}> = {}) {
  return {
    id: overrides.id ?? 's1',
    name: overrides.name ?? 'Alice',
    currentTask: overrides.currentTask ?? 1,
    currentPhase: overrides.currentPhase ?? 'practice',
    stepStartedAt: overrides.stepStartedAt ?? new Date().toISOString(),
    submissions: overrides.submissions ?? {},
  }
}

function makeQuestion(overrides: Partial<{
  studentId: string; studentName: string; question: string
  step: number; category: string | null; timestamp: number
}> = {}) {
  return {
    studentId: overrides.studentId ?? 's1',
    studentName: overrides.studentName ?? 'Alice',
    question: overrides.question ?? '这是一个足够长的测试问题用来通过长度过滤',
    step: overrides.step ?? 1,
    category: overrides.category ?? null,
    timestamp: overrides.timestamp ?? Date.now(),
  }
}

// ── buildStepMapping ──

describe('buildStepMapping', () => {
  it('maps step indices to 1-based task numbers', () => {
    const result = buildStepMapping([{ idx: 0 }, { idx: 2 }, { idx: 5 }])
    expect(result.stepToTask).toEqual({ 0: 1, 2: 2, 5: 3 })
    expect(result.taskToStep).toEqual({ 1: 0, 2: 2, 3: 5 })
  })

  it('returns empty maps for empty input', () => {
    const result = buildStepMapping([])
    expect(result.stepToTask).toEqual({})
    expect(result.taskToStep).toEqual({})
    expect(result.taskDurations).toEqual({})
  })

  it('captures durations when provided', () => {
    const result = buildStepMapping([{ idx: 0, duration: 5 }, { idx: 1 }])
    expect(result.taskDurations).toEqual({ 1: 5 })
  })
})

// ── computeStudentQuadrants ──

describe('computeStudentQuadrants', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('classifies star: high mastery + high engagement', () => {
    vi.setSystemTime(new Date('2024-01-01T00:05:00Z'))
    const students = [makeStudent({
      id: 's1', currentTask: 3,
      stepStartedAt: '2024-01-01T00:04:00Z',
      submissions: {
        1: { step: 1, data: {}, score: { total: 90 }, submittedAt: '', duration: 60 },
        2: { step: 2, data: {}, score: { total: 80 }, submittedAt: '', duration: 60 },
      },
    })]
    const questions = [makeQuestion({ studentId: 's1' }), makeQuestion({ studentId: 's1' })]
    const { students: result } = computeStudentQuadrants(students, undefined, questions, 3)
    expect(result[0].quadrant).toBe('star')
    expect(result[0].mastery).toBeGreaterThanOrEqual(50)
  })

  it('classifies at-risk: low mastery + low engagement', () => {
    vi.setSystemTime(new Date('2024-01-01T01:00:00Z'))
    const students = [makeStudent({
      id: 's1', currentTask: 1,
      stepStartedAt: '2024-01-01T00:00:00Z', // very stuck
      submissions: {
        1: { step: 1, data: {}, score: { total: 10 }, submittedAt: '' },
      },
    })]
    const { students: result } = computeStudentQuadrants(students, undefined, [], 5)
    expect(result[0].quadrant).toBe('at-risk')
  })

  it('returns zero mastery for student with no submissions', () => {
    const students = [makeStudent({ submissions: {} })]
    const { students: result } = computeStudentQuadrants(students, undefined, [], 3)
    expect(result[0].mastery).toBe(0)
  })

  it('returns empty result for empty student list', () => {
    const { students: result, metrics } = computeStudentQuadrants([], undefined, [], 3)
    expect(result).toEqual([])
    expect(metrics.overallMastery).toBe(0)
  })

  it('detects weakSteps when student score below step average', () => {
    vi.setSystemTime(new Date('2024-01-01T00:05:00Z'))
    const students = [makeStudent({
      id: 's1', currentTask: 2,
      stepStartedAt: '2024-01-01T00:04:00Z',
      submissions: { 0: { step: 0, data: {}, score: { total: 30 }, submittedAt: '' } },
    })]
    const stepMetrics = { 1: { currentCount: 1, completedCount: 1, completionRate: 100, avgScore: 80 } }
    const stepToTask = { 0: 1 }
    const { students: result } = computeStudentQuadrants(students, stepMetrics as any, [], 2, stepToTask)
    expect(result[0].weakSteps).toContain(1)
  })

  it('aggregates metrics correctly', () => {
    vi.setSystemTime(new Date('2024-01-01T00:05:00Z'))
    const students = [
      makeStudent({ id: 's1', currentTask: 3, stepStartedAt: '2024-01-01T00:04:00Z', submissions: { 1: { step: 1, data: {}, score: { total: 90 }, submittedAt: '' }, 2: { step: 2, data: {}, score: { total: 80 }, submittedAt: '' } } }),
      makeStudent({ id: 's2', currentTask: 1, stepStartedAt: '2024-01-01T00:00:00Z', submissions: {} }),
    ]
    const { metrics } = computeStudentQuadrants(students, undefined, [], 3)
    expect(metrics.starCount + metrics.atRiskCount + metrics.coastingCount + metrics.strugglingCount).toBe(2)
  })
})

// ── computeWeakDimensions ──

describe('computeWeakDimensions', () => {
  it('returns dimensions with wrongRate > 30%', () => {
    const stepMetrics = {
      1: { currentCount: 5, completedCount: 5, completionRate: 100, avgScore: 60, byDimension: { 'Q1': { good: 1, partial: 0, wrong: 4 } } },
    }
    const result = computeWeakDimensions(stepMetrics as any, { 1: 'Vocab' })
    expect(result).toHaveLength(1)
    expect(result[0].wrongRate).toBe(80)
    expect(result[0].stepName).toBe('Vocab')
  })

  it('excludes dimensions with wrongRate <= 30%', () => {
    const stepMetrics = {
      1: { currentCount: 5, completedCount: 5, completionRate: 100, avgScore: 80, byDimension: { 'Q1': { good: 8, partial: 1, wrong: 1 } } },
    }
    const result = computeWeakDimensions(stepMetrics as any, { 1: 'Vocab' })
    expect(result).toHaveLength(0)
  })

  it('sorts by wrongRate descending', () => {
    const stepMetrics = {
      1: { currentCount: 5, completedCount: 5, completionRate: 100, avgScore: 60, byDimension: { 'Q1': { good: 1, partial: 0, wrong: 4 }, 'Q2': { good: 0, partial: 0, wrong: 5 } } },
    }
    const result = computeWeakDimensions(stepMetrics as any, { 1: 'Vocab' })
    expect(result[0].wrongRate).toBeGreaterThanOrEqual(result[1].wrongRate)
  })

  it('returns empty for undefined stepMetrics', () => {
    expect(computeWeakDimensions(undefined, {})).toEqual([])
  })

  it('uses fallback step name', () => {
    const stepMetrics = {
      3: { currentCount: 1, completedCount: 1, completionRate: 100, avgScore: 0, byDimension: { 'X': { good: 0, partial: 0, wrong: 5 } } },
    }
    const result = computeWeakDimensions(stepMetrics as any, {})
    expect(result[0].stepName).toBe('Step 3')
  })
})

// ── computeKnowledgePoints ──

describe('computeKnowledgePoints', () => {
  it('computes masteryRate with partial × 0.5 weighting', () => {
    const stepMetrics = {
      1: { currentCount: 5, completedCount: 5, completionRate: 100, avgScore: 70, byDimension: { 'Q1': { good: 2, partial: 4, wrong: 4 } } },
    }
    const result = computeKnowledgePoints(stepMetrics as any, { 1: 'Vocab' })
    // (2 + 4*0.5) / 10 = 0.4 → 40%
    expect(result[0].masteryRate).toBe(40)
  })

  it('sorts by masteryRate ascending', () => {
    const stepMetrics = {
      1: { currentCount: 5, completedCount: 5, completionRate: 100, avgScore: 70, byDimension: { 'High': { good: 9, partial: 0, wrong: 1 }, 'Low': { good: 1, partial: 0, wrong: 9 } } },
    }
    const result = computeKnowledgePoints(stepMetrics as any, { 1: 'Vocab' })
    expect(result[0].masteryRate).toBeLessThan(result[1].masteryRate)
  })

  it('returns empty for undefined stepMetrics', () => {
    expect(computeKnowledgePoints(undefined, {})).toEqual([])
  })

  it('formats label correctly', () => {
    const stepMetrics = {
      2: { currentCount: 1, completedCount: 1, completionRate: 100, avgScore: 50, byDimension: { 'P1': { good: 5, partial: 0, wrong: 5 } } },
    }
    const result = computeKnowledgePoints(stepMetrics as any, { 2: 'Reading' })
    expect(result[0].label).toBe('Reading · P1')
  })
})

// ── pickQuestionCandidates ──

describe('pickQuestionCandidates', () => {
  const makeQStudent = (overrides: Partial<StudentQuadrantData>): StudentQuadrantData => ({
    id: 's1', name: 'Alice', mastery: 50, engagement: 50,
    quadrant: 'star', weakSteps: [], submissionCount: 1,
    ...overrides,
  })

  it('picks showcase from star with highest mastery', () => {
    const students = [
      makeQStudent({ id: 's1', mastery: 90, quadrant: 'star' }),
      makeQStudent({ id: 's2', mastery: 70, quadrant: 'star' }),
    ]
    const result = pickQuestionCandidates(students, [])
    const showcase = result.find(c => c.intent === 'showcase')
    expect(showcase?.student.id).toBe('s1')
  })

  it('picks verify from mid-mastery non-at-risk', () => {
    const students = [
      makeQStudent({ id: 's1', mastery: 90, quadrant: 'star' }),
      makeQStudent({ id: 's2', mastery: 60, engagement: 70, quadrant: 'struggling' }),
    ]
    const result = pickQuestionCandidates(students, [])
    const verify = result.find(c => c.intent === 'verify')
    expect(verify?.student.id).toBe('s2')
  })

  it('picks expose from struggling with lowest mastery', () => {
    const students = [
      makeQStudent({ id: 's1', mastery: 90, quadrant: 'star' }),
      makeQStudent({ id: 's2', mastery: 30, quadrant: 'struggling' }),
      makeQStudent({ id: 's3', mastery: 20, quadrant: 'struggling' }),
    ]
    const result = pickQuestionCandidates(students, [])
    const expose = result.find(c => c.intent === 'expose')
    expect(expose?.student.id).toBe('s3')
  })

  it('returns empty for no students', () => {
    expect(pickQuestionCandidates([], [])).toEqual([])
  })
})

// ── computeTimingInsight ──

describe('computeTimingInsight', () => {
  it('finds the step where most students spent longest', () => {
    const students = [
      makeStudent({ id: 's1', submissions: { 0: { step: 0, data: {}, score: null, submittedAt: '', duration: 100 }, 1: { step: 1, data: {}, score: null, submittedAt: '', duration: 200 } } }),
      makeStudent({ id: 's2', submissions: { 0: { step: 0, data: {}, score: null, submittedAt: '', duration: 50 }, 1: { step: 1, data: {}, score: null, submittedAt: '', duration: 300 } } }),
    ]
    const stepToTask = { 0: 1, 1: 2 }
    const result = computeTimingInsight(students, stepToTask, undefined, { 1: 'Step A', 2: 'Step B' })
    expect(result).not.toBeNull()
    expect(result!.stepNum).toBe(2)
    expect(result!.studentCount).toBe(2)
    expect(result!.percentage).toBe(100)
  })

  it('returns null when no duration data', () => {
    const students = [makeStudent({ submissions: { 0: { step: 0, data: {}, score: null, submittedAt: '' } } })]
    const result = computeTimingInsight(students, { 0: 1 }, undefined, {})
    expect(result).toBeNull()
  })

  it('returns null for empty student list', () => {
    expect(computeTimingInsight([], {}, undefined, {})).toBeNull()
  })

  it('includes medianTime from stepMetrics', () => {
    const students = [
      makeStudent({ id: 's1', submissions: { 0: { step: 0, data: {}, score: null, submittedAt: '', duration: 100 } } }),
    ]
    const stepMetrics = { 1: { currentCount: 1, completedCount: 1, completionRate: 100, avgScore: 50, medianTime: 95 } }
    const result = computeTimingInsight(students, { 0: 1 }, stepMetrics as any, { 1: 'A' })
    expect(result!.medianTime).toBe(95)
  })
})

// ── pickRepresentativeQuestions ──

describe('pickRepresentativeQuestions', () => {
  const stepNames: Record<number, string> = { 1: 'Step A', 2: 'Step B' }

  it('filters out short questions (< 10 chars)', () => {
    const questions = [makeQuestion({ question: '短问题' })]
    expect(pickRepresentativeQuestions(questions, stepNames)).toHaveLength(0)
  })

  it('prioritizes questions with personal keywords', () => {
    const questions = [
      makeQuestion({ question: '这个知识点的定义是什么呢请详细说明', step: 1, studentId: 's1' }),
      makeQuestion({ question: '我觉得这道题应该用另一种方法来解决', step: 2, studentId: 's2' }),
    ]
    const result = pickRepresentativeQuestions(questions, stepNames)
    // "我觉得" triggers personal keyword, should come first
    expect(result[0].step).toBe(2)
  })

  it('limits to 1 question per step', () => {
    const questions = [
      makeQuestion({ question: '我觉得这道题的解法很有意思啊', step: 1, studentId: 's1' }),
      makeQuestion({ question: '为什么这道题不能用另一种方法解呢', step: 1, studentId: 's2' }),
    ]
    const result = pickRepresentativeQuestions(questions, stepNames)
    expect(result).toHaveLength(1)
  })

  it('respects limit parameter', () => {
    const questions = [
      makeQuestion({ question: '我觉得第一个问题非常有深度需要讨论', step: 1, studentId: 's1' }),
      makeQuestion({ question: '为什么这道题不能用另一种方法来解决呢', step: 2, studentId: 's2' }),
      makeQuestion({ question: '这个概念是怎么理解的呢请帮我解释一下', step: 3, studentId: 's3' }),
    ]
    const result = pickRepresentativeQuestions(questions, { 1: 'A', 2: 'B', 3: 'C' }, 2)
    expect(result.length).toBeLessThanOrEqual(2)
  })

  it('strips [discuss:socratic:rN] from returned questions', () => {
    const questions = [
      makeQuestion({ question: '[discuss:socratic:r1] 我觉得这个问题很有趣，为什么呢？' }),
    ]
    const result = pickRepresentativeQuestions(questions, stepNames)
    expect(result[0].question).not.toContain('[discuss:')
  })

  it('returns empty for no questions', () => {
    expect(pickRepresentativeQuestions([], stepNames)).toEqual([])
  })

  it('sets isAnonymous to true', () => {
    const questions = [makeQuestion({ question: '为什么这道题的答案是这样的呢？' })]
    const result = pickRepresentativeQuestions(questions, stepNames)
    expect(result[0].isAnonymous).toBe(true)
  })
})

// ── computeAiHeat ──

describe('computeAiHeat', () => {
  it('returns steps sorted by aiRounds descending', () => {
    const stepMetrics = {
      1: { currentCount: 5, completedCount: 5, completionRate: 100, avgScore: 70, aiRounds: 10, aiPeople: 3 },
      2: { currentCount: 5, completedCount: 5, completionRate: 100, avgScore: 70, aiRounds: 20, aiPeople: 5 },
    }
    const result = computeAiHeat(stepMetrics as any, { 1: 'A', 2: 'B' })
    expect(result[0].aiRounds).toBe(20)
    expect(result[1].aiRounds).toBe(10)
  })

  it('skips steps with 0 aiRounds', () => {
    const stepMetrics = {
      1: { currentCount: 5, completedCount: 5, completionRate: 100, avgScore: 70, aiRounds: 0, aiPeople: 0 },
      2: { currentCount: 5, completedCount: 5, completionRate: 100, avgScore: 70, aiRounds: 5, aiPeople: 2 },
    }
    const result = computeAiHeat(stepMetrics as any, { 1: 'A', 2: 'B' })
    expect(result).toHaveLength(1)
    expect(result[0].stepNum).toBe(2)
  })

  it('returns empty for undefined stepMetrics', () => {
    expect(computeAiHeat(undefined, {})).toEqual([])
  })
})

// ── formatDuration ──

describe('formatDuration', () => {
  it('formats seconds < 60', () => {
    expect(formatDuration(5)).toBe('0:05')
  })

  it('formats minutes and seconds', () => {
    expect(formatDuration(150)).toBe('2:30')
  })

  it('formats exact minutes', () => {
    expect(formatDuration(120)).toBe('2:00')
  })

  it('rounds fractional seconds', () => {
    expect(formatDuration(5.7)).toBe('0:06')
  })

  it('handles zero', () => {
    expect(formatDuration(0)).toBe('0:00')
  })
})
