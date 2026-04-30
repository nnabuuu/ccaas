import { describe, it, expect } from 'vitest'
import { enrichExerciseFromSpec } from '../enrich-exercise'
import type { TaskExercise } from '../task-data'
import type { ExerciseSpec } from '../../../hooks/useClassroom'

const BASE: TaskExercise = { type: 'quiz', label: '' }

/* ═══ API PATH (7 types) ═══ */

describe('enrichExerciseFromSpec — API path', () => {
  it('quiz: injects questions without correct', () => {
    const spec: ExerciseSpec = {
      type: 'quiz', label: 'Q',
      questions: [
        { idx: 0, text: 'What?', translate: '什么?', options: ['A', 'B', 'C'] },
      ],
    }
    const { exercise, serverCheck } = enrichExerciseFromSpec(BASE, spec, undefined)
    expect(exercise.type).toBe('quiz')
    expect(exercise.label).toBe('Q')
    expect(exercise.questions).toHaveLength(1)
    expect(exercise.questions![0].q).toBe('What?')
    expect(exercise.questions![0].translate).toBe('什么?')
    expect(exercise.questions![0].opts).toEqual(['A', 'B', 'C'])
    expect(exercise.questions![0].correct).toBeUndefined()
    expect(serverCheck).toBe(true)
  })

  it('match: injects pairs without correct', () => {
    const spec: ExerciseSpec = {
      type: 'match', label: 'M',
      pairs: [
        { idx: 0, left: 'Apple', options: ['Fruit', 'Veg'] },
        { idx: 1, left: 'Carrot', options: ['Fruit', 'Veg'] },
      ],
    }
    const { exercise, serverCheck } = enrichExerciseFromSpec(BASE, spec, undefined)
    expect(exercise.type).toBe('match')
    expect(exercise.pairs).toHaveLength(2)
    expect(exercise.pairs![0].left).toBe('Apple')
    expect(exercise.pairs![0].opts).toEqual(['Fruit', 'Veg'])
    expect(exercise.pairs![0].correct).toBeUndefined()
    expect(serverCheck).toBe(true)
  })

  it('matrix: injects rows with demo/practice/reason', () => {
    const spec: ExerciseSpec = {
      type: 'matrix', label: 'Mx',
      rows: [
        { idx: 0, place: 'Tokyo', isDemo: true, practice: 'culture', reason: 'historic' },
        { idx: 1, place: 'Paris', isDemo: false },
      ],
    }
    const { exercise, serverCheck } = enrichExerciseFromSpec(BASE, spec, undefined)
    expect(exercise.type).toBe('matrix')
    expect(exercise.rows).toHaveLength(2)
    expect(exercise.rows![0]).toMatchObject({ place: 'Tokyo', demo: true, practice: 'culture', reason: 'historic' })
    expect(exercise.rows![1]).toMatchObject({ place: 'Paris', demo: false })
    expect(exercise.rows![1].practice).toBeUndefined()
    expect(serverCheck).toBe(true)
  })

  it('stance: injects stanceQ/opts/evidence', () => {
    const spec: ExerciseSpec = {
      type: 'stance', label: 'S',
      stanceQ: 'Do you agree?', stanceQZh: '你同意吗?',
      stanceOpts: ['Yes', 'No'], evidence: ['p1', 'p2'],
    }
    const { exercise, serverCheck } = enrichExerciseFromSpec(BASE, spec, undefined)
    expect(exercise.stanceQ).toBe('Do you agree?')
    expect(exercise.stanceQZh).toBe('你同意吗?')
    expect(exercise.stanceOpts).toEqual(['Yes', 'No'])
    expect(exercise.evidence).toEqual(['p1', 'p2'])
    expect(serverCheck).toBe(true)
  })

  it('order: injects items, no correctOrder', () => {
    const spec: ExerciseSpec = {
      type: 'order', label: 'O',
      items: ['first', 'second', 'third'],
    }
    const { exercise, serverCheck } = enrichExerciseFromSpec(BASE, spec, undefined)
    expect(exercise.items).toEqual(['first', 'second', 'third'])
    expect(exercise.correctOrder).toBeUndefined()
    expect(serverCheck).toBe(true)
  })

  it('select-evidence: injects functionOptions/sections/paragraphTokens, serverCheck=false', () => {
    const spec: ExerciseSpec = {
      type: 'select-evidence', label: 'SE',
      functionOptions: ['explain', 'argue'],
      sections: [{ id: 's1', label: 'Sec 1', range: [1, 3], correctFunction: 'explain' }],
      paragraphTokens: { p1: [{ t: 'hello', kind: 'evidence', why: 'key detail' }] },
    }
    const { exercise, serverCheck } = enrichExerciseFromSpec(BASE, spec, undefined)
    expect(exercise.functionOptions).toEqual(['explain', 'argue'])
    expect(exercise.sections).toHaveLength(1)
    expect(exercise.sections![0].correctFunction).toBe('explain')
    expect(exercise.paragraphTokens).toBeDefined()
    expect(exercise.paragraphTokens!['p1'][0].t).toBe('hello')
    expect(serverCheck).toBe(false)
  })

  it('map: injects prompt/axes/mapItems/minReasonLength', () => {
    const spec: ExerciseSpec = {
      type: 'map', label: 'Map',
      prompt: 'Place items', minReasonLength: 20,
      axes: { x: { neg: 'Low', pos: 'High', label: 'X' }, y: { neg: 'Bad', pos: 'Good', label: 'Y' } },
      mapItems: [{ id: 'i1', label: 'Item 1' }],
    }
    const { exercise, serverCheck } = enrichExerciseFromSpec(BASE, spec, undefined)
    expect(exercise.prompt).toBe('Place items')
    expect(exercise.axes!.x.neg).toBe('Low')
    expect(exercise.mapItems).toHaveLength(1)
    expect(exercise.minReasonLength).toBe(20)
    expect(serverCheck).toBe(true)
  })
})

