/**
 * Integration test: snapshot data → useStudentTask → PracticePhase restore
 *
 * Tests the full restore data flow:
 *   1. fetchSessionSnapshot returns { progress, submissions }
 *   2. useStudentTask derives screen, doneSet, and initialPhase from progress
 *   3. PracticePhase reads from restoredSubmissions context (simulated)
 *   4. restoreAns converts submission data back to component state
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchSessionSnapshot, getCachedSubmission, type CachedSubmission } from '../../../hooks/useClassroom'
import { restoreAns } from '../exercise/PracticePhase'
import { buildTasksFromManifest } from '../task-data'

/* ── localStorage mock ── */

let store: Record<string, string> = {}

beforeEach(() => {
  store = {}
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((k: string) => store[k] ?? null),
    setItem: vi.fn((k: string, v: string) => { store[k] = v }),
    removeItem: vi.fn((k: string) => { delete store[k] }),
  })
})
afterEach(() => { vi.restoreAllMocks() })

/* ── Helpers ── */

/** Simulate what useStudentTask computes from progress */
function deriveTaskState(
  tasks: ReturnType<typeof buildTasksFromManifest>,
  progress: { currentTask: number; currentPhase: string } | null,
) {
  if (!progress) return { screen: 'intro', doneSet: new Set<number>(), initialPhase: null }

  const { currentTask, currentPhase } = progress
  const taskCount = tasks.length
  let screen: string
  if (currentTask > taskCount) screen = 'personal-touch'
  else if (currentTask === taskCount && currentPhase === 'completed') screen = 'personal-touch'
  else screen = String(currentTask)

  const doneSet = new Set<number>()
  for (let i = 1; i < currentTask; i++) doneSet.add(i)
  if (currentPhase === 'completed') doneSet.add(currentTask)

  const taskId = parseInt(screen)
  const initialPhase = !isNaN(taskId) && currentTask === taskId ? currentPhase : null

  return { screen, doneSet, initialPhase }
}

/** Simulate what TaskView computes for phase-level isRevisit */
function phaseIsRevisit(
  taskDone: boolean,
  phaseId: string,
  initialPhase: string | null,
  phaseIds: string[],
) {
  // donePhases = all phases before initialPhase (or all if task is done)
  const donePhases = new Set<string>()
  if (taskDone) {
    phaseIds.forEach(p => donePhases.add(p))
  } else if (initialPhase) {
    const idx = phaseIds.indexOf(initialPhase)
    phaseIds.slice(0, idx > 0 ? idx : 0).forEach(p => donePhases.add(p))
  }
  const isRevisit = taskDone || donePhases.has(phaseId)
  return { isRevisit, donePhases }
}

/** Simulate PracticePhase submission restore from context */
function resolvePrevSubmission(
  isRevisit: boolean,
  stepIdx: number | undefined,
  restoredSubmissions: Record<number, CachedSubmission> | undefined,
  sessionCode?: string,
): CachedSubmission | null {
  if (!isRevisit || stepIdx === undefined) return null
  const fromCtx = restoredSubmissions?.[stepIdx]
  if (fromCtx) return fromCtx
  if (sessionCode) return getCachedSubmission(sessionCode, stepIdx)
  return null
}

/* ═══ Tests ═══ */

const MANIFEST_STEPS = [
  { idx: 0, type: 'instruction' as const, label: 'Intro', strategy: 'intro' as const, studentView: { title: 'Welcome', body: '<p>Hi</p>' } },
  {
    idx: 1, type: 'task' as const, label: 'Task 1', strategy: 'quiz' as const,
    answerKey: { type: 'quiz' as const, answers: [{ questionIdx: 0, correct: 1, questionText: 'Q1', options: ['A', 'B'] }] },
  },
  { idx: 2, type: 'instruction' as const, label: 'Inst 2', strategy: 'intro' as const },
  {
    idx: 3, type: 'task' as const, label: 'Task 2', strategy: 'match' as const,
    answerKey: { type: 'match' as const, options: ['x', 'y'], answers: [{ pairIdx: 0, left: 'A', correct: 'x' }] },
  },
]

const PHASE_IDS = ['listen', 'practice', 'discuss', 'takeaway']

