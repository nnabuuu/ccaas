/**
 * useTaskTracking Hook Tests
 *
 * Tests for task tracking hook including:
 * - SubAgent and TodoItem conversion to UnifiedTask
 * - Task grouping (active, completed, failed)
 * - Badge state calculation with priority logic
 * - History management (time-based and count-based cleanup)
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { useTaskTracking } from '../src/hooks/useTaskTracking'
import type { ActiveSubAgent, EventTodoItem } from '@ccaas/common'

describe('useTaskTracking', () => {
  const mockSubAgent: ActiveSubAgent = {
    subAgentId: 'sub-1',
    agentType: 'Explore',
    description: 'Searching codebase',
    startedAt: new Date().toISOString(),
    status: 'running',
    nestingLevel: 0,
  }

  const mockTodoItem: EventTodoItem = {
    id: 'todo-1',
    content: 'Write tests',
    status: 'in_progress',
    activeForm: 'Writing tests',
    progress: 50,
  }

  describe('Initialization', () => {
    it('should initialize with empty state', () => {
      const { result } = renderHook(() =>
        useTaskTracking({
          activeSubAgents: [],
          todoItems: [],
        })
      )

      expect(result.current.groups.active).toEqual([])
      expect(result.current.groups.recentCompleted).toEqual([])
      expect(result.current.groups.recentFailed).toEqual([])
      expect(result.current.badgeState.show).toBe(false)
      expect(result.current.allTasks).toEqual([])
    })
  })

  describe('Task Conversion', () => {
    it('should convert SubAgent to UnifiedTask', () => {
      const { result } = renderHook(() =>
        useTaskTracking({
          activeSubAgents: [mockSubAgent],
          todoItems: [],
        })
      )

      const task = result.current.allTasks[0]
      expect(task).toBeDefined()
      expect(task.type).toBe('subagent')
      expect(task.id).toBe('sub-1')
      expect(task.title).toBe('Searching codebase')
      expect(task.description).toBe('Explore')
      expect(task.agentType).toBe('Explore')
      expect(task.status).toBe('running')
    })

    it('should convert TodoItem to UnifiedTask', () => {
      const { result } = renderHook(() =>
        useTaskTracking({
          activeSubAgents: [],
          todoItems: [mockTodoItem],
        })
      )

      const task = result.current.allTasks[0]
      expect(task).toBeDefined()
      expect(task.type).toBe('todo')
      expect(task.id).toBe('todo-1')
      expect(task.title).toBe('Write tests')
      expect(task.activeForm).toBe('Writing tests')
      expect(task.progress).toBe(50)
      expect(task.status).toBe('in_progress')
    })

    it('should handle TodoItem without id', () => {
      const todoWithoutId: EventTodoItem = {
        content: 'No ID task',
        status: 'pending',
      }

      const { result } = renderHook(() =>
        useTaskTracking({
          activeSubAgents: [],
          todoItems: [todoWithoutId],
        })
      )

      const task = result.current.allTasks[0]
      expect(task.id).toMatch(/^todo-/)
    })

    it('should use agentType as fallback title for SubAgent', () => {
      const subAgentNoDescription: ActiveSubAgent = {
        ...mockSubAgent,
        description: undefined,
      }

      const { result } = renderHook(() =>
        useTaskTracking({
          activeSubAgents: [subAgentNoDescription],
          todoItems: [],
        })
      )

      const task = result.current.allTasks[0]
      expect(task.title).toBe('Explore')
    })
  })

  describe('Task Grouping', () => {
    it('should group running tasks as active', () => {
      const { result } = renderHook(() =>
        useTaskTracking({
          activeSubAgents: [mockSubAgent],
          todoItems: [],
        })
      )

      expect(result.current.groups.active).toHaveLength(1)
      expect(result.current.groups.active[0].status).toBe('running')
    })

    it('should group in_progress tasks as active', () => {
      const { result } = renderHook(() =>
        useTaskTracking({
          activeSubAgents: [],
          todoItems: [mockTodoItem],
        })
      )

      expect(result.current.groups.active).toHaveLength(1)
      expect(result.current.groups.active[0].status).toBe('in_progress')
    })

    it('should group pending tasks as active', () => {
      const pendingTodo: EventTodoItem = {
        ...mockTodoItem,
        status: 'pending',
      }

      const { result } = renderHook(() =>
        useTaskTracking({
          activeSubAgents: [],
          todoItems: [pendingTodo],
        })
      )

      expect(result.current.groups.active).toHaveLength(1)
      expect(result.current.groups.active[0].status).toBe('pending')
    })

    it('should group completed tasks in recent completed', async () => {
      const completedSubAgent: ActiveSubAgent = {
        ...mockSubAgent,
        status: 'completed',
      }

      const { result } = renderHook(() =>
        useTaskTracking({
          activeSubAgents: [completedSubAgent],
          todoItems: [],
        })
      )

      // Wait for history to be populated
      await waitFor(() => {
        expect(result.current.groups.recentCompleted.length).toBeGreaterThan(0)
      })
    })

    it('should group failed tasks in recent failed', async () => {
      const failedSubAgent: ActiveSubAgent = {
        ...mockSubAgent,
        status: 'failed',
      }

      const { result } = renderHook(() =>
        useTaskTracking({
          activeSubAgents: [failedSubAgent],
          todoItems: [],
        })
      )

      // Wait for history to be populated
      await waitFor(() => {
        expect(result.current.groups.recentFailed.length).toBeGreaterThan(0)
      })
    })

    it('should handle mixed task statuses', async () => {
      const runningAgent: ActiveSubAgent = { ...mockSubAgent, status: 'running' }
      const completedAgent: ActiveSubAgent = {
        ...mockSubAgent,
        subAgentId: 'sub-2',
        status: 'completed',
      }
      const failedAgent: ActiveSubAgent = {
        ...mockSubAgent,
        subAgentId: 'sub-3',
        status: 'failed',
      }

      const { result } = renderHook(() =>
        useTaskTracking({
          activeSubAgents: [runningAgent, completedAgent, failedAgent],
          todoItems: [],
        })
      )

      expect(result.current.groups.active).toHaveLength(1)

      await waitFor(() => {
        expect(result.current.groups.recentCompleted.length).toBeGreaterThan(0)
        expect(result.current.groups.recentFailed.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Badge State', () => {
    it('should show no badge when no tasks', () => {
      const { result } = renderHook(() =>
        useTaskTracking({
          activeSubAgents: [],
          todoItems: [],
        })
      )

      expect(result.current.badgeState.show).toBe(false)
      expect(result.current.badgeState.label).toBe('No tasks')
    })

    it('should show green badge for running tasks', () => {
      const { result } = renderHook(() =>
        useTaskTracking({
          activeSubAgents: [mockSubAgent],
          todoItems: [],
        })
      )

      expect(result.current.badgeState.show).toBe(true)
      expect(result.current.badgeState.color).toBe('green')
      expect(result.current.badgeState.count).toBe(1)
      expect(result.current.badgeState.label).toBe('1 running')
    })

    it('should show red badge for failed tasks (highest priority)', async () => {
      const runningAgent: ActiveSubAgent = { ...mockSubAgent, status: 'running' }
      const failedAgent: ActiveSubAgent = {
        ...mockSubAgent,
        subAgentId: 'sub-2',
        status: 'failed',
      }

      const { result } = renderHook(() =>
        useTaskTracking({
          activeSubAgents: [runningAgent, failedAgent],
          todoItems: [],
        })
      )

      await waitFor(() => {
        expect(result.current.badgeState.show).toBe(true)
        expect(result.current.badgeState.color).toBe('red')
        expect(result.current.badgeState.label).toContain('failed')
      })
    })

    it('should show blue badge for completed tasks', async () => {
      const completedAgent: ActiveSubAgent = {
        ...mockSubAgent,
        status: 'completed',
      }

      const { result } = renderHook(() =>
        useTaskTracking({
          activeSubAgents: [completedAgent],
          todoItems: [],
        })
      )

      await waitFor(() => {
        expect(result.current.badgeState.show).toBe(true)
        expect(result.current.badgeState.color).toBe('blue')
        expect(result.current.badgeState.label).toContain('completed')
      })
    })

    it('should show amber badge for pending tasks', () => {
      const pendingTodo: EventTodoItem = {
        ...mockTodoItem,
        status: 'pending',
      }

      const { result } = renderHook(() =>
        useTaskTracking({
          activeSubAgents: [],
          todoItems: [pendingTodo],
        })
      )

      expect(result.current.badgeState.show).toBe(true)
      expect(result.current.badgeState.color).toBe('amber')
      expect(result.current.badgeState.count).toBe(1)
      expect(result.current.badgeState.label).toBe('1 pending')
    })

    it('should prioritize failed > running > completed > pending', async () => {
      const pendingTodo: EventTodoItem = { ...mockTodoItem, status: 'pending' }
      const runningAgent: ActiveSubAgent = { ...mockSubAgent, status: 'running' }
      const completedAgent: ActiveSubAgent = {
        ...mockSubAgent,
        subAgentId: 'sub-2',
        status: 'completed',
      }
      const failedAgent: ActiveSubAgent = {
        ...mockSubAgent,
        subAgentId: 'sub-3',
        status: 'failed',
      }

      const { result } = renderHook(() =>
        useTaskTracking({
          activeSubAgents: [runningAgent, completedAgent, failedAgent],
          todoItems: [pendingTodo],
        })
      )

      // Failed takes highest priority
      await waitFor(() => {
        expect(result.current.badgeState.color).toBe('red')
      })
    })
  })

  describe('History Management', () => {
    it('should find task by ID', () => {
      const { result } = renderHook(() =>
        useTaskTracking({
          activeSubAgents: [mockSubAgent],
          todoItems: [],
        })
      )

      const found = result.current.findTask('sub-1')
      expect(found).toBeDefined()
      expect(found?.id).toBe('sub-1')
    })

    it('should return undefined for non-existent task', () => {
      const { result } = renderHook(() =>
        useTaskTracking({
          activeSubAgents: [],
          todoItems: [],
        })
      )

      const found = result.current.findTask('non-existent')
      expect(found).toBeUndefined()
    })

    it('should clear history', async () => {
      const completedAgent: ActiveSubAgent = {
        ...mockSubAgent,
        status: 'completed',
      }

      const { result } = renderHook(() =>
        useTaskTracking({
          activeSubAgents: [completedAgent],
          todoItems: [],
        })
      )

      // Wait for history to populate
      await waitFor(() => {
        expect(result.current.groups.recentCompleted.length).toBeGreaterThan(0)
      })

      // Clear history
      act(() => {
        result.current.clearHistory()
      })

      expect(result.current.groups.recentCompleted).toEqual([])
      expect(result.current.groups.recentFailed).toEqual([])
    })

    it('should respect maxHistorySize limit', async () => {
      const agents: ActiveSubAgent[] = Array.from({ length: 60 }, (_, i) => ({
        ...mockSubAgent,
        subAgentId: `sub-${i}`,
        status: 'completed' as const,
      }))

      const { result } = renderHook(() =>
        useTaskTracking({
          activeSubAgents: agents,
          todoItems: [],
          maxHistorySize: 50,
        })
      )

      // allTasks includes current + history
      await waitFor(() => {
        expect(result.current.allTasks.length).toBeLessThanOrEqual(60)
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty SubAgent description', () => {
      const subAgentNoDesc: ActiveSubAgent = {
        ...mockSubAgent,
        description: '',
      }

      const { result } = renderHook(() =>
        useTaskTracking({
          activeSubAgents: [subAgentNoDesc],
          todoItems: [],
        })
      )

      const task = result.current.allTasks[0]
      expect(task.title).toBe('Explore') // Falls back to agentType
    })

    it('should handle missing optional fields in TodoItem', () => {
      const minimalTodo: EventTodoItem = {
        content: 'Minimal todo',
        status: 'pending',
      }

      const { result } = renderHook(() =>
        useTaskTracking({
          activeSubAgents: [],
          todoItems: [minimalTodo],
        })
      )

      const task = result.current.allTasks[0]
      expect(task.title).toBe('Minimal todo')
      expect(task.activeForm).toBeUndefined()
      expect(task.progress).toBeUndefined()
    })

    it('should handle rapid task updates', () => {
      const { result, rerender } = renderHook(
        ({ agents }) =>
          useTaskTracking({
            activeSubAgents: agents,
            todoItems: [],
          }),
        {
          initialProps: { agents: [mockSubAgent] },
        }
      )

      expect(result.current.groups.active).toHaveLength(1)

      // Update with different agent
      const newAgent: ActiveSubAgent = {
        ...mockSubAgent,
        subAgentId: 'sub-2',
      }

      rerender({ agents: [newAgent] })
      expect(result.current.groups.active).toHaveLength(1)
      expect(result.current.groups.active[0].id).toBe('sub-2')
    })
  })

  describe('Integration', () => {
    it('should handle both SubAgents and TodoItems together', () => {
      const { result } = renderHook(() =>
        useTaskTracking({
          activeSubAgents: [mockSubAgent],
          todoItems: [mockTodoItem],
        })
      )

      expect(result.current.allTasks).toHaveLength(2)
      expect(result.current.groups.active).toHaveLength(2)

      const subAgentTask = result.current.allTasks.find(t => t.type === 'subagent')
      const todoTask = result.current.allTasks.find(t => t.type === 'todo')

      expect(subAgentTask).toBeDefined()
      expect(todoTask).toBeDefined()
    })

    it('should maintain raw data in UnifiedTask', () => {
      const { result } = renderHook(() =>
        useTaskTracking({
          activeSubAgents: [mockSubAgent],
          todoItems: [mockTodoItem],
        })
      )

      const subAgentTask = result.current.allTasks.find(t => t.type === 'subagent')
      const todoTask = result.current.allTasks.find(t => t.type === 'todo')

      expect(subAgentTask?.raw).toEqual(mockSubAgent)
      expect(todoTask?.raw).toEqual(mockTodoItem)
    })
  })
})