/* ═══ MANIFEST FALLBACK (7 types) ═══ */

describe('enrichExerciseFromSpec — manifest fallback', () => {
  it('quiz: injects from ak.answers with correct/hint/walkthrough', () => {
    const ak = {
      type: 'quiz',
      answers: [
        { questionText: 'Q1', options: ['A', 'B'], correct: 1, hint: 'Think again', walkthrough: 'Because B' },
      ],
    }
    const { exercise, serverCheck } = enrichExerciseFromSpec(BASE, undefined, ak)
    expect(exercise.questions).toHaveLength(1)
    expect(exercise.questions![0].q).toBe('Q1')
    expect(exercise.questions![0].correct).toBe(1)
    expect(exercise.questions![0].hint).toBe('Think again')
    expect(exercise.questions![0].walkthrough).toBe('Because B')
    expect(serverCheck).toBe(false)
  })

  it('quiz: sanitized manifest overrides via ak.questions', () => {
    const ak = {
      type: 'quiz',
      answers: [{ questionText: 'Original', options: ['X'], correct: 0 }],
      questions: [{ text: 'Sanitized', translate: '净化', options: ['Y', 'Z'] }],
    }
    const { exercise } = enrichExerciseFromSpec(BASE, undefined, ak)
    expect(exercise.questions![0].q).toBe('Sanitized')
    expect(exercise.questions![0].translate).toBe('净化')
    expect(exercise.questions![0].opts).toEqual(['Y', 'Z'])
  })

  it('match: injects from ak.answers with shared options pool', () => {
    const ak = {
      type: 'match',
      options: ['Fruit', 'Veg', 'Grain'],
      answers: [
        { left: 'Apple', correct: 0, hint: 'round' },
        { left: 'Rice', correct: 2 },
      ],
    }
    const { exercise } = enrichExerciseFromSpec(BASE, undefined, ak)
    expect(exercise.pairs).toHaveLength(2)
    expect(exercise.pairs![0].left).toBe('Apple')
    expect(exercise.pairs![0].opts).toEqual(['Fruit', 'Veg', 'Grain'])
    expect(exercise.pairs![0].correct).toBe(0)
    expect(exercise.pairs![0].hint).toBe('round')
    expect(exercise.pairs![1].correct).toBe(2)
  })

  it('match: string correct resolved to index', () => {
    const ak = {
      type: 'match',
      options: ['Alpha', 'Beta'],
      answers: [{ left: 'X', correct: 'Beta' }],
    }
    const { exercise } = enrichExerciseFromSpec(BASE, undefined, ak)
    expect(exercise.pairs![0].correct).toBe(1)
  })

  it('match: sanitized manifest overrides via ak.pairs', () => {
    const ak = {
      type: 'match',
      answers: [{ left: 'Original' }],
      pairs: [{ left: 'Sanitized', options: ['A', 'B'] }],
    }
    const { exercise } = enrichExerciseFromSpec(BASE, undefined, ak)
    expect(exercise.pairs![0].left).toBe('Sanitized')
    expect(exercise.pairs![0].opts).toEqual(['A', 'B'])
  })

  it('matrix: injects from ak.answers with hint', () => {
    const ak = {
      type: 'matrix',
      answers: [
        { place: 'London', isDemo: true, practice: 'culture', hint: 'Big city' },
        { place: 'Berlin', isDemo: false, reason: 'history' },
      ],
    }
    const { exercise } = enrichExerciseFromSpec(BASE, undefined, ak)
    expect(exercise.rows).toHaveLength(2)
    expect(exercise.rows![0]).toMatchObject({ place: 'London', demo: true, practice: 'culture', hint: 'Big city' })
    expect(exercise.rows![1]).toMatchObject({ place: 'Berlin', demo: false, reason: 'history' })
  })

  it('matrix: sanitized manifest overrides via ak.rows', () => {
    const ak = {
      type: 'matrix',
      answers: [{ place: 'Orig', isDemo: false }],
      rows: [{ place: 'Sanitized', isDemo: true, practice: 'new' }],
    }
    const { exercise } = enrichExerciseFromSpec(BASE, undefined, ak)
    expect(exercise.rows![0].place).toBe('Sanitized')
    expect(exercise.rows![0].demo).toBe(true)
    expect(exercise.rows![0].practice).toBe('new')
  })

  it('stance: injects from manifest ak', () => {
    const ak = {
      type: 'stance',
      stanceQ: 'Agree?', stanceQZh: '同意?',
      stanceOpts: ['Yes', 'No'], evidence: ['e1'],
    }
    const { exercise } = enrichExerciseFromSpec(BASE, undefined, ak)
    expect(exercise.stanceQ).toBe('Agree?')
    expect(exercise.stanceOpts).toEqual(['Yes', 'No'])
  })

  it('order: injects items AND correctOrder from manifest', () => {
    const ak = {
      type: 'order',
      items: ['a', 'b', 'c'], correctOrder: [2, 0, 1],
    }
    const { exercise } = enrichExerciseFromSpec(BASE, undefined, ak)
    expect(exercise.items).toEqual(['a', 'b', 'c'])
    expect(exercise.correctOrder).toEqual([2, 0, 1])
  })

  it('select-evidence: injects from manifest ak', () => {
    const ak = {
      type: 'select-evidence',
      functionOptions: ['explain', 'describe'],
      sections: [{ id: 's1', label: 'S1', range: [1, 2], correctFunction: 'explain' }],
      paragraphTokens: { p1: [{ t: 'text', kind: 'evidence' }] },
    }
    const { exercise } = enrichExerciseFromSpec(BASE, undefined, ak)
    expect(exercise.type).toBe('select-evidence')
    expect(exercise.functionOptions).toEqual(['explain', 'describe'])
    expect(exercise.sections).toHaveLength(1)
    expect(exercise.paragraphTokens!['p1']).toHaveLength(1)
  })

  it('map: injects from manifest ak (mapItems field)', () => {
    const ak = {
      type: 'map',
      prompt: 'Place', axes: { x: { neg: 'L', pos: 'R', label: 'X' }, y: { neg: 'D', pos: 'U', label: 'Y' } },
      mapItems: [{ id: 'm1', label: 'M1' }], minReasonLength: 10,
    }
    const { exercise } = enrichExerciseFromSpec(BASE, undefined, ak)
    expect(exercise.prompt).toBe('Place')
    expect(exercise.mapItems).toHaveLength(1)
    expect(exercise.minReasonLength).toBe(10)
  })

  it('map: falls back to ak.items when mapItems absent', () => {
    const ak = {
      type: 'map',
      items: [{ id: 'i1', label: 'I1' }],
    }
    const { exercise } = enrichExerciseFromSpec(BASE, undefined, ak)
    expect(exercise.mapItems).toEqual([{ id: 'i1', label: 'I1' }])
  })
})

