/**
 * ParsedContentPanel — Renders standardized quiz content:
 * quiz type badge, difficulty bar, time estimate, stem, options, correct answer.
 * Pitfalls and KP tags are rendered at the page level.
 */

import { CheckCircle } from '@phosphor-icons/react'
import type { ParsedContent, DifficultyAssessment } from '../types'
import Markdown from './Markdown'

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
  correctAnswer,
}: {
  parsedContent: ParsedContent
  difficultyAssessment?: DifficultyAssessment | null
  correctAnswer?: string | null
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

      </div>

      {/* Stem */}
      <div>
        <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">题干</div>
        <Markdown className="text-sm text-zinc-800 leading-relaxed">{parsedContent.stem}</Markdown>
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
                <Markdown compact>{opt}</Markdown>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Correct answer */}
      {correctAnswer && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <CheckCircle weight="fill" className="w-4 h-4 text-green-600 flex-shrink-0" />
          <span className="text-xs font-semibold text-green-600">正确答案</span>
          <Markdown compact className="text-sm font-semibold text-green-900">{correctAnswer}</Markdown>
        </div>
      )}
    </div>
  )
}
