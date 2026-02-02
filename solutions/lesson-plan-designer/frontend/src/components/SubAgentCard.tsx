import { useState, useEffect } from 'react'

interface SubAgentCardProps {
  subAgentId: string
  agentType: string
  description?: string
  startedAt: string
  status: 'running' | 'completed' | 'failed'
}

export function SubAgentCard({ agentType, description, startedAt }: SubAgentCardProps) {
  const [durationMs, setDurationMs] = useState(0)

  useEffect(() => {
    const startTime = new Date(startedAt).getTime()
    const interval = setInterval(() => {
      setDurationMs(Date.now() - startTime)
    }, 1000)

    return () => clearInterval(interval)
  }, [startedAt])

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }

  const getAgentIcon = (type: string) => {
    switch (type) {
      case 'Explore':
        return '🔍'
      case 'Task':
        return '⚙️'
      case 'NotebookLM':
        return '🎵'
      default:
        return '🤖'
    }
  }

  return (
    <div className="flex items-center justify-between py-2 px-3 border-b border-gray-200 last:border-b-0">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-lg">{getAgentIcon(agentType)}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900">{agentType} Agent</div>
          {description && (
            <div className="text-xs text-gray-500 truncate">{description}</div>
          )}
        </div>
      </div>
      <div className="text-sm text-gray-600 font-mono whitespace-nowrap ml-4">
        {formatDuration(durationMs)}
      </div>
    </div>
  )
}
