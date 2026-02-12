import React, { useRef, useEffect, useMemo } from 'react'
import type { TaskGroups } from '../types'
import { UnifiedTaskCard } from './UnifiedTaskCard'

export interface TasksListProps {
  groups: TaskGroups
  showCompleted: boolean
  highlightedTaskId?: string | null
}

/**
 * Displays tasks grouped by status (active, completed, failed).
 *
 * Features:
 * - Auto-scrolls to highlighted task
 * - Removes highlight after 3 seconds
 * - Collapsible sections
 * - Toggle to show/hide completed tasks
 */
export function TasksList({ groups, showCompleted, highlightedTaskId }: TasksListProps) {
  const highlightedRef = useRef<HTMLDivElement>(null)

  // Filter groups based on showCompleted toggle
  const visibleGroups = useMemo(() => ({
    active: groups.active,
    recentCompleted: showCompleted ? groups.recentCompleted : [],
    recentFailed: groups.recentFailed, // Always show failed tasks
  }), [groups, showCompleted])

  // Auto-scroll to highlighted task
  useEffect(() => {
    if (highlightedTaskId && highlightedRef.current) {
      highlightedRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }
  }, [highlightedTaskId])

  return (
    <div className="space-y-6">
      {/* Active tasks section */}
      {visibleGroups.active.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            运行中 ({visibleGroups.active.length})
          </h3>
          <div className="space-y-2">
            {visibleGroups.active.map(task => (
              <UnifiedTaskCard
                key={task.id}
                task={task}
                isHighlighted={task.id === highlightedTaskId}
                ref={task.id === highlightedTaskId ? highlightedRef : null}
              />
            ))}
          </div>
        </section>
      )}

      {/* Recent completed section */}
      {visibleGroups.recentCompleted.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            最近完成 ({visibleGroups.recentCompleted.length})
          </h3>
          <div className="space-y-2">
            {visibleGroups.recentCompleted.map(task => (
              <UnifiedTaskCard
                key={task.id}
                task={task}
                isHighlighted={task.id === highlightedTaskId}
                ref={task.id === highlightedTaskId ? highlightedRef : null}
              />
            ))}
          </div>
        </section>
      )}

      {/* Recent failed section */}
      {visibleGroups.recentFailed.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            最近失败 ({visibleGroups.recentFailed.length})
          </h3>
          <div className="space-y-2">
            {visibleGroups.recentFailed.map(task => (
              <UnifiedTaskCard
                key={task.id}
                task={task}
                isHighlighted={task.id === highlightedTaskId}
                ref={task.id === highlightedTaskId ? highlightedRef : null}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