/* ═══ BOUNDARY CASES ═══ */

describe('enrichExerciseFromSpec — boundaries', () => {
  it('neither apiSpec nor answerKey → returns original exercise', () => {
    const { exercise, serverCheck } = enrichExerciseFromSpec(BASE, undefined, undefined)
    expect(exercise).toEqual(BASE)
    expect(serverCheck).toBe(false)
  })

  it('apiSpec takes priority over answerKey', () => {
    const spec: ExerciseSpec = {
      type: 'quiz', label: 'API',
      questions: [{ idx: 0, text: 'API Q', options: ['A'] }],
    }
    const ak = {
      type: 'quiz',
      answers: [{ questionText: 'Manifest Q', options: ['B'], correct: 0 }],
    }
    const { exercise, serverCheck } = enrichExerciseFromSpec(BASE, spec, ak)
    expect(exercise.questions![0].q).toBe('API Q')
    expect(exercise.questions![0].correct).toBeUndefined()
    expect(serverCheck).toBe(true)
  })

  it('exerciseLabel applied in manifest path', () => {
    const ak = { type: 'order', items: ['x'] }
    const { exercise } = enrichExerciseFromSpec(BASE, undefined, ak, 'Custom Label')
    expect(exercise.label).toBe('Custom Label')
  })

  it('exerciseLabel ignored in API path (uses spec.label)', () => {
    const spec: ExerciseSpec = { type: 'order', label: 'API Label', items: ['x'] }
    const { exercise } = enrichExerciseFromSpec(BASE, spec, undefined, 'Ignored')
    expect(exercise.label).toBe('API Label')
  })

  it('does not mutate input exercise (top-level and nested)', () => {
    const input: TaskExercise = {
      type: 'quiz', label: 'orig',
      questions: [{ q: 'old', opts: ['X'] }],
    }
    const spec: ExerciseSpec = { type: 'quiz', label: 'new', questions: [{ idx: 0, text: 'Q', options: ['A'] }] }
    enrichExerciseFromSpec(input, spec, undefined)
    expect(input.label).toBe('orig')
    expect(input.questions![0].q).toBe('old')
    expect(input.questions![0].opts).toEqual(['X'])
  })

  it('API spec with empty-string label does not overwrite exercise label', () => {
    const input: TaskExercise = { type: 'quiz', label: 'Original' }
    const spec: ExerciseSpec = { type: 'quiz', label: '' }
    const { exercise } = enrichExerciseFromSpec(input, spec, undefined)
    expect(exercise.label).toBe('Original')
  })

  it('match: string correct not in options resolves to -1', () => {
    const ak = {
      type: 'match',
      options: ['Alpha', 'Beta'],
      answers: [{ left: 'X', correct: 'Gamma' }],
    }
    const { exercise } = enrichExerciseFromSpec(BASE, undefined, ak)
    expect(exercise.pairs![0].correct).toBe(-1)
  })

  it('unknown ak.type falls through — returns exercise with only label changed', () => {
    const ak = { type: 'unknown-type' }
    const { exercise } = enrichExerciseFromSpec(BASE, undefined, ak, 'Label')
    expect(exercise.label).toBe('Label')
    expect(exercise.questions).toBeUndefined()
    expect(exercise.pairs).toBeUndefined()
  })
})
