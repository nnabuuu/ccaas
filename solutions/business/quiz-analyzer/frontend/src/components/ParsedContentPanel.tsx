/**
 * ParsedContentPanel — Renders standardized quiz content:
 * stem, options, quiz type badge, difficulty bar, time estimate, KP tags.
 */

import { Timer, Warning } from '@phosphor-icons/react'
import type { ParsedContent, KpRefinementResult, DifficultyAssessment, TimeAssessment } from '../types'

const QUIZ_TYPE_LABELS: Record<string, string> = {
  choice: '选择题',
  fill: '填空题',
  subjective: '主观题',
}

const DIFFICULTY_LABELS = ['', '简单', '较易', '中等', '较难', '困难']
const DIFFICULTY_COLORS = ['', 'bg-green-500', 'bg-lime-500', 'bg-yellow-500', 'bg-orange-500', 'bg-red-500']

export default function ParsedContentPanel({
  parsedContent,
  difficultyAssessment,
  timeAssessment,
  timeEstimate,
  kpResult,
}: {
  parsedContent: ParsedContent
  difficultyAssessment?: DifficultyAssessment | null
  timeAssessment?: TimeAssessment | null
  timeEstimate?: string | null
  kpResult?: KpRefinementResult | null
}) {
  const difficulty = difficultyAssessment?.score ?? null
  return (
    <div className="space-y-4">
      {/* Header row: quiz type + metadata */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="px-2.5 py-0.5 bg-primary-100 text-primary-700 rounded-full text-xs font-medium">
          {QUIZ_TYPE_LABELS[parsedContent.quizType] || parsedContent.quizType}
        </span>

        {difficulty != null && difficulty > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((level) => (
                <div
                  key={level}
                  className={`w-4 h-1.5 rounded-full ${
                    level <= difficulty ? DIFFICULTY_COLORS[difficulty] : 'bg-zinc-200'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-zinc-500">{DIFFICULTY_LABELS[difficulty]}</span>
          </div>
        )}

        {(timeAssessment?.estimate || timeEstimate) && (
          <span className="flex items-center gap-1 text-xs text-zinc-500">
            <Timer weight="regular" className="w-3.5 h-3.5" />
            {timeAssessment?.estimate || timeEstimate}
          </span>
        )}
      </div>

      {/* Time reasoning */}
      {timeAssessment?.reasoning && (
        <p className="text-xs text-zinc-400 italic">
          {timeAssessment.reasoning}
        </p>
      )}

      {/* Difficulty pitfalls + reasoning */}
      {difficultyAssessment && difficultyAssessment.pitfalls?.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
            <Warning weight="fill" className="w-3.5 h-3.5" />
            易错点
          </div>
          <ul className="space-y-1 pl-5 list-disc">
            {difficultyAssessment.pitfalls.map((pitfall, i) => (
              <li key={i} className="text-xs text-amber-800 leading-relaxed">{pitfall}</li>
            ))}
          </ul>
          {difficultyAssessment.reasoning && (
            <p className="text-xs text-zinc-500 pt-1 border-t border-amber-100">
              {difficultyAssessment.reasoning}
            </p>
          )}
        </div>
      )}

      {/* KP tags (compact pills) */}
      {kpResult && kpResult.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {kpResult.tags.map((tag) => (
            <span
              key={tag.id}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                tag.role === 'primary'
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : tag.role === 'secondary'
                  ? 'bg-indigo-50 text-indigo-600 border border-indigo-200'
                  : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
              }`}
            >
              {tag.name}
              <span className="text-[10px] opacity-70">{Math.round(tag.confidence * 100)}%</span>
            </span>
          ))}
        </div>
      )}

      {/* Stem */}
      <div>
        <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">题干</div>
        <p className="text-sm text-zinc-800 whitespace-pre-wrap leading-relaxed">{parsedContent.stem}</p>
      </div>

      {/* Options */}
      {parsedContent.options.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">选项</div>
          <div className="space-y-1">
            {parsedContent.options.map((opt, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-sm text-zinc-700 px-3 py-1.5 bg-zinc-50 rounded-lg"
              >
                <span className="font-medium text-zinc-400 flex-shrink-0">
                  {String.fromCharCode(65 + i)}.
                </span>
                <span>{opt}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
