import { describe, it, expect } from 'vitest'
import type { ReviewData } from '../../../../hooks/useReviewRestore'
import { parseQuizReview } from '../QuizExercise'
import { parseMatchReview } from '../MatchExercise'
import { parseMatrixReview } from '../MatrixExercise'
import { parseOrderReview } from '../OrderExercise'
import { parseStanceReview } from '../StanceExercise'
import { parseFillBlankReview } from '../FillBlankExercise'
import { parseGdReview } from '../GuidedDiscoveryExercise'
import { parseMapReview } from '../MapExercise'
import { parseImageUploadReview } from '../ImageUploadExercise'
import { parseRcqReview } from '../RichContentQuizExercise'
import { parseSeReview } from '../SelectEvidenceExercise'
import type { RichContentQuizPart } from '../../task-data'

// ---------------------------------------------------------------------------
// 1. parseQuizReview
// ---------------------------------------------------------------------------
describe('parseQuizReview', () => {
  it('restores answers and marks correct/wrong from checkItems', () => {
    const review: ReviewData = {
      data: { answers: [2, 1, 0] },
      checkItems: [
        { idx: 0, correct: true },
        { idx: 1, correct: false },
        { idx: 2, correct: true },
      ],
    }
    const result = parseQuizReview(review, 3)
    expect(result.allDone).toBe(true)
    expect(result.state.ans).toEqual({ 0: 2, 1: 1, 2: 0 })
    expect(result.state.correctQs).toEqual(new Set([0, 2]))
    expect(result.state.wrongQs).toEqual(new Set([1]))
  })

  it('assumes all correct when checkItems is absent', () => {
    const review: ReviewData = { data: { answers: [0, 1] } }
    const result = parseQuizReview(review, 2)
    expect(result.state.correctQs).toEqual(new Set([0, 1]))
    expect(result.state.wrongQs.size).toBe(0)
  })

  it('handles empty answers array', () => {
    const review: ReviewData = { data: { answers: [] }, checkItems: [] }
    const result = parseQuizReview(review, 0)
    expect(result.state.ans).toEqual({})
    expect(result.state.correctQs.size).toBe(0)
    expect(result.state.wrongQs.size).toBe(0)
  })

  it('handles missing answers key — falls back to empty', () => {
    const review: ReviewData = { data: {} }
    const result = parseQuizReview(review, 3)
    expect(result.state.ans).toEqual({})
    // no checkItems → assume all correct
    expect(result.state.correctQs).toEqual(new Set([0, 1, 2]))
  })

  it('handles string idx values via toIdx coercion', () => {
    const review: ReviewData = {
      data: { answers: [1] },
      checkItems: [{ idx: '0', correct: true }],
    }
    const result = parseQuizReview(review, 1)
    expect(result.state.correctQs.has(0)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 2. parseMatchReview
// ---------------------------------------------------------------------------
describe('parseMatchReview', () => {
  it('restores pair answers and marks correct/wrong from checkItems', () => {
    const review: ReviewData = {
      data: { pairs: [1, 0, 2] },
      checkItems: [
        { idx: 0, correct: true },
        { idx: 1, correct: true },
        { idx: 2, correct: false },
      ],
    }
    const result = parseMatchReview(review, 3)
    expect(result.allDone).toBe(true)
    expect(result.state.ans).toEqual({ 0: 1, 1: 0, 2: 2 })
    expect(result.state.correctQs).toEqual(new Set([0, 1]))
    expect(result.state.wrongQs).toEqual(new Set([2]))
  })

  it('assumes all correct when checkItems is absent', () => {
    const review: ReviewData = { data: { pairs: [0, 1] } }
    const result = parseMatchReview(review, 2)
    expect(result.state.correctQs).toEqual(new Set([0, 1]))
    expect(result.state.wrongQs.size).toBe(0)
  })

  it('handles missing pairs key', () => {
    const review: ReviewData = { data: {} }
    const result = parseMatchReview(review, 2)
    expect(result.state.ans).toEqual({})
    expect(result.state.correctQs).toEqual(new Set([0, 1]))
  })

  it('handles empty checkItems array — uses pairCount fallback', () => {
    const review: ReviewData = { data: { pairs: [0] }, checkItems: [] }
    const result = parseMatchReview(review, 1)
    expect(result.state.correctQs).toEqual(new Set([0]))
  })
})

// ---------------------------------------------------------------------------
// 3. parseMatrixReview
// ---------------------------------------------------------------------------
describe('parseMatrixReview', () => {
  it('restores row answers and rowResults from checkItems', () => {
    const review: ReviewData = {
      data: { rows: { 0: { what: 'foo', why: 'bar' }, 1: { what: 'baz', why: 'qux' } } },
      checkItems: [
        { idx: 0, correct: true },
        { idx: 1, correct: false },
      ],
    }
    const result = parseMatrixReview(review)
    expect(result.allDone).toBe(true)
    expect(result.state.ans[0]).toEqual({ what: 'foo', why: 'bar' })
    expect(result.state.rowResults).toEqual({ 0: true, 1: false })
  })

  it('handles no checkItems — rowResults is empty', () => {
    const review: ReviewData = {
      data: { rows: { 2: { what: 'a', why: 'b' } } },
    }
    const result = parseMatrixReview(review)
    expect(result.state.rowResults).toEqual({})
    expect(result.state.ans[2]).toEqual({ what: 'a', why: 'b' })
  })

  it('handles missing rows key — ans is empty object', () => {
    const review: ReviewData = { data: {} }
    const result = parseMatrixReview(review)
    expect(result.state.ans).toEqual({})
    expect(result.state.rowResults).toEqual({})
  })

  it('coerces string idx to number keys in rowResults', () => {
    const review: ReviewData = {
      data: { rows: {} },
      checkItems: [{ idx: '3', correct: true }],
    }
    const result = parseMatrixReview(review)
    expect(result.state.rowResults[3]).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 4. parseOrderReview
// ---------------------------------------------------------------------------
describe('parseOrderReview', () => {
  it('restores order array', () => {
    const review: ReviewData = { data: { order: [2, 0, 1] } }
    const result = parseOrderReview(review)
    expect(result.allDone).toBe(true)
    expect(result.state.ans).toEqual({ order: [2, 0, 1] })
  })

  it('handles missing order — falls back to empty array', () => {
    const review: ReviewData = { data: {} }
    const result = parseOrderReview(review)
    expect(result.state.ans).toEqual({ order: [] })
  })

  it('handles empty order array', () => {
    const review: ReviewData = { data: { order: [] } }
    const result = parseOrderReview(review)
    expect(result.state.ans).toEqual({ order: [] })
  })

  it('ignores checkItems entirely', () => {
    const review: ReviewData = {
      data: { order: [1, 0] },
      checkItems: [{ idx: 0, correct: false }],
    }
    const result = parseOrderReview(review)
    // checkItems not used by parseOrderReview
    expect(result.state.ans).toEqual({ order: [1, 0] })
  })
})

// ---------------------------------------------------------------------------
// 5. parseStanceReview
// ---------------------------------------------------------------------------
describe('parseStanceReview', () => {
  it('restores stance and evidence', () => {
    const review: ReviewData = {
      data: { position: 'Agree', evidence: [0, 2] },
    }
    const result = parseStanceReview(review)
    expect(result.allDone).toBe(true)
    expect(result.state.ans).toEqual({ stance: 'Agree', evidence: [0, 2] })
    expect(result.state.softDone).toBe(true)
  })

  it('handles position=0 (falsy but valid)', () => {
    const review: ReviewData = { data: { position: 0, evidence: [1] } }
    const result = parseStanceReview(review)
    expect(result.state.ans.stance).toBe(0)
  })

  it('handles undefined position', () => {
    const review: ReviewData = { data: {} }
    const result = parseStanceReview(review)
    expect(result.state.ans.stance).toBeUndefined()
    expect(result.state.ans.evidence).toEqual([])
  })

  it('handles missing evidence — falls back to empty array', () => {
    const review: ReviewData = { data: { position: 'Disagree' } }
    const result = parseStanceReview(review)
    expect(result.state.ans.evidence).toEqual([])
  })

  it('handles position as numeric index', () => {
    const review: ReviewData = { data: { position: 2, evidence: [] } }
    const result = parseStanceReview(review)
    expect(result.state.ans.stance).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// 6. parseFillBlankReview
// ---------------------------------------------------------------------------
describe('parseFillBlankReview', () => {
  it('restores blanks from data.blanks and blankResults from checkItems', () => {
    const review: ReviewData = {
      data: { blanks: { s1_0: 'hello', s1_1: 'world' } },
      checkItems: [
        { idx: 's1_0', correct: true },
        { idx: 's1_1', correct: false },
      ],
    }
    const result = parseFillBlankReview(review)
    expect(result.allDone).toBe(true)
    expect(result.state.ans).toEqual({ s1_0: 'hello', s1_1: 'world' })
    expect(result.state.blankResults).toEqual({ s1_0: true, s1_1: false })
  })

  it('returns empty ans when blanks key is absent', () => {
    const review: ReviewData = {
      data: { s1_0: 'x', s1_1: 'y' } as Record<string, unknown>,
    }
    const result = parseFillBlankReview(review)
    expect(result.state.ans).toEqual({})
  })

  it('handles no checkItems — blankResults is empty', () => {
    const review: ReviewData = {
      data: { blanks: { s1_0: 'a' } },
    }
    const result = parseFillBlankReview(review)
    expect(result.state.blankResults).toEqual({})
  })

  it('handles empty blanks object', () => {
    const review: ReviewData = { data: { blanks: {} } }
    const result = parseFillBlankReview(review)
    expect(result.state.ans).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// 7. parseGdReview
// ---------------------------------------------------------------------------
describe('parseGdReview', () => {
  it('restores step answers and stepResults from checkItems', () => {
    const review: ReviewData = {
      data: {
        steps: {
          step1: { answers: { c1: 0 } },
          step2: { answers: { b1: 'abc' } },
        },
      },
      checkItems: [
        { idx: 'step1', correct: true },
        { idx: 'step2', correct: false },
      ],
    }
    const result = parseGdReview(review)
    expect(result.allDone).toBe(true)
    expect(result.state.ans.steps.step1.answers).toEqual({ c1: 0 })
    expect(result.state.stepResults).toEqual({ step1: true, step2: false })
  })

  it('handles no checkItems — stepResults is empty', () => {
    const review: ReviewData = {
      data: { steps: { s1: { answers: { q: 1 } } } },
    }
    const result = parseGdReview(review)
    expect(result.state.stepResults).toEqual({})
  })

  it('extracts only steps from data (no metadata leakage)', () => {
    const review: ReviewData = {
      data: { steps: { s1: { answers: { q: 1 } } }, extraField: 'ignored' },
    }
    const result = parseGdReview(review)
    expect(result.state.ans.steps.s1.answers).toEqual({ q: 1 })
    expect((result.state.ans as any).extraField).toBeUndefined()
  })

  it('handles empty data', () => {
    const review: ReviewData = { data: {} }
    const result = parseGdReview(review)
    expect(result.state.ans).toEqual({ steps: {} })
    expect(result.state.stepResults).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// 8. parseMapReview
// ---------------------------------------------------------------------------
describe('parseMapReview', () => {
  it('restores placements, reasons, and per-item results', () => {
    const review: ReviewData = {
      data: {
        placements: { theme: { x: 0.5, y: -0.3 } },
        reasons: { theme: 'because...' },
      },
      checkItems: [
        { idx: 'theme', correct: true, hint: 'Good placement' },
      ],
    }
    const result = parseMapReview(review)
    expect(result.allDone).toBe(true)
    expect(result.state.ans.placements).toEqual({ theme: { x: 0.5, y: -0.3 } })
    expect(result.state.ans.reasons).toEqual({ theme: 'because...' })
    expect(result.state.itemResults).toEqual({ theme: { correct: true, hint: 'Good placement' } })
    expect(result.state.feedback).toBeNull()
  })

  it('extracts _llm feedback from checkItems', () => {
    const review: ReviewData = {
      data: { placements: {}, reasons: {} },
      checkItems: [
        { idx: '_llm', correct: false, hint: 'Overall feedback here' },
        { idx: 'item1', correct: false, hint: 'Move it left' },
      ],
    }
    const result = parseMapReview(review)
    expect(result.state.feedback).toBe('Overall feedback here')
    expect(result.state.itemResults).toEqual({ item1: { correct: false, hint: 'Move it left' } })
  })

  it('handles no checkItems — empty itemResults and null feedback', () => {
    const review: ReviewData = {
      data: { placements: { a: { x: 0, y: 0 } }, reasons: { a: 'test' } },
    }
    const result = parseMapReview(review)
    expect(result.state.itemResults).toEqual({})
    expect(result.state.feedback).toBeNull()
  })

  it('handles missing placements/reasons — defaults to empty objects', () => {
    const review: ReviewData = { data: {} }
    const result = parseMapReview(review)
    expect(result.state.ans.placements).toEqual({})
    expect(result.state.ans.reasons).toEqual({})
  })

  it('_llm item without hint sets feedback to null', () => {
    const review: ReviewData = {
      data: { placements: {}, reasons: {} },
      checkItems: [{ idx: '_llm', correct: false }],
    }
    const result = parseMapReview(review)
    expect(result.state.feedback).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 9. parseImageUploadReview
// ---------------------------------------------------------------------------
describe('parseImageUploadReview', () => {
  it('restores images, rubric scores, and _llm feedback', () => {
    const review: ReviewData = {
      data: { images: ['data:image/png;base64,abc'] },
      checkItems: [
        { idx: '_llm', correct: false, hint: 'Good work overall' },
        { idx: 'accuracy', correct: true, score: 3, hint: 'Perfect' },
        { idx: 'neatness', correct: false, score: 1, hint: 'Needs work' },
      ],
    }
    const result = parseImageUploadReview(review)
    expect(result.allDone).toBe(true)
    expect(result.state.ans).toEqual({ images: ['data:image/png;base64,abc'] })
    expect(result.state.feedback).toBe('Good work overall')
    expect(result.state.rubricResults).toEqual({
      accuracy: { score: 3, hint: 'Perfect' },
      neatness: { score: 1, hint: 'Needs work' },
    })
  })

  it('handles no checkItems — empty rubricResults and null feedback', () => {
    const review: ReviewData = {
      data: { images: ['img1'] },
    }
    const result = parseImageUploadReview(review)
    expect(result.state.rubricResults).toEqual({})
    expect(result.state.feedback).toBeNull()
  })

  it('handles missing images — falls back to empty array', () => {
    const review: ReviewData = { data: {} }
    const result = parseImageUploadReview(review)
    expect(result.state.ans).toEqual({ images: [] })
  })

  it('defaults score to 0 when not provided in checkItem', () => {
    const review: ReviewData = {
      data: { images: [] },
      checkItems: [{ idx: 'r1', correct: false }],
    }
    const result = parseImageUploadReview(review)
    expect(result.state.rubricResults).toEqual({ r1: { score: 0, hint: undefined } })
  })

  it('_llm without hint sets feedback to null', () => {
    const review: ReviewData = {
      data: { images: [] },
      checkItems: [{ idx: '_llm', correct: false }],
    }
    const result = parseImageUploadReview(review)
    expect(result.state.feedback).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 10. parseRcqReview
// ---------------------------------------------------------------------------
describe('parseRcqReview', () => {
  const parts: RichContentQuizPart[] = [
    { id: 'p1', prompt: 'Question 1' },
    { id: 'p2', prompt: 'Question 2' },
  ]

  it('restores phases, outcomes, and images for completed parts', () => {
    const review: ReviewData = {
      data: {
        parts: {
          p1: {
            completed: true,
            images: ['img1'],
            attemptsHistory: [{ method: 'submit', images: ['img1'] }],
          },
          p2: {
            completed: true,
            images: [],
            attemptsHistory: [
              { method: 'submit', images: ['old'] },
              { method: 'pass' },
            ],
          },
        },
      },
    }
    const result = parseRcqReview(review, parts)
    expect(result.allDone).toBe(true)
    expect(result.state.phases).toEqual({ p1: 'done', p2: 'done' })
    expect(result.state.outcomes).toEqual({ p1: 'correct', p2: 'passed' })
    expect(result.state.images.p1).toEqual(['img1'])
    // p2: top-level images is empty, so it falls back to last history entry with images
    expect(result.state.images.p2).toEqual(['old'])
  })

  it('marks allDone=false when not all parts are completed', () => {
    const review: ReviewData = {
      data: {
        parts: {
          p1: { completed: true, attemptsHistory: [{ method: 'submit' }] },
        },
      },
    }
    const result = parseRcqReview(review, parts)
    expect(result.allDone).toBe(false)
    expect(result.state.phases).toEqual({ p1: 'done' })
    expect(result.state.outcomes).toEqual({ p1: 'correct' })
    // p2 not present
    expect(result.state.phases.p2).toBeUndefined()
  })

  it('handles empty parts array', () => {
    const review: ReviewData = { data: { parts: {} } }
    const result = parseRcqReview(review, [])
    // parts.length === 0 → parts.every(...) is vacuously true
    expect(result.allDone).toBe(false)
  })

  it('handles missing parts data', () => {
    const review: ReviewData = { data: {} }
    const result = parseRcqReview(review, parts)
    expect(result.allDone).toBe(false)
    expect(result.state.phases).toEqual({})
    expect(result.state.outcomes).toEqual({})
    expect(result.state.images).toEqual({})
    expect(result.state.solutions).toEqual({})
  })

  it('restores sampleSolution from completed parts', () => {
    const review: ReviewData = {
      data: {
        parts: {
          p1: {
            completed: true,
            sampleSolution: '9x^2 - 4',
            images: ['img1'],
            attemptsHistory: [{ method: 'submit', images: ['img1'] }],
          },
          p2: {
            completed: true,
            attemptsHistory: [{ method: 'pass' }],
            // no sampleSolution
          },
        },
      },
    }
    const result = parseRcqReview(review, parts)
    expect(result.state.solutions).toEqual({ p1: '9x^2 - 4' })
    expect(result.state.solutions.p2).toBeUndefined()
  })

  it('skips uncompleted parts in server data', () => {
    const review: ReviewData = {
      data: {
        parts: {
          p1: { completed: false, attemptsHistory: [{ method: 'submit' }] },
          p2: { completed: true, attemptsHistory: [{ method: 'submit' }] },
        },
      },
    }
    const result = parseRcqReview(review, parts)
    expect(result.allDone).toBe(false)
    expect(result.state.phases.p1).toBeUndefined()
    expect(result.state.phases.p2).toBe('done')
  })

  it('falls back to history images when top-level images is empty', () => {
    const review: ReviewData = {
      data: {
        parts: {
          p1: {
            completed: true,
            images: [],
            attemptsHistory: [
              { method: 'submit', images: ['first-try'] },
              { method: 'submit', images: ['second-try'] },
            ],
          },
        },
      },
    }
    const result = parseRcqReview(review, [{ id: 'p1' }])
    // Falls back to last history entry with images
    expect(result.state.images.p1).toEqual(['second-try'])
  })

  it('uses correct outcome when last attempt method is not pass', () => {
    const review: ReviewData = {
      data: {
        parts: {
          p1: {
            completed: true,
            attemptsHistory: [{ method: 'submit' }],
          },
        },
      },
    }
    const result = parseRcqReview(review, [{ id: 'p1' }])
    expect(result.state.outcomes.p1).toBe('correct')
  })
})

// ---------------------------------------------------------------------------
// 11. parseSeReview
// ---------------------------------------------------------------------------
describe('parseSeReview', () => {
  const sections = [
    { id: 'intro' },
    { id: 'body' },
    { id: 'conclusion' },
  ]

  it('restores all section states as graded with funcChoice and picked', () => {
    const review: ReviewData = {
      data: {
        sections: {
          intro: { function: 'Hook', picked: ['1:0', '1:2'] },
          body: { function: 'Evidence', picked: ['3:1'] },
          conclusion: { function: 'Summary', picked: [] },
        },
      },
    }
    const result = parseSeReview(review, sections)
    expect(result.allDone).toBe(true)
    const { secStates } = result.state
    expect(secStates.intro.stage).toBe('graded')
    expect(secStates.intro.funcChoice).toBe('Hook')
    expect(secStates.intro.picked).toEqual(new Set(['1:0', '1:2']))
    expect(secStates.body.funcChoice).toBe('Evidence')
    expect(secStates.body.picked).toEqual(new Set(['3:1']))
    expect(secStates.conclusion.funcChoice).toBe('Summary')
    expect(secStates.conclusion.picked).toEqual(new Set())
  })

  it('handles missing section data — funcChoice is null, picked is empty', () => {
    const review: ReviewData = { data: { sections: {} } }
    const result = parseSeReview(review, sections)
    const { secStates } = result.state
    expect(secStates.intro.funcChoice).toBeNull()
    expect(secStates.intro.picked).toEqual(new Set())
    expect(secStates.intro.stage).toBe('graded')
  })

  it('handles missing sections key in data', () => {
    const review: ReviewData = { data: {} }
    const result = parseSeReview(review, sections)
    const { secStates } = result.state
    // rd.sections is undefined → sd is undefined for all
    expect(secStates.intro.funcChoice).toBeNull()
    expect(secStates.intro.picked).toEqual(new Set())
  })

  it('funcWrong and showHint are always false in restored state', () => {
    const review: ReviewData = {
      data: {
        sections: {
          intro: { function: 'Hook', picked: ['1:0'] },
        },
      },
    }
    const result = parseSeReview(review, [{ id: 'intro' }])
    expect(result.state.secStates.intro.funcWrong).toBe(false)
    expect(result.state.secStates.intro.showHint).toBe(false)
  })

  it('handles single section', () => {
    const review: ReviewData = {
      data: {
        sections: {
          only: { function: 'Transition', picked: ['5:0', '5:1', '5:2'] },
        },
      },
    }
    const result = parseSeReview(review, [{ id: 'only' }])
    expect(result.allDone).toBe(true)
    expect(result.state.secStates.only.picked.size).toBe(3)
  })
})
