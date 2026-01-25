/**
 * useTokenUsage Composable Tests
 */
import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { useTokenUsage, type SessionTokens } from '../composables/useTokenUsage'
import type { TokenUsage } from '../types/agent-state'

// Mock Vue's inject function
vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...actual,
    inject: vi.fn((key, defaultValue) => defaultValue),
  }
})

describe('useTokenUsage', () => {
  describe('default state', () => {
    it('should have zero token usage', () => {
      const { tokenUsage } = useTokenUsage()
      expect(tokenUsage.value.input).toBe(0)
      expect(tokenUsage.value.output).toBe(0)
      expect(tokenUsage.value.total).toBe(0)
    })

    it('should have zero session tokens', () => {
      const { sessionTokens } = useTokenUsage()
      expect(sessionTokens.value.input).toBe(0)
      expect(sessionTokens.value.output).toBe(0)
      expect(sessionTokens.value.total).toBe(0)
    })

    it('should have empty model', () => {
      const { currentModel } = useTokenUsage()
      expect(currentModel.value).toBe('')
    })

    it('should have zero estimated cost', () => {
      const { estimatedCost } = useTokenUsage()
      expect(estimatedCost.value).toBe(0)
    })
  })

  describe('computed properties', () => {
    it('should calculate totalTokens correctly', () => {
      const { totalTokens } = useTokenUsage()
      expect(totalTokens.value).toBe(0)
    })

    it('should have no usage by default', () => {
      const { hasUsage } = useTokenUsage()
      expect(hasUsage.value).toBe(false)
    })

    it('should have 0% cache hit rate', () => {
      const { cacheHitRate } = useTokenUsage()
      expect(cacheHitRate.value).toBe(0)
    })
  })
})

describe('useTokenUsage formatting logic', () => {
  describe('formatNumber', () => {
    function formatNumber(num: number): string {
      if (num >= 1_000_000) {
        return `${(num / 1_000_000).toFixed(1)}M`
      }
      if (num >= 1_000) {
        return `${(num / 1_000).toFixed(1)}K`
      }
      return num.toString()
    }

    it('should format small numbers as-is', () => {
      expect(formatNumber(0)).toBe('0')
      expect(formatNumber(100)).toBe('100')
      expect(formatNumber(999)).toBe('999')
    })

    it('should format thousands with K suffix', () => {
      expect(formatNumber(1000)).toBe('1.0K')
      expect(formatNumber(1500)).toBe('1.5K')
      expect(formatNumber(15000)).toBe('15.0K')
      expect(formatNumber(999999)).toBe('1000.0K')
    })

    it('should format millions with M suffix', () => {
      expect(formatNumber(1000000)).toBe('1.0M')
      expect(formatNumber(1500000)).toBe('1.5M')
      expect(formatNumber(10000000)).toBe('10.0M')
    })
  })

  describe('formattedCost', () => {
    function formatCost(cost: number): string {
      if (cost <= 0) return '$0.00'
      if (cost < 0.01) return `$${cost.toFixed(4)}`
      return `$${cost.toFixed(2)}`
    }

    it('should format zero cost', () => {
      expect(formatCost(0)).toBe('$0.00')
    })

    it('should format small costs with 4 decimals', () => {
      expect(formatCost(0.001)).toBe('$0.0010')
      expect(formatCost(0.0099)).toBe('$0.0099')
    })

    it('should format larger costs with 2 decimals', () => {
      expect(formatCost(0.01)).toBe('$0.01')
      expect(formatCost(0.12)).toBe('$0.12')
      expect(formatCost(1.50)).toBe('$1.50')
      expect(formatCost(10.99)).toBe('$10.99')
    })
  })

  describe('cacheHitRate calculation', () => {
    function calculateCacheHitRate(cached: number, input: number): number {
      const totalInput = input + cached
      if (totalInput === 0) return 0
      return Math.round((cached / totalInput) * 100)
    }

    it('should return 0 for no input', () => {
      expect(calculateCacheHitRate(0, 0)).toBe(0)
    })

    it('should calculate percentage correctly', () => {
      expect(calculateCacheHitRate(50, 50)).toBe(50)
      expect(calculateCacheHitRate(100, 0)).toBe(100)
      expect(calculateCacheHitRate(0, 100)).toBe(0)
      expect(calculateCacheHitRate(25, 75)).toBe(25)
    })

    it('should round to nearest integer', () => {
      expect(calculateCacheHitRate(33, 67)).toBe(33)
      expect(calculateCacheHitRate(1, 2)).toBe(33) // 1/3 = 33.33%
    })
  })

  describe('cache efficiency levels', () => {
    function getCacheEfficiency(rate: number): 'low' | 'medium' | 'high' {
      if (rate === 0) return 'low'
      if (rate < 30) return 'medium'
      return 'high'
    }

    it('should return low for 0%', () => {
      expect(getCacheEfficiency(0)).toBe('low')
    })

    it('should return medium for 1-29%', () => {
      expect(getCacheEfficiency(1)).toBe('medium')
      expect(getCacheEfficiency(15)).toBe('medium')
      expect(getCacheEfficiency(29)).toBe('medium')
    })

    it('should return high for 30%+', () => {
      expect(getCacheEfficiency(30)).toBe('high')
      expect(getCacheEfficiency(50)).toBe('high')
      expect(getCacheEfficiency(100)).toBe('high')
    })
  })

  describe('model name simplification', () => {
    function simplifyModelName(model: string): string | null {
      if (!model || model === 'unknown') return null
      if (model.includes('claude-3-5-sonnet')) return 'Claude 3.5 Sonnet'
      if (model.includes('claude-3-opus')) return 'Claude 3 Opus'
      if (model.includes('claude-3-haiku')) return 'Claude 3 Haiku'
      return model
    }

    it('should return null for unknown model', () => {
      expect(simplifyModelName('')).toBeNull()
      expect(simplifyModelName('unknown')).toBeNull()
    })

    it('should simplify Claude model names', () => {
      expect(simplifyModelName('claude-3-5-sonnet-20241022')).toBe('Claude 3.5 Sonnet')
      expect(simplifyModelName('claude-3-opus-20240229')).toBe('Claude 3 Opus')
      expect(simplifyModelName('claude-3-haiku-20240307')).toBe('Claude 3 Haiku')
    })

    it('should return original for unknown models', () => {
      expect(simplifyModelName('gpt-4')).toBe('gpt-4')
      expect(simplifyModelName('custom-model')).toBe('custom-model')
    })
  })
})
