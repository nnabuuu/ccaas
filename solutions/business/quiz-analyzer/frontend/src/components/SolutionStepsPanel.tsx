/**
 * SolutionStepsPanel — Renders solution steps with numbered badges,
 * formulas, reasoning, and common errors.
 */

import type { SolutionStep, ViewMode } from '../types'

export default function SolutionStepsPanel({ steps, viewMode = 'teacher' }: { steps: SolutionStep[]; viewMode?: ViewMode }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-zinc-700">分步解题思路</h3>
      <div className="space-y-3">
        {steps.map((step) => (
          <div key={step.stepNumber} className="flex gap-3">
            {/* Step number badge */}
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">
              {step.stepNumber}
            </div>

            <div className="flex-1 space-y-2 min-w-0">
              {/* Title + description */}
              <div>
                <div className="text-sm font-medium text-zinc-800">{step.title}</div>
                <p className="text-sm text-zinc-600 mt-0.5">{step.description}</p>
              </div>

              {/* Formula */}
              {step.formula && (
                <pre className="text-xs text-zinc-700 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 overflow-x-auto whitespace-pre-wrap">
                  {step.formula}
                </pre>
              )}

              {/* Reasoning */}
              <div className="text-xs text-zinc-500 border-l-2 border-zinc-200 pl-3 italic">
                {step.reasoning}
              </div>

              {/* Common errors */}
              {step.commonErrors.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {step.commonErrors.map((err, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200 rounded-full text-[11px] text-amber-700"
                    >
                      <span className="w-1 h-1 bg-amber-400 rounded-full" />
                      {err}
                    </span>
                  ))}
                </div>
              )}

              {/* Related knowledge points (teacher view only) */}
              {viewMode === 'teacher' && step.relatedKnowledgePoints && step.relatedKnowledgePoints.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {step.relatedKnowledgePoints.map((kp, j) => (
                    <span
                      key={j}
                      className="inline-flex items-center px-2 py-0.5 bg-blue-50 border border-blue-200 rounded-full text-[11px] text-blue-600"
                    >
                      {kp}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
