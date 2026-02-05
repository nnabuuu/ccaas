import { useEffect, useState } from 'react'
import type { ActiveSubAgent } from '@ccaas/common'

export interface SubAgentCardProps {
  subAgent: ActiveSubAgent
}

/**
 * SubAgentCard - Display individual subagent progress with duration timer
 *
 * Shows status-based styling, agent type icons, and live duration counter.
 * Used in AgentActivityLine's expanded details section.
 */
export function SubAgentCard({ subAgent }: SubAgentCardProps) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const startTime = new Date(subAgent.startedAt).getTime()

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [subAgent.startedAt])

  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60

  const statusColors = {
    running: 'border-blue-500 bg-blue-50',
    completed: 'border-green-500 bg-green-50',
    failed: 'border-red-500 bg-red-50',
  }

  const statusIcons = {
    running: '🔄',
    completed: '✅',
    failed: '❌',
  }

  return (
    <div className={`border-l-4 rounded-lg p-3 ${statusColors[subAgent.status]}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">{statusIcons[subAgent.status]}</span>
            <span className="font-medium text-gray-900">
              {subAgent.description || subAgent.agentType}
            </span>
          </div>
          <div className="text-sm text-gray-600 mt-1">
            {subAgent.status === 'running' && `运行中 · ${minutes}:${seconds.toString().padStart(2, '0')}`}
            {subAgent.status === 'completed' && '已完成'}
            {subAgent.status === 'failed' && '失败'}
          </div>
        </div>
      </div>
    </div>
  )
}
