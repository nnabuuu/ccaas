/**
 * Integration tests: CachedSubmission → ReviewData construction → parse → state verification.
 *
 * These tests simulate the full review-restore path by building ReviewData payloads
 * that mirror what the backend returns, running them through the corresponding parse
 * function, and verifying the resulting component state.
 */
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

function buildReviewPayload(sub: { data: Record<string, unknown>; checkItems?: any[] }): ReviewData {
  return { data: sub.data, checkItems: sub.checkItems }
}

// ---------------------------------------------------------------------------
// Quiz with partial score
// ---------------------------------------------------------------------------
describe('integration: quiz with partial score', () => {
  it('correctly reconstructs mixed correct/wrong state from cached submission', () => {
    const review = buildReviewPayload({
      data: { answers: [2, 0, 1, 3] },
      checkItems: [
        { idx: 0, correct: true },
        { idx: 1, correct: false, hint: 'Review paragraph 3' },
        { idx: 2, correct: true },
        { idx: 3, correct: false, walkthrough: 'Step-by-step...' },
      ],
    })

    const { state, allDone } = parseQuizReview(review, 4)
    expect(allDone).toBe(true)

    // Answers are restored by position
    expect(state.ans[0]).toBe(2)
    expect(state.ans[3]).toBe(3)

    // Correct/wrong sets reflect partial score
    expect(state.correctQs.size).toBe(2)
    expect(state.wrongQs.size).toBe(2)
    expect(state.correctQs.has(0)).toBe(true)
    expect(state.correctQs.has(2)).toBe(true)
    expect(state.wrongQs.has(1)).toBe(true)
    expect(state.wrongQs.has(3)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Match with all correct (no checkItems)
// ---------------------------------------------------------------------------
describe('integration: match with all correct', () => {
  it('assumes all correct when server returns no checkItems', () => {
    const review = buildReviewPayload({
      data: { pairs: [1, 0, 2] },
      // No checkItems → backend determined all correct, didn't send item-level results
    })

    const { state, allDone } = parseMatchReview(review, 3)
    expect(allDone).toBe(true)

    expect(state.ans).toEqual({ 0: 1, 1: 0, 2: 2 })
    expect(state.correctQs).toEqual(new Set([0, 1, 2]))
    expect(state.wrongQs.size).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Matrix with row results from checkItems
// ---------------------------------------------------------------------------
describe('integration: matrix with row results', () => {
  it('rebuilds row-level feedback from server check items', () => {
    const review = buildReviewPayload({
      data: {
        rows: {
          0: { what: 'They hunt', why: 'Survival instinct' },
          1: { what: 'They dance', why: 'Courtship ritual' },
          2: { what: 'They nest', why: 'Reproduction' },
        },
      },
      checkItems: [
        { idx: 0, correct: true },
        { idx: 1, correct: false, hint: 'Check the paragraph again' },
        { idx: 2, correct: true },
      ],
    })

    const { state, allDone } = parseMatrixReview(review)
    expect(allDone).toBe(true)

    expect(state.ans[0]).toEqual({ what: 'They hunt', why: 'Survival instinct' })
    expect(state.ans[1]).toEqual({ what: 'They dance', why: 'Courtship ritual' })
    expect(state.rowResults[0]).toBe(true)
    expect(state.rowResults[1]).toBe(false)
    expect(state.rowResults[2]).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Order with order array
// ---------------------------------------------------------------------------
describe('integration: order restoration', () => {
  it('restores the ordered sequence from cached data', () => {
    const review = buildReviewPayload({
      data: { order: [3, 1, 0, 2] },
    })

    const { state, allDone } = parseOrderReview(review)
    expect(allDone).toBe(true)
    expect(state.ans.order).toEqual([3, 1, 0, 2])
    expect((state.ans.order as unknown[]).length).toBe(4)
  })
})

// ---------------------------------------------------------------------------
// Stance with position=0 (falsy but valid)
// ---------------------------------------------------------------------------
describe('integration: stance with position=0', () => {
  it('correctly restores numeric position 0 without treating it as falsy', () => {
    const review = buildReviewPayload({
      data: { position: 0, evidence: [1, 3] },
    })

    const { state, allDone } = parseStanceReview(review)
    expect(allDone).toBe(true)

    // position=0 is a valid stance choice (first option)
    expect(state.ans.stance).toBe(0)
    expect(state.ans.evidence).toEqual([1, 3])
    expect(state.softDone).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Map with _llm feedback + per-item results
// ---------------------------------------------------------------------------
describe('integration: map with LLM feedback and item results', () => {
  it('separates _llm feedback from per-item grading results', () => {
    const review = buildReviewPayload({
      data: {
        placements: {
          theme: { x: 0.7, y: 0.3 },
          tone: { x: -0.5, y: 0.8 },
          structure: { x: 0.1, y: -0.6 },
        },
        reasons: {
          theme: 'The theme is optimistic',
          tone: 'The tone is formal',
          structure: 'Linear structure',
        },
      },
      checkItems: [
        { idx: '_llm', correct: false, hint: 'Good analysis overall, but reconsider the tone placement.' },
        { idx: 'theme', correct: true, hint: 'Accurate placement.' },
        { idx: 'tone', correct: false, hint: 'Should be more towards formal.' },
        { idx: 'structure', correct: true },
      ],
    })

    const { state, allDone } = parseMapReview(review)
    expect(allDone).toBe(true)

    // LLM feedback extracted from _llm item
    expect(state.feedback).toBe('Good analysis overall, but reconsider the tone placement.')

    // Per-item results — _llm excluded
    expect(Object.keys(state.itemResults)).toEqual(['theme', 'tone', 'structure'])
    expect(state.itemResults.theme).toEqual({ correct: true, hint: 'Accurate placement.' })
    expect(state.itemResults.tone).toEqual({ correct: false, hint: 'Should be more towards formal.' })
    expect(state.itemResults.structure).toEqual({ correct: true, hint: undefined })

    // Placements and reasons preserved
    expect((state.ans as any).placements.tone).toEqual({ x: -0.5, y: 0.8 })
    expect((state.ans as any).reasons.structure).toBe('Linear structure')
  })
})

// ---------------------------------------------------------------------------
// Image upload with rubric scores + _llm feedback
// ---------------------------------------------------------------------------
describe('integration: image-upload with rubric scores', () => {
  it('builds rubricResults with scores and separates _llm feedback', () => {
    const review = buildReviewPayload({
      data: { images: ['data:image/png;base64,AAAA', 'data:image/png;base64,BBBB'] },
      checkItems: [
        { idx: '_llm', correct: false, hint: 'Overall: the solution approach is correct but notation could be improved.' },
        { idx: 'correctness', correct: true, score: 3, hint: 'All steps correct' },
        { idx: 'notation', correct: false, score: 1, hint: 'Use standard mathematical notation' },
        { idx: 'completeness', correct: true, score: 2, hint: 'Missing one edge case' },
      ],
    })

    const { state, allDone } = parseImageUploadReview(review)
    expect(allDone).toBe(true)

    expect(state.ans.images).toEqual(['data:image/png;base64,AAAA', 'data:image/png;base64,BBBB'])
    expect(state.feedback).toBe('Overall: the solution approach is correct but notation could be improved.')

    expect(state.rubricResults.correctness).toEqual({ score: 3, hint: 'All steps correct' })
    expect(state.rubricResults.notation).toEqual({ score: 1, hint: 'Use standard mathematical notation' })
    expect(state.rubricResults.completeness).toEqual({ score: 2, hint: 'Missing one edge case' })
  })
})

// ---------------------------------------------------------------------------
// Fill-blank with blank results from checkItems
// ---------------------------------------------------------------------------
describe('integration: fill-blank with blank results', () => {
  it('maps string-keyed checkItems to blankResults and restores typed answers', () => {
    const review = buildReviewPayload({
      data: {
        blanks: {
          eq1_0: '2x',
          eq1_1: '3',
          eq2_0: 'x^2',
        },
      },
      checkItems: [
        { idx: 'eq1_0', correct: true },
        { idx: 'eq1_1', correct: false, hint: 'Check the coefficient' },
        { idx: 'eq2_0', correct: true },
      ],
    })

    const { state, allDone } = parseFillBlankReview(review)
    expect(allDone).toBe(true)

    expect(state.ans.eq1_0).toBe('2x')
    expect(state.ans.eq1_1).toBe('3')
    expect(state.blankResults.eq1_0).toBe(true)
    expect(state.blankResults.eq1_1).toBe(false)
    expect(state.blankResults.eq2_0).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Guided discovery with step results
// ---------------------------------------------------------------------------
describe('integration: guided-discovery with step results', () => {
  it('restores nested step answers and per-step correctness', () => {
    const review = buildReviewPayload({
      data: {
        steps: {
          observe: { answers: { pattern1: 0, pattern2: 1 } },
          formula: { answers: { blank_a: 'a+b', blank_b: 'a-b' } },
          derive: { answers: { line1_blank: 'a^2 - b^2' } },
        },
      },
      checkItems: [
        { idx: 'observe', correct: true },
        { idx: 'formula', correct: true },
        { idx: 'derive', correct: false, hint: 'Check the factored form' },
      ],
    })

    const { state, allDone } = parseGdReview(review)
    expect(allDone).toBe(true)

    // Full data preserved as ans
    expect(state.ans.steps.observe.answers.pattern1).toBe(0)
    expect(state.ans.steps.formula.answers.blank_a).toBe('a+b')

    // Step results
    expect(state.stepResults.observe).toBe(true)
    expect(state.stepResults.formula).toBe(true)
    expect(state.stepResults.derive).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// RCQ multi-part with mixed outcomes (correct + passed)
// ---------------------------------------------------------------------------
describe('integration: RCQ multi-part with mixed outcomes', () => {
  const parts: RichContentQuizPart[] = [
    { id: 'q1', prompt: 'Solve for x' },
    { id: 'q2', prompt: 'Simplify the expression' },
    { id: 'q3', prompt: 'Factor completely' },
  ]

  it('distinguishes correct vs passed outcomes and recovers images from history', () => {
    const review = buildReviewPayload({
      data: {
        parts: {
          q1: {
            completed: true,
            images: ['q1-final.png'],
            attemptsHistory: [
              { method: 'submit', images: ['q1-first.png'] },
              { method: 'submit', images: ['q1-final.png'] },
            ],
          },
          q2: {
            completed: true,
            images: [],
            attemptsHistory: [
              { method: 'submit', images: ['q2-attempt.png'] },
              { method: 'pass' },
            ],
          },
          q3: {
            completed: true,
            images: ['q3-img.png'],
            attemptsHistory: [
              { method: 'submit', images: ['q3-img.png'] },
            ],
          },
        },
      },
    })

    const { state, allDone } = parseRcqReview(review, parts)
    expect(allDone).toBe(true)

    // All parts done
    expect(state.phases).toEqual({ q1: 'done', q2: 'done', q3: 'done' })

    // q1: last attempt method is 'submit' → correct
    expect(state.outcomes.q1).toBe('correct')
    // q2: last attempt method is 'pass' → passed
    expect(state.outcomes.q2).toBe('passed')
    // q3: last attempt method is 'submit' → correct
    expect(state.outcomes.q3).toBe('correct')

    // q1: top-level images present → use them
    expect(state.images.q1).toEqual(['q1-final.png'])
    // q2: top-level images empty → fall back to last history entry with images (q2-attempt.png)
    expect(state.images.q2).toEqual(['q2-attempt.png'])
    // q3: top-level images present → use them
    expect(state.images.q3).toEqual(['q3-img.png'])

    // No sampleSolution stored → solutions map is empty
    expect(state.solutions).toEqual({})
  })

  it('restores sampleSolution from persisted part progress', () => {
    const review = buildReviewPayload({
      data: {
        parts: {
          q1: {
            completed: true,
            sampleSolution: '(a+b)(a-b) = a^2 - b^2',
            images: ['q1.png'],
            attemptsHistory: [{ method: 'submit', images: ['q1.png'] }],
          },
          q2: {
            completed: true,
            images: [],
            attemptsHistory: [{ method: 'pass' }],
            // no sampleSolution for passed part
          },
          q3: {
            completed: true,
            sampleSolution: 'x^2 - 9 = (x+3)(x-3)',
            images: ['q3.png'],
            attemptsHistory: [{ method: 'submit', images: ['q3.png'] }],
          },
        },
      },
    })

    const { state, allDone } = parseRcqReview(review, parts)
    expect(allDone).toBe(true)
    expect(state.solutions).toEqual({
      q1: '(a+b)(a-b) = a^2 - b^2',
      q3: 'x^2 - 9 = (x+3)(x-3)',
    })
    // q2 has no sampleSolution
    expect(state.solutions.q2).toBeUndefined()
  })

  it('handles partially completed set — allDone is false', () => {
    const review = buildReviewPayload({
      data: {
        parts: {
          q1: {
            completed: true,
            images: [],
            attemptsHistory: [{ method: 'submit', images: ['x.png'] }],
          },
          q2: {
            completed: false,
            images: [],
            attemptsHistory: [],
          },
          // q3 not present at all
        },
      },
    })

    const { state, allDone } = parseRcqReview(review, parts)
    expect(allDone).toBe(false)
    expect(state.phases.q1).toBe('done')
    expect(state.phases.q2).toBeUndefined()
    expect(state.phases.q3).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Select-evidence with graded sections
// ---------------------------------------------------------------------------
describe('integration: select-evidence with graded sections', () => {
  const sections = [
    { id: 'intro' },
    { id: 'development' },
    { id: 'conclusion' },
  ]

  it('restores all sections as graded with function choices and picked tokens', () => {
    const review = buildReviewPayload({
      data: {
        sections: {
          intro: { function: 'Hook', picked: ['1:0', '1:3', '2:1'] },
          development: { function: 'Evidence', picked: ['5:0', '5:2', '6:1', '7:0'] },
          conclusion: { function: 'Summary', picked: ['10:0'] },
        },
      },
    })

    const { state, allDone } = parseSeReview(review, sections)
    expect(allDone).toBe(true)

    // All sections are in 'graded' stage
    expect(state.secStates.intro.stage).toBe('graded')
    expect(state.secStates.development.stage).toBe('graded')
    expect(state.secStates.conclusion.stage).toBe('graded')

    // Function choices preserved
    expect(state.secStates.intro.funcChoice).toBe('Hook')
    expect(state.secStates.development.funcChoice).toBe('Evidence')
    expect(state.secStates.conclusion.funcChoice).toBe('Summary')

    // Picked sets are Set<string>
    expect(state.secStates.intro.picked).toBeInstanceOf(Set)
    expect(state.secStates.intro.picked.size).toBe(3)
    expect(state.secStates.intro.picked.has('1:0')).toBe(true)
    expect(state.secStates.intro.picked.has('1:3')).toBe(true)
    expect(state.secStates.intro.picked.has('2:1')).toBe(true)

    expect(state.secStates.development.picked.size).toBe(4)
    expect(state.secStates.conclusion.picked.size).toBe(1)

    // UI-related fields are reset
    expect(state.secStates.intro.funcWrong).toBe(false)
    expect(state.secStates.intro.showHint).toBe(false)
  })

  it('handles section present in spec but absent from submission', () => {
    const review = buildReviewPayload({
      data: {
        sections: {
          intro: { function: 'Hook', picked: ['1:0'] },
          // development and conclusion not in submission
        },
      },
    })

    const { state, allDone } = parseSeReview(review, sections)
    expect(allDone).toBe(true) // allDone is always true for SE review

    // Sections without data get null/empty defaults
    expect(state.secStates.development.funcChoice).toBeNull()
    expect(state.secStates.development.picked.size).toBe(0)
    expect(state.secStates.conclusion.funcChoice).toBeNull()
  })
})
