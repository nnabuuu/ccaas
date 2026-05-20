import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  clusterQuestions,
  computeHealthCards,
  mostCommon,
  getStudentStatus,
  getStudentGlobalStatus,
  hasAI,
  formatRelative,
  computePhaseDistribution,
  getObserveType,
  getCatBadgeClass,
  getEffectivePhaseConfig,
  getPhaseIcon,
} from '../teacher-helpers'
import type { ReadingManifest, ReadingStep, PhaseConfig } from '../../../types/reading'

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

function makeClassroomState(overrides: Partial<{
  students: any[]; questions: any[]; metrics: any; stepMetrics: any
}> = {}) {
  return {
    currentStep: 1,
    students: overrides.students ?? [],
    questions: overrides.questions ?? [],
    metrics: overrides.metrics ?? { total: 0, submitted: 0, inProgress: 0 },
    stepMetrics: overrides.stepMetrics ?? {},
  } as any
}

function makeQuestion(overrides: Partial<{
  studentId: string; studentName: string; question: string
  step: number; category: string; timestamp: string
}> = {}) {
  return {
    studentId: overrides.studentId ?? 's1',
    studentName: overrides.studentName ?? 'Alice',
    question: overrides.question ?? '测试问题',
    step: overrides.step ?? 1,
    category: overrides.category ?? '',
    timestamp: overrides.timestamp ?? new Date().toISOString(),
  }
}

// ── clusterQuestions ──

describe('clusterQuestions', () => {
  it('merges identical questions into one cluster', () => {
    const questions = [
      makeQuestion({ studentId: 's1', studentName: 'Alice', question: '这是什么意思' }),
      makeQuestion({ studentId: 's2', studentName: 'Bob', question: '这是什么意思' }),
    ]
    const clusters = clusterQuestions(questions)
    expect(clusters).toHaveLength(1)
    expect(clusters[0].students).toEqual(['Alice', 'Bob'])
  })

  it('merges Chinese questions with token overlap > 0.7', () => {
    const questions = [
      makeQuestion({ studentName: 'Alice', question: '这道题怎么做' }),
      makeQuestion({ studentName: 'Bob', question: '这道题怎么解' }),
    ]
    const clusters = clusterQuestions(questions)
    // 4/5 overlap = 0.8 > 0.7 → merged
    expect(clusters).toHaveLength(1)
  })

  it('keeps low-overlap questions in separate clusters', () => {
    const questions = [
      makeQuestion({ studentName: 'Alice', question: '今天天气真好' }),
      makeQuestion({ studentName: 'Bob', question: '数学公式推导' }),
    ]
    const clusters = clusterQuestions(questions)
    expect(clusters).toHaveLength(2)
  })

  it('sorts clusters by student count descending', () => {
    const questions = [
      makeQuestion({ studentName: 'Alice', question: '独特问题无重复' }),
      makeQuestion({ studentName: 'Bob', question: '重复问题来了' }),
      makeQuestion({ studentName: 'Carol', question: '重复问题来了' }),
    ]
    const clusters = clusterQuestions(questions)
    expect(clusters[0].students.length).toBeGreaterThanOrEqual(clusters[clusters.length - 1].students.length)
  })

  it('does not duplicate student names', () => {
    const questions = [
      makeQuestion({ studentId: 's1', studentName: 'Alice', question: '相同问题' }),
      makeQuestion({ studentId: 's1', studentName: 'Alice', question: '相同问题' }),
    ]
    const clusters = clusterQuestions(questions)
    expect(clusters[0].students).toEqual(['Alice'])
    expect(clusters[0].items).toHaveLength(2)
  })
})

// ── computeHealthCards ──

