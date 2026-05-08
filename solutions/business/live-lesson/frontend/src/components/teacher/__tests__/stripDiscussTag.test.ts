import { describe, it, expect } from 'vitest'
import { stripDiscussTag } from '../teacher-helpers'

describe('stripDiscussTag', () => {
  it('strips [discuss:socratic:r1]', () => {
    expect(stripDiscussTag('[discuss:socratic:r1] hello')).toBe('hello')
  })

  it('strips [discuss:socratic:r12] with multi-digit round', () => {
    expect(stripDiscussTag('[discuss:socratic:r12] world')).toBe('world')
  })

  it('strips tag with extra whitespace after bracket', () => {
    expect(stripDiscussTag('[discuss:socratic:r3]   spaced')).toBe('spaced')
  })

  it('returns plain text unchanged', () => {
    expect(stripDiscussTag('no tag here')).toBe('no tag here')
  })

  it('returns empty string unchanged', () => {
    expect(stripDiscussTag('')).toBe('')
  })

  it('does not strip mid-string tags', () => {
    expect(stripDiscussTag('before [discuss:socratic:r1] after'))
      .toBe('before [discuss:socratic:r1] after')
  })

  it('does not strip non-socratic tags', () => {
    // Only the socratic:rN pattern should be stripped
    expect(stripDiscussTag('[discuss:other] text')).toBe('[discuss:other] text')
  })
})
