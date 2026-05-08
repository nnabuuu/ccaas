import { describe, it, expect } from 'vitest'
import { generateCoachingTips, type CoachingTip } from '../coaching-helpers'
import type { ClassroomState } from '../../../hooks/useClassroom'

// ── Helpers ──

function makeStudent(overrides: Partial<ClassroomState['students'][0]> = {}): ClassroomState['students'][0] {
  return {
    id: 's1',
    name: 'Alice',
    currentTask: 1,
    currentPhase: 'practice',
    stepStartedAt: new Date().toISOString(),
    submissions: {},
    ...overrides,
  }
}

function makeState(overrides: Partial<ClassroomState> = {}): ClassroomState {
  return {
    currentStep: 0,
    students: [makeStudent()],
    metrics: { total: 1, submitted: 0, inProgress: 1 },
    stepMetrics: {},
    questions: [],
    ...overrides,
  }
}

const defaultHealth = {
  fastest: { step: 'T1', count: 1 },
  median: { step: 'T1', pct: 100 },
  stuck: { count: 0, where: '' },
  ai: { rounds: 0, people: 0 },
}
const defaultStepNames: Record<number, string> = { 1: 'Step A', 2: 'Step B', 3: 'Step C' }
const defaultTaskSteps = [{ idx: 1, duration: 5 }, { idx: 2, duration: 5 }, { idx: 3, duration: 5 }]

function findTip(tips: CoachingTip[], id: string): CoachingTip | undefined {
  return tips.find(t => t.id === id)
}

// ── Tests ──