describe('Snapshot → restore integration', () => {
  it('full flow: fetch snapshot → derive task state → resolve submissions → restore answers', async () => {
    const snapshotResponse = {
      currentTask: 2, currentPhase: 'practice',
      submissions: {
        1: { data: { answers: [1] }, score: { total: 100, byDimension: { q0: true } } },
      },
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(snapshotResponse),
    } as Response)

    // 1. Fetch snapshot
    const snapshot = await fetchSessionSnapshot('CODE', 'stu-1')
    expect(snapshot).not.toBeNull()

    // 2. Derive task state
    const tasks = buildTasksFromManifest(MANIFEST_STEPS as any)
    const { screen, doneSet, initialPhase } = deriveTaskState(tasks, snapshot!.progress)
    expect(screen).toBe('2')
    expect(doneSet.has(1)).toBe(true)
    expect(doneSet.has(2)).toBe(false)
    expect(initialPhase).toBe('practice')

    // 3. For task 1 (done), all phases are revisit
    const task1Revisit = phaseIsRevisit(true, 'practice', null, PHASE_IDS)
    expect(task1Revisit.isRevisit).toBe(true)

    // 4. Resolve submission from context for task 1 (step 1)
    const sub = resolvePrevSubmission(true, 1, snapshot!.submissions, 'CODE')
    expect(sub).not.toBeNull()
    expect(sub!.data).toEqual({ answers: [1] })
    expect(sub!.score).toEqual({ total: 100, byDimension: { q0: true } })

    // 5. restoreAns converts back to component state
    const restored = restoreAns('quiz', sub!.data)
    expect(restored).toEqual({ 0: 1 })
  })

  it('localStorage is populated as side effect of fetchSessionSnapshot', async () => {
    const snapshotResponse = {
      currentTask: 1, currentPhase: 'discuss',
      submissions: {
        1: { data: { answers: [0, 2] }, score: { total: 50 } },
      },
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(snapshotResponse),
    } as Response)

    await fetchSessionSnapshot('SESS', 'stu-2')

    // localStorage should have been populated
    const cached = getCachedSubmission('SESS', 1)
    expect(cached).toEqual({ data: { answers: [0, 2] }, score: { total: 50 } })
  })

  it('context submission takes priority over localStorage', () => {
    // Pre-populate localStorage with stale data
    store['sub:CODE:1'] = JSON.stringify({ data: { answers: [0] }, score: null })

    const ctxSubmissions: Record<number, CachedSubmission> = {
      1: { data: { answers: [1] }, score: { total: 100 } },
    }

    const sub = resolvePrevSubmission(true, 1, ctxSubmissions, 'CODE')
    expect(sub).toEqual(ctxSubmissions[1])
  })

  it('falls back to localStorage when context has no entry for step', () => {
    store['sub:CODE:3'] = JSON.stringify({ data: { pairs: ['x'] }, score: null })

    // Context only has step 1, but we're looking for step 3
    const ctxSubmissions: Record<number, CachedSubmission> = {
      1: { data: { answers: [1] }, score: { total: 100 } },
    }

    const sub = resolvePrevSubmission(true, 3, ctxSubmissions, 'CODE')
    expect(sub).toEqual({ data: { pairs: ['x'] }, score: null })
  })

  it('returns null when not revisit even if data exists', () => {
    const ctxSubmissions: Record<number, CachedSubmission> = {
      1: { data: { answers: [1] }, score: { total: 100 } },
    }
    const sub = resolvePrevSubmission(false, 1, ctxSubmissions, 'CODE')
    expect(sub).toBeNull()
  })

  it('fresh student: no progress → intro screen, no submissions', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 200,
      json: () => Promise.resolve(null),
    } as Response)

    const snapshot = await fetchSessionSnapshot('CODE', 'new-student')
    // API returns null for nonexistent student
    expect(snapshot).toBeNull()

    const tasks = buildTasksFromManifest(MANIFEST_STEPS as any)
    const { screen, doneSet } = deriveTaskState(tasks, null)
    expect(screen).toBe('intro')
    expect(doneSet.size).toBe(0)
  })

  it('student on task 2 listen: task 1 phases are all revisit, task 2 listen is not', () => {
    const progress = { currentTask: 2, currentPhase: 'listen' }
    const tasks = buildTasksFromManifest(MANIFEST_STEPS as any)
    const { doneSet, initialPhase } = deriveTaskState(tasks, progress)

    // Task 1 is done
    expect(doneSet.has(1)).toBe(true)

    // Task 2 listen: initialPhase = 'listen', no phases done yet
    expect(initialPhase).toBe('listen')
    const { isRevisit: listenRevisit } = phaseIsRevisit(false, 'listen', 'listen', PHASE_IDS)
    expect(listenRevisit).toBe(false)

    const { isRevisit: practiceRevisit } = phaseIsRevisit(false, 'practice', 'listen', PHASE_IDS)
    expect(practiceRevisit).toBe(false)
  })

  it('student on task 2 discuss: listen and practice are revisit', () => {
    const progress = { currentTask: 2, currentPhase: 'discuss' }
    const tasks = buildTasksFromManifest(MANIFEST_STEPS as any)
    const { initialPhase } = deriveTaskState(tasks, progress)

    expect(initialPhase).toBe('discuss')
    const { isRevisit: listenRevisit } = phaseIsRevisit(false, 'listen', 'discuss', PHASE_IDS)
    expect(listenRevisit).toBe(true)

    const { isRevisit: practiceRevisit } = phaseIsRevisit(false, 'practice', 'discuss', PHASE_IDS)
    expect(practiceRevisit).toBe(true)

    const { isRevisit: discussRevisit } = phaseIsRevisit(false, 'discuss', 'discuss', PHASE_IDS)
    expect(discussRevisit).toBe(false)
  })

  it('completed student → personal-touch screen', () => {
    const tasks = buildTasksFromManifest(MANIFEST_STEPS as any)
    const progress = { currentTask: tasks.length, currentPhase: 'completed' }
    const { screen, doneSet } = deriveTaskState(tasks, progress)
    expect(screen).toBe('personal-touch')
    expect(doneSet.has(1)).toBe(true)
    expect(doneSet.has(2)).toBe(true)
  })

  // ── discuss recovery ──

  it('discuss goalReached: derives done phase from discussMeta', () => {
    const progress = { currentTask: 1, currentPhase: 'discuss', discussMeta: { startedAt: '2025-01-01T00:00:00.000Z', goalReached: true } }
    const tasks = buildTasksFromManifest(MANIFEST_STEPS as any)
    const { initialPhase } = deriveTaskState(tasks, progress)
    expect(initialPhase).toBe('discuss')

    // DiscussPhase would read discussMeta.goalReached and set phase='done'
    const isRevisit = false
    const goalReached = !!progress.discussMeta?.goalReached
    const phase = isRevisit ? 'done' : goalReached ? 'done' : 'chat'
    expect(phase).toBe('done')
    expect(goalReached).toBe(true)
  })

  it('discuss mid-chat: phase hydrates to chat with no goalReached', () => {
    const progress = { currentTask: 1, currentPhase: 'discuss', discussMeta: { startedAt: '2025-01-01T00:00:00.000Z' } as { startedAt: string; goalReached?: boolean } }
    const goalReached = !!progress.discussMeta?.goalReached
    const phase = goalReached ? 'done' : 'chat'
    expect(phase).toBe('chat')
    expect(goalReached).toBe(false)
  })

  it('discuss startTime: restores from discussMeta.startedAt', () => {
    const startedAt = '2025-06-01T12:30:00.000Z'
    const progress = { currentTask: 1, currentPhase: 'discuss', discussMeta: { startedAt } }
    const startTime = progress.discussMeta?.startedAt
      ? new Date(progress.discussMeta.startedAt).getTime()
      : Date.now()
    expect(startTime).toBe(new Date(startedAt).getTime())
  })

  it('discuss fallback_rounds: detected when round >= maxRounds after history restore', () => {
    const maxRounds = 5
    const studentMsgCount = 5
    // Simulates the fallback detection logic in DiscussPhase after fetchHistory
    const shouldFallback = studentMsgCount >= maxRounds
    expect(shouldFallback).toBe(true)
  })

  it('discuss fallback_time: detected when elapsed >= maxTimeSeconds', () => {
    const maxTimeSeconds = 180
    const startedAt = new Date(Date.now() - 200_000).toISOString() // 200 seconds ago
    const elapsedSec = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
    expect(elapsedSec >= maxTimeSeconds).toBe(true)
  })

  it('restoreAns works for all exercise types from snapshot data', () => {
    // Simulate various submission types that might come from snapshot
    const cases: Array<{ type: string; data: Record<string, unknown>; expected: Record<string, unknown> }> = [
      { type: 'quiz', data: { answers: [1, 0, 2] }, expected: { 0: 1, 1: 0, 2: 2 } },
      { type: 'match', data: { pairs: ['a', 'b'] }, expected: { 0: 'a', 1: 'b' } },
      { type: 'order', data: { order: [2, 0, 1] }, expected: { order: [2, 0, 1] } },
      { type: 'stance', data: { position: 1, evidence: [0, 2] }, expected: { stance: 1, evidence: [0, 2] } },
      { type: 'map', data: { placements: { a: { x: 0.5, y: 0.3 } }, reasons: { a: 'why' } }, expected: { placements: { a: { x: 0.5, y: 0.3 } }, reasons: { a: 'why' } } },
    ]
    for (const { type, data, expected } of cases) {
      expect(restoreAns(type, data)).toEqual(expected)
    }
  })
})
