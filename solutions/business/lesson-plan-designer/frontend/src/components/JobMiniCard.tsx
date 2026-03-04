import { useState, useEffect } from 'react'
import type { JobInfo } from '@kedge-agentic/react-sdk'

const JOB_TYPE_ICONS: Record<string, string> = {
  notebooklm_slides: '\uD83D\uDCC4',
  notebooklm_audio: '\uD83C\uDFB5',
  notebooklm_video: '\uD83C\uDFAC',
  notebooklm_study_guide: '\uD83D\uDCDD',
}

const STATUS_STYLES: Record<string, { label: string; color: string; dot: string }> = {
  pending: { label: '等待中', color: 'text-amber-600', dot: 'bg-amber-500' },
  running: { label: '运行中', color: 'text-blue-600', dot: 'bg-blue-500 animate-pulse' },
  completed: { label: '已完成', color: 'text-green-600', dot: 'bg-green-500' },
  failed: { label: '失败', color: 'text-red-600', dot: 'bg-red-500' },
  cancelled: { label: '已取消', color: 'text-gray-500', dot: 'bg-gray-400' },
}

function formatElapsed(startedAt?: string): string {
  if (!startedAt) return ''
  const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

interface JobMiniCardProps {
  job: JobInfo
  onSwitchToTasks?: () => void
}

export function JobMiniCard({ job, onSwitchToTasks }: JobMiniCardProps) {
  const [, setTick] = useState(0)
  const icon = JOB_TYPE_ICONS[job.type] || '\u2699\uFE0F'
  const statusInfo = STATUS_STYLES[job.status] || STATUS_STYLES.pending
  const isActive = job.status === 'running' || job.status === 'pending'

  // Live elapsed time ticker for active jobs
  useEffect(() => {
    if (!isActive) return
    const timer = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(timer)
  }, [isActive])

  const elapsed = isActive
    ? formatElapsed(job.startedAt)
    : job.startedAt && job.completedAt
      ? formatElapsed(job.startedAt) // Show final duration
      : ''

  return (
    <button
      onClick={onSwitchToTasks}
      className="mt-2 w-full flex items-center gap-2 px-3 py-2 bg-white/80 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left cursor-pointer"
    >
      <span className="text-base">{icon}</span>
      <span className="text-sm font-medium text-gray-700 truncate flex-1">{job.name}</span>
      {elapsed && (
        <span className="text-xs text-gray-400 tabular-nums">{elapsed}</span>
      )}
      <span className={`inline-flex items-center gap-1 text-xs ${statusInfo.color}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
        {statusInfo.label}
      </span>
    </button>
  )
}
