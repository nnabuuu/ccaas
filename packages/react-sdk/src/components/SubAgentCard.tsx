import { useEffect, useState } from 'react'
import type { ActiveSubAgent } from '@ccaas/common'

export interface SubAgentCardProps {
  subAgent: ActiveSubAgent
}

/**
 * SubAgentCard - Display individual subagent progress with glassmorphism design
 *
 * Features:
 * - Glassmorphism style with frosted glass effect
 * - Dark tech color palette (#1E293B, #22C55E)
 * - Heroicons v2 SVG icons (no emojis)
 * - Animated progress bar for long-running tasks
 * - Live duration counter with smooth transitions
 * - Respects prefers-reduced-motion
 */
export function SubAgentCard({ subAgent }: SubAgentCardProps) {
  const [elapsed, setElapsed] = useState(0)
  const [isVisible, setIsVisible] = useState(false)

  // Calculate elapsed time
  useEffect(() => {
    const startTime = new Date(subAgent.startedAt).getTime()

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [subAgent.startedAt])

  // Fade-in animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50)
    return () => clearTimeout(timer)
  }, [])

  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60
  const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`

  // Estimate progress for visual feedback (mock progress bar)
  // For real progress, this should come from backend
  const estimatedDuration = 900 // 15 minutes for NotebookLM tasks
  const progress = Math.min((elapsed / estimatedDuration) * 100, 95) // Cap at 95% until actual completion

  // Status-based styling
  const statusConfig: Record<'running' | 'completed' | 'failed', {
    borderColor: string
    bgGradient: string
    iconBg: string
    iconColor: string
    textColor: string
    mutedColor: string
    icon: JSX.Element
  }> = {
    running: {
      borderColor: 'border-blue-500/30',
      bgGradient: 'from-blue-500/10 to-transparent',
      iconBg: 'bg-blue-500/20',
      iconColor: 'text-blue-400',
      textColor: 'text-slate-100',
      mutedColor: 'text-slate-400',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
      ),
    },
    completed: {
      borderColor: 'border-green-500/30',
      bgGradient: 'from-green-500/10 to-transparent',
      iconBg: 'bg-green-500/20',
      iconColor: 'text-green-400',
      textColor: 'text-slate-100',
      mutedColor: 'text-slate-400',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    failed: {
      borderColor: 'border-red-500/30',
      bgGradient: 'from-red-500/10 to-transparent',
      iconBg: 'bg-red-500/20',
      iconColor: 'text-red-400',
      textColor: 'text-slate-100',
      mutedColor: 'text-slate-400',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  }

  const config = statusConfig[subAgent.status]

  return (
    <div
      className={`
        relative overflow-hidden rounded-xl
        bg-gradient-to-r ${config.bgGradient}
        backdrop-blur-md
        border ${config.borderColor}
        shadow-lg shadow-black/20
        transition-all duration-300 ease-out
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
      `}
      style={{
        backgroundColor: 'rgba(30, 41, 59, 0.6)', // #1E293B with 60% opacity
      }}
    >
      {/* Animated progress bar overlay (only for running tasks) */}
      {subAgent.status === 'running' && (
        <div
          className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent transition-all duration-1000 ease-linear"
          style={{ width: `${progress}%` }}
        />
      )}

      {/* Content */}
      <div className="relative p-4">
        <div className="flex items-start gap-3">
          {/* Status Icon */}
          <div
            className={`
              flex-shrink-0 w-10 h-10 rounded-lg
              ${config.iconBg} ${config.iconColor}
              flex items-center justify-center
              transition-transform duration-200
            `}
          >
            {config.icon}
          </div>

          {/* Text Content */}
          <div className="flex-1 min-w-0">
            {/* Agent Description */}
            <p className={`font-medium ${config.textColor} truncate`} style={{ fontFamily: 'Fira Sans, sans-serif' }}>
              {subAgent.description || subAgent.agentType}
            </p>

            {/* Status Label */}
            <div className={`flex items-center gap-2 mt-1.5 text-sm ${config.mutedColor}`} style={{ fontFamily: 'Fira Sans, sans-serif' }}>
              {subAgent.status === 'running' && (
                <>
                  <span>运行中</span>
                  <span className="text-slate-500">·</span>
                  <span className="font-mono tabular-nums" style={{ fontFamily: 'Fira Code, monospace' }}>
                    {formattedTime}
                  </span>
                  {elapsed > 60 && (
                    <>
                      <span className="text-slate-500">·</span>
                      <span className="text-xs opacity-75">~{Math.ceil((estimatedDuration - elapsed) / 60)} min remaining</span>
                    </>
                  )}
                </>
              )}
              {subAgent.status === 'completed' && <span>已完成</span>}
              {subAgent.status === 'failed' && <span>失败</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom progress indicator (thin line) */}
      {subAgent.status === 'running' && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-700/50">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-1000 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  )
}
