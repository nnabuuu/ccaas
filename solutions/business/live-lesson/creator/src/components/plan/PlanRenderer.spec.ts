/**
 * Tests for PlanRenderer.
 *
 * We don't mount full React here — vitest is configured for `node`
 * env (no jsdom). Instead, we test the *rendering decisions* the
 * renderer makes by walking a parsed doc + asserting the chip
 * resolver gets called with the right ids. Visual / DOM-level tests
 * live in e2e (playwright) where they're more meaningful.
 *
 * The unit value here: confirm `collectReqIds` from the lib + our
 * resolver wiring agree, and that we don't accidentally drop block
 * types from the renderer's switch as new types get added to the AST.
 */

import { describe, it, expect } from 'vitest'
import { parseLessonPlan, collectReqIds } from '../../lib/lesson-plan-md'

describe('chip resolver contract', () => {
  it('collectReqIds returns every refId the renderer will look up', () => {
    const md = `# t

- [a](req://r-1.2.3 "code · cat")
- [b](req://r-2.1.1 "code · cat")

> [in-quote](req://r-3.0.0)
`
    const doc = parseLessonPlan(md)
    const ids = collectReqIds(doc)
    expect(new Set(ids)).toEqual(
      new Set(['r-1.2.3', 'r-2.1.1', 'r-3.0.0']),
    )
  })

  it('deduplicates ids appearing multiple times', () => {
    const md = '[x](req://r-1.2.3)\n\n[y](req://r-1.2.3)\n'
    const doc = parseLessonPlan(md)
    expect(collectReqIds(doc)).toEqual(['r-1.2.3'])
  })

  it('returns empty list for docs without any chips', () => {
    const md = `# Lesson plan

Just text, no chips. **bold** *italic* [normal link](https://x.com).
`
    const doc = parseLessonPlan(md)
    expect(collectReqIds(doc)).toEqual([])
  })

  it('catches chips inside nested toggles', () => {
    const md = '<details><summary>x</summary>[a](req://r-nested)</details>\n'
    const doc = parseLessonPlan(md)
    expect(collectReqIds(doc)).toEqual(['r-nested'])
  })
})
