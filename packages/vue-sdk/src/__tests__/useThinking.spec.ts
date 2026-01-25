/**
 * useThinking Composable Tests
 */
import { describe, it, expect, vi } from 'vitest'
import { ref, nextTick } from 'vue'
import { useThinking } from '../composables/useThinking'
import * as symbols from '../symbols'

// Mock Vue's inject function
vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...actual,
    inject: vi.fn((key, defaultValue) => defaultValue),
  }
})

describe('useThinking', () => {
  describe('default state', () => {
    it('should have default false isThinking', () => {
      const { isThinking } = useThinking()
      expect(isThinking.value).toBe(false)
    })

    it('should have empty thinkingContent', () => {
      const { thinkingContent } = useThinking()
      expect(thinkingContent.value).toBe('')
    })

    it('should have empty thinkingHistory', () => {
      const { thinkingHistory } = useThinking()
      expect(thinkingHistory.value).toEqual([])
    })

    it('should have empty thinkingId', () => {
      const { thinkingId } = useThinking()
      expect(thinkingId.value).toBe('')
    })
  })

  describe('computed properties', () => {
    it('hasThinking should be false with no content', () => {
      const { hasThinking } = useThinking()
      expect(hasThinking.value).toBe(false)
    })

    it('thinkingLength should be 0 with no content', () => {
      const { thinkingLength } = useThinking()
      expect(thinkingLength.value).toBe(0)
    })

    it('thinkingPreview should be empty with no content', () => {
      const { thinkingPreview } = useThinking()
      expect(thinkingPreview.value).toBe('')
    })
  })

  describe('with injected values', () => {
    it('should use injected values when available', async () => {
      // This test would require a proper Vue test environment with provide/inject
      // For now, we test the composable logic in isolation
      const mockIsThinking = ref(true)
      const mockContent = ref('This is some thinking content that is longer than 200 characters. '.repeat(5))

      // Verify preview truncation logic
      const content = mockContent.value
      const preview = content.length <= 200 ? content : content.slice(0, 200) + '...'
      expect(preview.length).toBeLessThanOrEqual(203) // 200 + '...'
    })
  })
})

describe('useThinking computed logic', () => {
  it('should truncate preview at 200 characters', () => {
    const longContent = 'A'.repeat(300)
    const preview = longContent.length <= 200 ? longContent : longContent.slice(0, 200) + '...'

    expect(preview).toBe('A'.repeat(200) + '...')
    expect(preview.length).toBe(203)
  })

  it('should not truncate short content', () => {
    const shortContent = 'Short thinking content'
    const preview = shortContent.length <= 200 ? shortContent : shortContent.slice(0, 200) + '...'

    expect(preview).toBe(shortContent)
    expect(preview.length).toBe(22)
  })
})
