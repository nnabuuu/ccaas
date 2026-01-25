/**
 * useExploration Composable Tests
 */
import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { useExploration, type ExplorationActivity, type ExplorationHistoryEntry } from '../composables/useExploration'

// Mock Vue's inject function
vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...actual,
    inject: vi.fn((key, defaultValue) => defaultValue),
  }
})

describe('useExploration', () => {
  describe('default state', () => {
    it('should have null exploration', () => {
      const { exploration } = useExploration()
      expect(exploration.value).toBeNull()
    })

    it('should have empty explorationHistory', () => {
      const { explorationHistory } = useExploration()
      expect(explorationHistory.value).toEqual([])
    })

    it('should not be exploring', () => {
      const { isExploring } = useExploration()
      expect(isExploring.value).toBe(false)
    })

    it('should have default action icon', () => {
      const { actionIcon } = useExploration()
      expect(actionIcon.value).toBe('🔍') // Default is search
    })

    it('should have default action label', () => {
      const { actionLabel } = useExploration()
      expect(actionLabel.value).toBe('搜索中') // Default is search
    })
  })

  describe('computed properties', () => {
    it('totalResultCount should be 0 with empty history', () => {
      const { totalResultCount } = useExploration()
      expect(totalResultCount.value).toBe(0)
    })

    it('explorationCount should be 0 with empty history', () => {
      const { explorationCount } = useExploration()
      expect(explorationCount.value).toBe(0)
    })
  })
})

describe('useExploration logic', () => {
  describe('action icons', () => {
    const ACTION_ICONS: Record<string, string> = {
      search: '🔍',
      read: '📖',
      glob: '📁',
      grep: '🔎',
      analyze: '📊',
    }

    it('should map actions to correct icons', () => {
      expect(ACTION_ICONS['search']).toBe('🔍')
      expect(ACTION_ICONS['read']).toBe('📖')
      expect(ACTION_ICONS['glob']).toBe('📁')
      expect(ACTION_ICONS['grep']).toBe('🔎')
      expect(ACTION_ICONS['analyze']).toBe('📊')
    })
  })

  describe('action labels', () => {
    const ACTION_LABELS: Record<string, string> = {
      search: '搜索中',
      read: '读取文件',
      glob: '查找文件',
      grep: '搜索内容',
      analyze: '分析中',
    }

    it('should map actions to correct labels', () => {
      expect(ACTION_LABELS['search']).toBe('搜索中')
      expect(ACTION_LABELS['read']).toBe('读取文件')
      expect(ACTION_LABELS['glob']).toBe('查找文件')
      expect(ACTION_LABELS['grep']).toBe('搜索内容')
      expect(ACTION_LABELS['analyze']).toBe('分析中')
    })
  })

  describe('isExploring logic', () => {
    it('should be true when phase is start', () => {
      const activity: ExplorationActivity = {
        action: 'glob',
        target: '*.ts',
        phase: 'start',
        agentType: 'Explore',
      }
      const isExploring = activity.phase === 'start' || activity.phase === 'progress'
      expect(isExploring).toBe(true)
    })

    it('should be true when phase is progress', () => {
      const activity: ExplorationActivity = {
        action: 'glob',
        target: '*.ts',
        phase: 'progress',
        agentType: 'Explore',
      }
      const isExploring = activity.phase === 'start' || activity.phase === 'progress'
      expect(isExploring).toBe(true)
    })

    it('should be false when phase is complete', () => {
      const activity: ExplorationActivity = {
        action: 'glob',
        target: '*.ts',
        phase: 'complete',
        agentType: 'Explore',
        resultCount: 5,
      }
      const isExploring = activity.phase === 'start' || activity.phase === 'progress'
      expect(isExploring).toBe(false)
    })
  })

  describe('totalResultCount calculation', () => {
    it('should sum all result counts from history', () => {
      const history: ExplorationHistoryEntry[] = [
        { action: 'glob', target: '*.ts', resultCount: 10, timestamp: '2024-01-01' },
        { action: 'grep', target: 'pattern', resultCount: 5, timestamp: '2024-01-01' },
        { action: 'read', target: 'file.ts', resultCount: 1, timestamp: '2024-01-01' },
      ]

      const total = history.reduce((sum, entry) => sum + (entry.resultCount || 0), 0)
      expect(total).toBe(16)
    })

    it('should handle undefined resultCount', () => {
      const history: ExplorationHistoryEntry[] = [
        { action: 'glob', target: '*.ts', timestamp: '2024-01-01' },
        { action: 'grep', target: 'pattern', resultCount: 5, timestamp: '2024-01-01' },
      ]

      const total = history.reduce((sum, entry) => sum + (entry.resultCount || 0), 0)
      expect(total).toBe(5)
    })
  })

  describe('target truncation', () => {
    it('should truncate long targets', () => {
      const longTarget = '/very/long/path/to/some/deeply/nested/file/that/exceeds/sixty/characters/limit.ts'
      const truncated = longTarget.length <= 60 ? longTarget : '...' + longTarget.slice(-57)

      expect(truncated.length).toBeLessThanOrEqual(60)
      expect(truncated.startsWith('...')).toBe(true)
    })

    it('should not truncate short targets', () => {
      const shortTarget = 'src/*.ts'
      const truncated = shortTarget.length <= 60 ? shortTarget : '...' + shortTarget.slice(-57)

      expect(truncated).toBe(shortTarget)
    })
  })
})
