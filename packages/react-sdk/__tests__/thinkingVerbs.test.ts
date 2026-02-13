import { describe, it, expect } from 'vitest'
import { getThinkingVerb, THINKING_VERBS } from '../src/utils/thinkingVerbs'

describe('thinkingVerbs', () => {
  describe('THINKING_VERBS constants', () => {
    it('should have initial phase verbs', () => {
      expect(THINKING_VERBS.initial).toEqual(['思考', '琢磨', '分析', '梳理', '构思'])
    })

    it('should have moderate phase verbs', () => {
      expect(THINKING_VERBS.moderate).toEqual(['推敲', '斟酌', '研究', '探索', '计划'])
    })

    it('should have deep phase verbs', () => {
      expect(THINKING_VERBS.deep).toEqual(['深思', '钻研', '规划', '设计', '论证'])
    })
  })

  describe('getThinkingVerb', () => {
    it('should return a verb from initial phase for < 30s', () => {
      const verb = getThinkingVerb(0)
      expect(THINKING_VERBS.initial).toContain(verb)
    })

    it('should return a verb from initial phase for durations up to 29.999s', () => {
      const verb = getThinkingVerb(29999)
      expect(THINKING_VERBS.initial).toContain(verb)
    })

    it('should return a verb from moderate phase for 30s - 89.999s', () => {
      const verb30s = getThinkingVerb(30000)
      expect(THINKING_VERBS.moderate).toContain(verb30s)

      const verb60s = getThinkingVerb(60000)
      expect(THINKING_VERBS.moderate).toContain(verb60s)

      const verb89s = getThinkingVerb(89999)
      expect(THINKING_VERBS.moderate).toContain(verb89s)
    })

    it('should return a verb from deep phase for >= 90s', () => {
      const verb90s = getThinkingVerb(90000)
      expect(THINKING_VERBS.deep).toContain(verb90s)

      const verb2m = getThinkingVerb(120000)
      expect(THINKING_VERBS.deep).toContain(verb2m)

      const verb5m = getThinkingVerb(300000)
      expect(THINKING_VERBS.deep).toContain(verb5m)
    })

    it('should always return a valid verb', () => {
      const allVerbs = [
        ...THINKING_VERBS.initial,
        ...THINKING_VERBS.moderate,
        ...THINKING_VERBS.deep,
      ]

      // Test random durations
      for (let i = 0; i < 10; i++) {
        const duration = Math.random() * 300000  // Up to 5 minutes
        const verb = getThinkingVerb(duration)
        expect(allVerbs).toContain(verb)
      }
    })

    it('should handle edge case durations', () => {
      expect(THINKING_VERBS.initial).toContain(getThinkingVerb(0))
      expect(THINKING_VERBS.moderate).toContain(getThinkingVerb(30000))
      expect(THINKING_VERBS.deep).toContain(getThinkingVerb(90000))
    })
  })
})
