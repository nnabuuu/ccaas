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
    bg: 'bg-ck-success-bg',
    border: 'border-ck-b1',
    icon: '\u2705', // ✅
    label: '可行',
    opacity: '',
  },
  complex: {
    bg: 'bg-ck-warn-bg',
    border: 'border-ck-b1',
    icon: '\u26A0\uFE0F', // ⚠️
    label: '较复杂',
    opacity: '',
  },
  dead_end: {
    bg: 'bg-ck-bg2',
    border: 'border-ck-b1',
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
      <div className="bg-ck-info-bg border border-ck-b1 rounded-ck px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-ck-info-t">
          <span>📐</span>
          所选方法
        </div>
        <Markdown compact className="text-sm text-ck-info-t mt-1 font-medium">{chosenTitle}</Markdown>
        {chosenHasMore && (
          <Markdown compact className="text-xs text-ck-info-t mt-0.5">{strategy.chosenApproach}</Markdown>
        )}
      </div>

      {/* Key Insight — always visible */}
      <div className="bg-ck-info-bg border border-ck-b1 rounded-ck px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-ck-info-t">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          核心洞察
        </div>
        <Markdown compact className="text-sm text-ck-info-t mt-1">{strategy.keyInsight}</Markdown>
      </div>

      {/* Collapsible detail: goal, decomposition, paths */}
      <button
        type="button"
        onClick={() => setDetailOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs text-ck-t3 hover:text-ck-t2 transition-colors duration-200 ease-claude select-none"
      >
        <span className={`inline-block transition-transform ${detailOpen ? 'rotate-90' : ''}`}>▶</span>
        查看详细策略分析
        <span className="text-ck-t3">（目标拆解 · 路径对比）</span>
      </button>

      {detailOpen && (
        <div className="space-y-3 pl-3 border-l-2 border-ck-b2">
          {/* Goal */}
          <div className="flex items-start gap-2">
            <span className="text-sm">🎯</span>
            <div>
              <span className="text-xs font-semibold text-ck-t3 uppercase tracking-wide">目标</span>
              <Markdown compact className="text-sm text-ck-t1 font-medium">{strategy.goal}</Markdown>
            </div>
          </div>

          {/* Goal Decomposition */}
          <div>
            <span className="text-xs font-semibold text-ck-t3 uppercase tracking-wide">目标拆解</span>
            <Markdown compact className="text-sm text-ck-t2 mt-0.5">{strategy.goalDecomposition}</Markdown>
          </div>

          {/* Approach Paths */}
          <div>
            <span className="text-xs font-semibold text-ck-t3 uppercase tracking-wide">解题路径</span>
            <div className="space-y-2 mt-1.5">
              {strategy.approaches.map((approach, i) => {
                const config = viabilityConfig[approach.viability]
                return (
                  <div
                    key={i}
                    className={`${config.bg} border ${config.border} rounded-ck px-3 py-2.5 ${config.opacity}`}
                  >
                    <div className="flex items-center gap-1.5 text-sm font-medium text-ck-t1">
                      <span>{config.icon}</span>
                      {approach.name}
                    </div>
                    <Markdown compact className="text-xs text-ck-t2 mt-1">{approach.description}</Markdown>
                    <Markdown compact className="text-xs text-ck-t3 mt-1 italic">{approach.reason}</Markdown>
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
