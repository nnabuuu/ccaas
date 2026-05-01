import { describe, it, expect } from 'vitest'
import { buildTaskToStep, buildInstructionMap, buildTasksFromManifest } from '../task-data'

/* ═══ buildTaskToStep ═══ */

describe('buildTaskToStep', () => {
  it('empty input → empty map', () => {
    expect(buildTaskToStep([])).toEqual({})
  })

  it('filters only task-type steps', () => {
    const steps = [
      { idx: 0, type: 'instruction' },
      { idx: 1, type: 'task', answerKey: { type: 'quiz' } },
      { idx: 2, type: 'instruction' },
      { idx: 3, type: 'task', answerKey: { type: 'match' } },
    ]
    const map = buildTaskToStep(steps)
    expect(map).toEqual({ 1: 1, 2: 3 })
  })

  it('treats steps without type but with answerKey as tasks', () => {
    const steps = [
      { idx: 5, answerKey: { type: 'quiz' } },
      { idx: 10, answerKey: { type: 'match' } },
    ]
    const map = buildTaskToStep(steps)
    expect(map).toEqual({ 1: 5, 2: 10 })
  })

  it('sorts by idx regardless of input order', () => {
    const steps = [
      { idx: 10, type: 'task' as const },
      { idx: 2, type: 'task' as const },
      { idx: 5, type: 'task' as const },
    ]
    const map = buildTaskToStep(steps)
    expect(map).toEqual({ 1: 2, 2: 5, 3: 10 })
  })

  it('mixed types: instruction filtered out', () => {
    const steps = [
      { idx: 0, type: 'instruction' },
      { idx: 1, type: 'task' },
    ]
    expect(buildTaskToStep(steps)).toEqual({ 1: 1 })
  })
})

/* ═══ buildTasksFromManifest ═══ */

describe('buildTasksFromManifest', () => {
  it('builds tasks from task-type steps with complete fields', () => {
    const steps = [{
      idx: 1, type: 'task' as const, label: '任务一', labelEn: 'Task 1',
      displayName: 'Vocabulary', subtitle: 'Learn words', duration: 5,
      description: 'Read carefully', focusParagraphs: ['p1', 'p3'],
      exerciseLabel: 'Quiz Time',
      answerKey: { type: 'quiz' },
      discuss: { openingQ: 'Why?', openingQZh: '为什么?', maxRounds: 6, maxTimeSeconds: 300, fallbackMC: { question: 'Q?', options: ['A', 'B'], correctIndex: 0, explanation: 'E' }, insight: 'Because', insightZh: '因为' },
      summary: 'Good job',
    }]
    const tasks = buildTasksFromManifest(steps)
    expect(tasks).toHaveLength(1)
    const t = tasks[0]
    expect(t.id).toBe(1)
    expect(t.name).toBe('Vocabulary')
    expect(t.subtitle).toBe('Learn words')
    expect(t.time).toBe('5 min')
    expect(t.focus).toEqual([1, 3])
    expect(t.intro).toBe('Read carefully')
    expect(t.exercise.type).toBe('quiz')
    expect(t.exercise.label).toBe('Quiz Time')
    expect(t.discuss.openingQ).toBe('Why?')
    expect(t.summary).toBe('Good job')
  })

  it('handles missing optional fields gracefully', () => {
    const steps = [{ idx: 0, type: 'task' as const, label: 'T' }]
    const tasks = buildTasksFromManifest(steps)
    expect(tasks).toHaveLength(1)
    expect(tasks[0].name).toBe('T')
    expect(tasks[0].subtitle).toBe('')
    expect(tasks[0].time).toBe('')
    expect(tasks[0].focus).toEqual([])
    expect(tasks[0].exercise.type).toBe('quiz')
    expect(tasks[0].discuss.openingQ).toBe('')
  })

  it('name priority: displayName > labelEn > label', () => {
    expect(buildTasksFromManifest([{ idx: 0, type: 'task', label: 'L', labelEn: 'LE', displayName: 'DN' }])[0].name).toBe('DN')
    expect(buildTasksFromManifest([{ idx: 0, type: 'task', label: 'L', labelEn: 'LE' }])[0].name).toBe('LE')
    expect(buildTasksFromManifest([{ idx: 0, type: 'task', label: 'L' }])[0].name).toBe('L')
  })

  it('focusParagraphs: extracts numeric IDs', () => {
    const steps = [{ idx: 0, type: 'task' as const, label: 'T', focusParagraphs: ['p2', 'p10', 'p0'] }]
    expect(buildTasksFromManifest(steps)[0].focus).toEqual([2, 10, 0])
  })

  it('filters out instruction steps', () => {
    const steps = [
      { idx: 0, type: 'instruction' as const, label: 'I' },
      { idx: 1, type: 'task' as const, label: 'T' },
    ]
    expect(buildTasksFromManifest(steps)).toHaveLength(1)
  })
})

/* ═══ buildInstructionMap ═══ */

describe('buildInstructionMap', () => {
  it('task with own studentView → uses it directly', () => {
    const steps = [
      { idx: 1, type: 'task', studentView: { title: 'Own', body: '<p>body</p>' } },
    ]
    const taskToStep = { 1: 1 }
    const map = buildInstructionMap(steps, taskToStep)
    expect(map[1].title).toBe('Own')
  })

  it('instruction studentView → pairs with next task (backward compat)', () => {
    const steps = [
      { idx: 0, type: 'instruction', studentView: { title: 'Instr', body: '<p>hi</p>' } },
      { idx: 1, type: 'task' },
    ]
    const taskToStep = { 1: 1 }
    const map = buildInstructionMap(steps, taskToStep)
    expect(map[1].title).toBe('Instr')
  })

  it('task own studentView takes priority over preceding instruction', () => {
    const steps = [
      { idx: 0, type: 'instruction', studentView: { title: 'Instr', body: 'a' } },
      { idx: 1, type: 'task', studentView: { title: 'Own', body: 'b' } },
    ]
    const taskToStep = { 1: 1 }
    const map = buildInstructionMap(steps, taskToStep)
    expect(map[1].title).toBe('Own')
  })

  it('no studentView anywhere → empty map', () => {
    const steps = [{ idx: 0, type: 'task' }]
    const taskToStep = { 1: 0 }
    expect(buildInstructionMap(steps, taskToStep)).toEqual({})
  })

  it('instruction does not overwrite already-mapped task', () => {
    const steps = [
      { idx: 0, type: 'instruction', studentView: { title: 'First', body: 'a' } },
      { idx: 1, type: 'instruction', studentView: { title: 'Second', body: 'b' } },
      { idx: 2, type: 'task' },
    ]
    const taskToStep = { 1: 2 }
    const map = buildInstructionMap(steps, taskToStep)
    expect(map[1].title).toBe('First')
  })
})