describe('generateCoachingTips', () => {
  it('returns empty array when state is null', () => {
    expect(generateCoachingTips(null, defaultHealth, defaultStepNames, defaultTaskSteps)).toEqual([])
  })

  it('returns empty array when no students', () => {
    const state = makeState({ students: [] })
    expect(generateCoachingTips(state, defaultHealth, defaultStepNames, defaultTaskSteps)).toEqual([])
  })

  // ── stuck-cluster ──

  describe('stuck-cluster rule', () => {
    it('fires when stuck count >= 5', () => {
      const health = { ...defaultHealth, stuck: { count: 7, where: 'Step A' } }
      const tips = generateCoachingTips(makeState(), health, defaultStepNames, defaultTaskSteps)
      const tip = findTip(tips, 'stuck-cluster')
      expect(tip).toBeDefined()
      expect(tip!.priority).toBe('urgent')
      expect(tip!.title).toContain('7')
    })

    it('does not fire when stuck count < 5', () => {
      const health = { ...defaultHealth, stuck: { count: 4, where: 'Step A' } }
      const tips = generateCoachingTips(makeState(), health, defaultStepNames, defaultTaskSteps)
      expect(findTip(tips, 'stuck-cluster')).toBeUndefined()
    })

    it('fires at exactly 5', () => {
      const health = { ...defaultHealth, stuck: { count: 5, where: 'Step B' } }
      const tips = generateCoachingTips(makeState(), health, defaultStepNames, defaultTaskSteps)
      expect(findTip(tips, 'stuck-cluster')).toBeDefined()
    })
  })

  // ── high-error ──

  describe('high-error rule', () => {
    it('fires when top weak dimension wrongRate >= 50%', () => {
      const state = makeState({
        stepMetrics: {
          1: {
            currentCount: 10, completedCount: 10, completionRate: 100, avgScore: 40,
            byDimension: { Q1: { good: 2, partial: 1, wrong: 7 } },
          },
        },
      })
      const tips = generateCoachingTips(state, defaultHealth, defaultStepNames, defaultTaskSteps)
      const tip = findTip(tips, 'high-error')
      expect(tip).toBeDefined()
      expect(tip!.priority).toBe('urgent')
      expect(tip!.title).toContain('Q1')
    })

    it('does not fire when wrongRate < 50%', () => {
      const state = makeState({
        stepMetrics: {
          1: {
            currentCount: 10, completedCount: 10, completionRate: 100, avgScore: 70,
            byDimension: { Q1: { good: 5, partial: 2, wrong: 3 } },
          },
        },
      })
      const tips = generateCoachingTips(state, defaultHealth, defaultStepNames, defaultTaskSteps)
      expect(findTip(tips, 'high-error')).toBeUndefined()
    })
  })

  // ── step-overtime ──

  describe('step-overtime rule', () => {
    it('fires when medianTime > 1.5x expected', () => {
      // 5 min expected = 300s; 1.5x = 450s; medianTime = 500s → fires
      const state = makeState({
        stepMetrics: {
          1: { currentCount: 5, completedCount: 5, completionRate: 100, avgScore: 80, medianTime: 500 },
        },
      })
      const tips = generateCoachingTips(state, defaultHealth, defaultStepNames, defaultTaskSteps)
      const tip = findTip(tips, 'step-overtime-1')
      expect(tip).toBeDefined()
      expect(tip!.priority).toBe('important')
    })

    it('does not fire when medianTime <= 1.5x expected', () => {
      const state = makeState({
        stepMetrics: {
          1: { currentCount: 5, completedCount: 5, completionRate: 100, avgScore: 80, medianTime: 400 },
        },
      })
      const tips = generateCoachingTips(state, defaultHealth, defaultStepNames, defaultTaskSteps)
      expect(findTip(tips, 'step-overtime-1')).toBeUndefined()
    })

    it('does not fire when no duration in taskSteps', () => {
      const state = makeState({
        stepMetrics: {
          1: { currentCount: 5, completedCount: 5, completionRate: 100, avgScore: 80, medianTime: 9999 },
        },
      })
      const noDurationSteps = [{ idx: 1 }, { idx: 2 }]
      const tips = generateCoachingTips(state, defaultHealth, defaultStepNames, noDurationSteps)
      expect(tips.filter(t => t.id.startsWith('step-overtime'))).toEqual([])
    })
  })

  // ── pace-gap ──

  describe('pace-gap rule', () => {
    it('fires when furthest - median >= 2 steps', () => {
      const students = [
        makeStudent({ id: 's1', currentTask: 3 }),
        makeStudent({ id: 's2', currentTask: 1 }),
        makeStudent({ id: 's3', currentTask: 1 }),
      ]
      const state = makeState({ students })
      const tips = generateCoachingTips(state, defaultHealth, defaultStepNames, defaultTaskSteps)
      expect(findTip(tips, 'pace-gap')).toBeDefined()
    })

    it('does not fire when gap < 2', () => {
      const students = [
        makeStudent({ id: 's1', currentTask: 2 }),
        makeStudent({ id: 's2', currentTask: 1 }),
        makeStudent({ id: 's3', currentTask: 1 }),
      ]
      const state = makeState({ students })
      const tips = generateCoachingTips(state, defaultHealth, defaultStepNames, defaultTaskSteps)
      expect(findTip(tips, 'pace-gap')).toBeUndefined()
    })
  })

  // ── ai-surge ──

  describe('ai-surge rule', () => {
    it('fires when avg AI rounds per student > 1.5', () => {
      const students = [makeStudent({ id: 's1' }), makeStudent({ id: 's2' })]
      const state = makeState({ students })
      // 2 students, 4 rounds → avg 2.0
      const health = { ...defaultHealth, ai: { rounds: 4, people: 2 } }
      const tips = generateCoachingTips(state, health, defaultStepNames, defaultTaskSteps)
      expect(findTip(tips, 'ai-surge')).toBeDefined()
    })

    it('does not fire when avg <= 1.5', () => {
      const students = [makeStudent({ id: 's1' }), makeStudent({ id: 's2' })]
      const state = makeState({ students })
      // 2 students, 3 rounds → avg 1.5
      const health = { ...defaultHealth, ai: { rounds: 3, people: 2 } }
      const tips = generateCoachingTips(state, health, defaultStepNames, defaultTaskSteps)
      expect(findTip(tips, 'ai-surge')).toBeUndefined()
    })
  })

  // ── near-done ──

  describe('near-done rule', () => {
    it('fires when completionRate >= 90 and completedCount >= 3', () => {
      const state = makeState({
        stepMetrics: {
          1: { currentCount: 1, completedCount: 9, completionRate: 90, avgScore: 80 },
        },
      })
      const tips = generateCoachingTips(state, defaultHealth, defaultStepNames, defaultTaskSteps)
      expect(findTip(tips, 'near-done-1')).toBeDefined()
    })

    it('does not fire when completionRate < 90', () => {
      const state = makeState({
        stepMetrics: {
          1: { currentCount: 2, completedCount: 7, completionRate: 70, avgScore: 80 },
        },
      })
      const tips = generateCoachingTips(state, defaultHealth, defaultStepNames, defaultTaskSteps)
      expect(findTip(tips, 'near-done-1')).toBeUndefined()
    })

    it('does not fire when completedCount < 3', () => {
      const state = makeState({
        stepMetrics: {
          1: { currentCount: 0, completedCount: 2, completionRate: 100, avgScore: 80 },
        },
      })
      const tips = generateCoachingTips(state, defaultHealth, defaultStepNames, defaultTaskSteps)
      expect(findTip(tips, 'near-done-1')).toBeUndefined()
    })
  })

  // ── Sorting ──

  describe('priority sorting', () => {
    it('sorts urgent before important before info', () => {
      const students = [
        makeStudent({ id: 's1', currentTask: 3 }),
        makeStudent({ id: 's2', currentTask: 1 }),
        makeStudent({ id: 's3', currentTask: 1 }),
      ]
      const state = makeState({
        students,
        stepMetrics: {
          1: { currentCount: 0, completedCount: 9, completionRate: 90, avgScore: 80 },
        },
      })
      const health = { ...defaultHealth, stuck: { count: 5, where: 'Step A' } }
      const tips = generateCoachingTips(state, health, defaultStepNames, defaultTaskSteps)

      const priorities = tips.map(t => t.priority)
      const urgentIdx = priorities.indexOf('urgent')
      const importantIdx = priorities.indexOf('important')
      const infoIdx = priorities.indexOf('info')

      if (urgentIdx >= 0 && importantIdx >= 0) expect(urgentIdx).toBeLessThan(importantIdx)
      if (importantIdx >= 0 && infoIdx >= 0) expect(importantIdx).toBeLessThan(infoIdx)
      if (urgentIdx >= 0 && infoIdx >= 0) expect(urgentIdx).toBeLessThan(infoIdx)
    })
  })
})
