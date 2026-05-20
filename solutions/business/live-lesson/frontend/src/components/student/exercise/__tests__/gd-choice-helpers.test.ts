import { describe, it, expect } from 'vitest'
import { evaluateChoice, applyChoiceSelection } from '../gd-choice-helpers'

describe('evaluateChoice', () => {
  it('correct answer → "correct"', () => {
    expect(evaluateChoice(0, 0)).toBe('correct')
  })

  it('wrong answer → "wrong"', () => {
    expect(evaluateChoice(0, 1)).toBe('wrong')
  })

  it('undefined correct → null', () => {
    expect(evaluateChoice(undefined, 0)).toBe(null)
  })
})

describe('applyChoiceSelection', () => {
  it('single choice correct → allCorrect=true', () => {
    const choices = [{ id: 'c1', correct: 0 }]
    const { updated, allCorrect } = applyChoiceSelection({}, choices, 'c1', 0)
    expect(updated.c1).toBe('correct')
    expect(allCorrect).toBe(true)
  })

  it('one wrong in multi → allCorrect=false', () => {
    const choices = [{ id: 'c1', correct: 0 }, { id: 'c2', correct: 1 }]
    const { updated, allCorrect } = applyChoiceSelection({}, choices, 'c1', 1)
    expect(updated.c1).toBe('wrong')
    expect(allCorrect).toBe(false)
  })

  it('progressive: both correct → allCorrect=true', () => {
    const choices = [{ id: 'c1', correct: 0 }, { id: 'c2', correct: 1 }]
    const first = applyChoiceSelection({}, choices, 'c1', 0)
    expect(first.allCorrect).toBe(false)
    const second = applyChoiceSelection(first.updated, choices, 'c2', 1)
    expect(second.allCorrect).toBe(true)
  })

  it('re-select after wrong → new status replaces old', () => {
    const choices = [{ id: 'c1', correct: 0 }]
    const wrong = applyChoiceSelection({}, choices, 'c1', 1)
    expect(wrong.updated.c1).toBe('wrong')
    const corrected = applyChoiceSelection(wrong.updated, choices, 'c1', 0)
    expect(corrected.updated.c1).toBe('correct')
    expect(corrected.allCorrect).toBe(true)
  })

  it('no correct field on any choice → never allCorrect', () => {
    const choices = [{ id: 'c1' }, { id: 'c2' }]
    const { updated, allCorrect } = applyChoiceSelection({}, choices, 'c1', 0)
    expect(allCorrect).toBe(false)
    // statuses unchanged — no evaluation possible
    expect(updated).toEqual({})
  })
})