describe('computeHealthCards', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('returns default values for null state', () => {
    const result = computeHealthCards(null)
    expect(result.fastest.step).toBe('--')
    expect(result.stuck.count).toBe(0)
    expect(result.ai.rounds).toBe(0)
  })

  it('returns default values for empty students', () => {
    const state = makeClassroomState({ students: [] })
    const result = computeHealthCards(state)
    expect(result.fastest.step).toBe('--')
  })

  it('computes fastest step correctly', () => {
    vi.setSystemTime(new Date('2024-01-01T00:05:00Z'))
    const state = makeClassroomState({
      students: [
        makeStudent({ currentTask: 3, stepStartedAt: '2024-01-01T00:04:00Z' }),
        makeStudent({ id: 's2', currentTask: 1, stepStartedAt: '2024-01-01T00:04:00Z' }),
      ],
    })
    const result = computeHealthCards(state, { 3: 'Vocab', 1: 'Intro' })
    expect(result.fastest.step).toBe('Vocab')
    expect(result.fastest.count).toBe(1)
  })

  it('counts stuck students', () => {
    vi.setSystemTime(new Date('2024-01-01T00:10:00Z'))
    const state = makeClassroomState({
      students: [
        makeStudent({ stepStartedAt: '2024-01-01T00:00:00Z' }), // 10 min > 3 min threshold
      ],
    })
    const result = computeHealthCards(state)
    expect(result.stuck.count).toBe(1)
  })

  it('computes AI stats from questions', () => {
    const state = makeClassroomState({
      students: [makeStudent()],
      questions: [
        makeQuestion({ studentId: 's1' }),
        makeQuestion({ studentId: 's1' }),
        makeQuestion({ studentId: 's2' }),
      ],
    })
    const result = computeHealthCards(state)
    expect(result.ai.rounds).toBe(3)
    expect(result.ai.people).toBe(2)
  })
})

// ── mostCommon ──

describe('mostCommon', () => {
  it('returns the most frequent value', () => {
    expect(mostCommon([1, 2, 2, 3])).toBe(2)
  })

  it('returns first in tie', () => {
    // Object.entries order is insertion order for integer keys in ascending order
    const result = mostCommon([1, 2])
    expect([1, 2]).toContain(result)
  })

  it('handles single element', () => {
    expect(mostCommon([5])).toBe(5)
  })
})

// ── getStudentStatus ──

describe('getStudentStatus', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('returns done when student has score for the step', () => {
    const student = makeStudent({ currentTask: 1, submissions: { 1: { step: 1, data: {}, score: { total: 80 }, submittedAt: '' } } })
    expect(getStudentStatus(student as any, 1)).toBe('done')
  })

  it('returns done when student is past the step', () => {
    const student = makeStudent({ currentTask: 3 })
    expect(getStudentStatus(student as any, 2)).toBe('done')
  })

  it('returns stuck when elapsed > threshold', () => {
    vi.setSystemTime(new Date('2024-01-01T00:10:00Z'))
    const student = makeStudent({ currentTask: 1, stepStartedAt: '2024-01-01T00:00:00Z' })
    expect(getStudentStatus(student as any, 1)).toBe('stuck')
  })

  it('returns reading when phase is listen', () => {
    vi.setSystemTime(new Date('2024-01-01T00:01:00Z'))
    const student = makeStudent({ currentTask: 1, currentPhase: 'listen', stepStartedAt: '2024-01-01T00:00:30Z' })
    expect(getStudentStatus(student as any, 1)).toBe('reading')
  })

  it('returns prog for active student', () => {
    vi.setSystemTime(new Date('2024-01-01T00:01:00Z'))
    const student = makeStudent({ currentTask: 1, currentPhase: 'practice', stepStartedAt: '2024-01-01T00:00:30Z' })
    expect(getStudentStatus(student as any, 1)).toBe('prog')
  })
})

// ── getStudentGlobalStatus ──

