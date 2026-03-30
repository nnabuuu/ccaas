/**
 * SolutionStepsPanel — Renders solution steps with numbered badges,
 * formulas, and related knowledge points.
 *
 * When analysisStrategy is provided, renders keyInsight card and
 * collapsible approach paths above the steps list (merged view).
 */

import { useState } from 'react'
import type { SolutionStep, JXGConstruction, AnalysisStrategy } from '../types'
import { GeometryFigure } from './GeometryFigure'
import Markdown from './Markdown'

const viabilityConfig = {
  viable: {
    bg: 'bg-ck-success-bg',
    border: 'border-ck-b1',
    icon: '\u2705',
    label: '可行',
    opacity: '',
  },
  complex: {
    bg: 'bg-ck-warn-bg',
    border: 'border-ck-b1',
    icon: '\u26A0\uFE0F',
    label: '较复杂',
    opacity: '',
  },
  dead_end: {
    bg: 'bg-ck-bg2',
    border: 'border-ck-b1',
    icon: '\u274C',
    label: '死路',
    opacity: 'opacity-60',
  },
} as const

export default function SolutionStepsPanel({
  steps,
  baseGeometryFigure,
  analysisStrategy,
}: {
  steps: SolutionStep[]
  baseGeometryFigure?: JXGConstruction
  analysisStrategy?: AnalysisStrategy
}) {
  const [pathsOpen, setPathsOpen] = useState(false)

  return (
    <div className="space-y-3">
      {/* Strategy section — merged from AnalysisStrategyPanel */}
      {analysisStrategy && (
        <>
          {/* Key Insight card — always visible */}
          <div className="bg-ck-info-bg border border-ck-b1 rounded-ck px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-ck-info-t">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              核心洞察
            </div>
            <Markdown compact className="text-sm text-ck-info-t mt-1">{analysisStrategy.keyInsight}</Markdown>
          </div>

          {/* Collapsible approach paths comparison */}
          {analysisStrategy.approaches.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setPathsOpen(o => !o)}
                className="flex items-center gap-1.5 text-xs text-ck-t3 hover:text-ck-t2 transition-colors duration-200 ease-claude select-none"
              >
                <span className={`inline-block transition-transform ${pathsOpen ? 'rotate-90' : ''}`}>▶</span>
                查看路径对比
                <span className="text-ck-t3">（{analysisStrategy.approaches.length} 条路径）</span>
              </button>

              {pathsOpen && (
                <div className="space-y-2 pl-3 border-l-2 border-ck-b2">
                  {analysisStrategy.approaches.map((approach, i) => {
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
              )}
            </>
          )}
        </>
      )}

      {/* Steps list */}
      <div className="space-y-3">
        {steps.map((step) => (
          <div key={step.stepNumber} className="flex gap-3">
            {/* Step number badge */}
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-ck-accent/10 text-ck-accent flex items-center justify-center text-xs font-bold">
              {step.stepNumber}
            </div>

            <div className="flex-1 space-y-2 min-w-0">
              {/* Title + description — always visible */}
              <div>
                <div className="text-sm font-medium text-ck-t1">{step.title}</div>
                <Markdown compact className="text-sm text-ck-t2 mt-0.5">{step.description}</Markdown>
              </div>

              {/* Formula — always visible */}
              {step.formula && (
                <Markdown compact className="text-xs text-ck-t2">{step.formula}</Markdown>
              )}

              {/* Inline geometry figure for this step */}
              {step.addElements?.length && baseGeometryFigure && (
                <GeometryFigure
                  spec={{
                    ...baseGeometryFigure,
                    elements: [...baseGeometryFigure.elements, ...step.addElements],
                    animation: undefined,
                  }}
                  size={280}
                />
              )}

            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
