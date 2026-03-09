/**
 * AnalysisStrategyPanel — Progressive disclosure for analysis strategy.
 * Always visible: chosen approach (compact) + key insight.
 * Collapsed by default: goal, goal decomposition, approach paths comparison.
 */

import { useState } from 'react'
import type { AnalysisStrategy } from '../types'
import Markdown from './Markdown'

const viabilityConfig = {
  viable: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    icon: '\u2705', // ✅
    label: '可行',
    opacity: '',
  },
  complex: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: '\u26A0\uFE0F', // ⚠️
    label: '较复杂',
    opacity: '',
  },
  dead_end: {
    bg: 'bg-zinc-50',
    border: 'border-zinc-200',
    icon: '\u274C', // ❌
    label: '死路',
    opacity: 'opacity-60',
  },
} as const

export default function AnalysisStrategyPanel({ strategy }: { strategy: AnalysisStrategy }) {
  const [detailOpen, setDetailOpen] = useState(false)

  // Extract first sentence of chosenApproach as title
  const chosenTitle = strategy.chosenApproach.split(/[。.！!？?\n]/)[0]
  const chosenHasMore = chosenTitle.length < strategy.chosenApproach.length - 1

  return (
    <div className="space-y-3">
      {/* Chosen Approach — always visible, compact */}
      <div className="bg-violet-50 border border-violet-200 rounded-lg px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-700">
          <span>📐</span>
          所选方法
        </div>
        <Markdown compact className="text-sm text-violet-900 mt-1 font-medium">{chosenTitle}</Markdown>
        {chosenHasMore && (
          <Markdown compact className="text-xs text-violet-700 mt-0.5">{strategy.chosenApproach}</Markdown>
        )}
      </div>

      {/* Key Insight — always visible */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          核心洞察
        </div>
        <Markdown compact className="text-sm text-blue-800 mt-1">{strategy.keyInsight}</Markdown>
      </div>

      {/* Collapsible detail: goal, decomposition, paths */}
      <button
        type="button"
        onClick={() => setDetailOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 transition-colors select-none"
      >
        <span className={`inline-block transition-transform ${detailOpen ? 'rotate-90' : ''}`}>▶</span>
        查看详细策略分析
        <span className="text-zinc-400">（目标拆解 · 路径对比）</span>
      </button>

      {detailOpen && (
        <div className="space-y-3 pl-3 border-l-2 border-zinc-100">
          {/* Goal */}
          <div className="flex items-start gap-2">
            <span className="text-sm">🎯</span>
            <div>
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">目标</span>
              <Markdown compact className="text-sm text-zinc-800 font-medium">{strategy.goal}</Markdown>
            </div>
          </div>

          {/* Goal Decomposition */}
          <div>
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">目标拆解</span>
            <Markdown compact className="text-sm text-zinc-600 mt-0.5">{strategy.goalDecomposition}</Markdown>
          </div>

          {/* Approach Paths */}
          <div>
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">解题路径</span>
            <div className="space-y-2 mt-1.5">
              {strategy.approaches.map((approach, i) => {
                const config = viabilityConfig[approach.viability]
                return (
                  <div
                    key={i}
                    className={`${config.bg} border ${config.border} rounded-lg px-3 py-2.5 ${config.opacity}`}
                  >
                    <div className="flex items-center gap-1.5 text-sm font-medium text-zinc-800">
                      <span>{config.icon}</span>
                      {approach.name}
                    </div>
                    <Markdown compact className="text-xs text-zinc-600 mt-1">{approach.description}</Markdown>
                    <Markdown compact className="text-xs text-zinc-400 mt-1 italic">{approach.reason}</Markdown>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