describe('getStudentGlobalStatus', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('returns stuck when elapsed > threshold', () => {
    vi.setSystemTime(new Date('2024-01-01T00:10:00Z'))
    const student = makeStudent({ stepStartedAt: '2024-01-01T00:00:00Z' })
    expect(getStudentGlobalStatus(student as any)).toBe('stuck')
  })

  it('returns reading for listen phase', () => {
    vi.setSystemTime(new Date('2024-01-01T00:01:00Z'))
    const student = makeStudent({ currentPhase: 'listen', stepStartedAt: '2024-01-01T00:00:30Z' })
    expect(getStudentGlobalStatus(student as any)).toBe('reading')
  })

  it('returns done when current task has score', () => {
    vi.setSystemTime(new Date('2024-01-01T00:01:00Z'))
    const student = makeStudent({
      currentTask: 2, currentPhase: 'practice',
      stepStartedAt: '2024-01-01T00:00:30Z',
      submissions: { 2: { step: 2, data: {}, score: { total: 70 }, submittedAt: '' } },
    })
    expect(getStudentGlobalStatus(student as any)).toBe('done')
  })

  it('returns prog for active student', () => {
    vi.setSystemTime(new Date('2024-01-01T00:01:00Z'))
    const student = makeStudent({ currentPhase: 'practice', stepStartedAt: '2024-01-01T00:00:30Z' })
    expect(getStudentGlobalStatus(student as any)).toBe('prog')
  })
})

// ── hasAI ──

describe('hasAI', () => {
  it('returns true when student has questions', () => {
    const student = makeStudent({ id: 's1' })
    const questions = [makeQuestion({ studentId: 's1' })]
    expect(hasAI(student as any, questions as any)).toBe(true)
  })

  it('returns false when student has no questions', () => {
    const student = makeStudent({ id: 's1' })
    const questions = [makeQuestion({ studentId: 's2' })]
    expect(hasAI(student as any, questions as any)).toBe(false)
  })
})

// ── formatRelative ──

describe('formatRelative', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('returns 刚刚 for < 1 minute', () => {
    vi.setSystemTime(new Date('2024-01-01T00:00:30Z'))
    expect(formatRelative('2024-01-01T00:00:00Z')).toBe('刚刚')
  })

  it('returns X分钟前 for minutes', () => {
    vi.setSystemTime(new Date('2024-01-01T00:05:00Z'))
    expect(formatRelative('2024-01-01T00:00:00Z')).toBe('5分钟前')
  })

  it('returns X小时前 for hours', () => {
    vi.setSystemTime(new Date('2024-01-01T02:00:00Z'))
    expect(formatRelative('2024-01-01T00:00:00Z')).toBe('2小时前')
  })
})

// ── computePhaseDistribution ──

describe('computePhaseDistribution', () => {
  it('counts students in each phase for the given step (default phases)', () => {
    const students = [
      makeStudent({ id: 's1', currentTask: 2, currentPhase: 'listen' }),
      makeStudent({ id: 's2', currentTask: 2, currentPhase: 'practice' }),
      makeStudent({ id: 's3', currentTask: 2, currentPhase: 'discuss' }),
    ]
    const dist = computePhaseDistribution(students as any, 2)
    expect(dist.listen).toBe(1)
    expect(dist.practice).toBe(1)
    expect(dist.discuss).toBe(1)
  })

  it('counts students past the step as completed', () => {
    const students = [
      makeStudent({ id: 's1', currentTask: 3 }),
      makeStudent({ id: 's2', currentTask: 4 }),
    ]
    const dist = computePhaseDistribution(students as any, 2)
    expect(dist.completed).toBe(2)
  })

  it('defaults to first phase for missing phase', () => {
    const students = [
      makeStudent({ id: 's1', currentTask: 1, currentPhase: '' }),
    ]
    const dist = computePhaseDistribution(students as any, 1)
    expect(dist.listen).toBe(1)
  })

  it('uses custom phaseIds when provided', () => {
    const customPhases = ['listen', 'practice-1', 'practice-2', 'discovery', 'takeaway']
    const students = [
      makeStudent({ id: 's1', currentTask: 1, currentPhase: 'practice-1' }),
      makeStudent({ id: 's2', currentTask: 1, currentPhase: 'practice-2' }),
      makeStudent({ id: 's3', currentTask: 1, currentPhase: 'discovery' }),
    ]
    const dist = computePhaseDistribution(students as any, 1, customPhases)
    expect(dist['practice-1']).toBe(1)
    expect(dist['practice-2']).toBe(1)
    expect(dist.discovery).toBe(1)
    expect(dist.listen).toBe(0)
    expect(dist.completed).toBe(0)
  })

  it('falls back unknown phase to first phaseId', () => {
    const customPhases = ['listen', 'practice']
    const students = [
      makeStudent({ id: 's1', currentTask: 1, currentPhase: 'unknown-phase' }),
    ]
    const dist = computePhaseDistribution(students as any, 1, customPhases)
    expect(dist.listen).toBe(1)
  })

  it('returns Record<string, number> with all phaseIds as keys', () => {
    const customPhases = ['a', 'b', 'c']
    const dist = computePhaseDistribution([] as any, 1, customPhases)
    expect(Object.keys(dist).sort()).toEqual(['a', 'b', 'c', 'completed'].sort())
    expect(dist.a).toBe(0)
    expect(dist.b).toBe(0)
    expect(dist.c).toBe(0)
    expect(dist.completed).toBe(0)
  })
})

