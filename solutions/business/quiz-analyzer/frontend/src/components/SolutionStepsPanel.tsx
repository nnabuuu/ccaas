/**
 * SolutionStepsPanel — Renders solution steps with numbered badges,
 * formulas, and related knowledge points.
 */

import type { SolutionStep, ViewMode } from '../types'

export default function SolutionStepsPanel({ steps, viewMode = 'prep' }: { steps: SolutionStep[]; viewMode?: ViewMode }) {
  return (
    <div className="space-y-3">
      <div className="space-y-3">
        {steps.map((step) => (
          <div key={step.stepNumber} className="flex gap-3">
            {/* Step number badge */}
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">
              {step.stepNumber}
            </div>

            <div className="flex-1 space-y-2 min-w-0">
              {/* Title + description — always visible */}
              <div>
                <div className="text-sm font-medium text-zinc-800">{step.title}</div>
                <p className="text-sm text-zinc-600 mt-0.5">{step.description}</p>
              </div>

              {/* Formula — always visible */}
              {step.formula && (
                <pre className="text-xs text-zinc-700 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 overflow-x-auto whitespace-pre-wrap">
                  {step.formula}
                </pre>
              )}

              {/* Related knowledge points — always visible (small, non-intrusive) */}
              {viewMode === 'prep' && step.relatedKnowledgePoints && step.relatedKnowledgePoints.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
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