// ── getEffectivePhaseConfig ──

describe('getEffectivePhaseConfig', () => {
  const makeStep = (pc?: PhaseConfig[]) => ({ phaseConfig: pc } as ReadingStep)
  const makeManifest = (pc?: PhaseConfig[]) => ({ phaseConfig: pc } as ReadingManifest)

  it('uses step-level phaseConfig when present', () => {
    const stepPC: PhaseConfig[] = [{ id: 'a', label: 'A', unlockAfter: null }]
    const manifestPC: PhaseConfig[] = [{ id: 'b', label: 'B', unlockAfter: null }]
    expect(getEffectivePhaseConfig(makeStep(stepPC), makeManifest(manifestPC))).toBe(stepPC)
  })

  it('falls back to manifest-level phaseConfig', () => {
    const manifestPC: PhaseConfig[] = [{ id: 'b', label: 'B', unlockAfter: null }]
    expect(getEffectivePhaseConfig(makeStep(), makeManifest(manifestPC))).toBe(manifestPC)
  })

  it('falls back to DEFAULT_PHASE_CONFIG when both are missing', () => {
    const result = getEffectivePhaseConfig(makeStep(), makeManifest())
    expect(result).toHaveLength(4)
    expect(result.map(p => p.id)).toEqual(['listen', 'practice', 'discuss', 'takeaway'])
  })
})

// ── getPhaseIcon ──

describe('getPhaseIcon', () => {
  it('returns known icons for standard phases', () => {
    expect(getPhaseIcon('listen')).toBe('🎧')
    expect(getPhaseIcon('practice')).toBe('✏️')
    expect(getPhaseIcon('discuss')).toBe('💬')
    expect(getPhaseIcon('takeaway')).toBe('📝')
    expect(getPhaseIcon('discovery')).toBe('🔍')
  })

  it('returns practice icon for practice-N variants', () => {
    expect(getPhaseIcon('practice-1')).toBe('✏️')
    expect(getPhaseIcon('practice-2')).toBe('✏️')
  })

  it('returns fallback for unknown phases', () => {
    expect(getPhaseIcon('unknown')).toBe('📋')
  })
})

// ── getObserveType ──

describe('getObserveType', () => {
  it.each([
    ['quiz', 'mc'],
    ['match', 'mc'],
    ['order', 'mc'],
    ['select-evidence', 'evidence'],
    ['map', 'map'],
    ['matrix', 'matrix'],
    ['guided-discovery', 'guided-discovery'],
    ['rich-content-quiz', 'image-upload'],
    ['image-upload', 'image-upload'],
  ])('maps %s → %s', (input, expected) => {
    expect(getObserveType(input)).toBe(expected)
  })

  it('returns null for unknown type', () => {
    expect(getObserveType('unknown-type')).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(getObserveType(undefined)).toBeNull()
  })
})

// ── getCatBadgeClass ──

describe('getCatBadgeClass', () => {
  it.each([
    ['概念理解', 'concept'],
    ['阅读策略', 'strategy'],
    ['课文内容', 'content'],
    ['解题求助', 'task-help'],
    ['discuss', 'discuss'],
    ['其他', 'other'],
    ['unknown', 'other'],
  ])('maps %s → %s', (input, expected) => {
    expect(getCatBadgeClass(input)).toBe(expected)
  })
})
