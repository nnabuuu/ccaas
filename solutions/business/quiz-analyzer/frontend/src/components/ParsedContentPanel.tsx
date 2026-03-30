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
        <span className="px-2.5 py-0.5 bg-ck-accent/10 text-ck-accent rounded-full text-xs font-medium">
          {QUIZ_TYPE_LABELS[parsedContent.quizType] || parsedContent.quizType}
        </span>

        {difficulty != null && difficulty > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((level) => (
                <div
                  key={level}
                  className={`w-4 h-1.5 rounded-full ${
                    level <= difficulty ? DIFFICULTY_COLORS[difficulty] : 'bg-ck-b1'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-ck-t3">{DIFFICULTY_LABELS[difficulty]}</span>
          </div>
        )}

      </div>

      {/* Stem */}
      <div>
        <div className="text-[10px] font-semibold text-ck-t3 uppercase tracking-wider mb-1">题干</div>
        <Markdown className="text-sm text-ck-t1 leading-relaxed">{parsedContent.stem}</Markdown>
      </div>

      {/* Options */}
      {parsedContent.options.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold text-ck-t3 uppercase tracking-wider mb-1">选项</div>
          <div className="space-y-1">
            {parsedContent.options.map((opt, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-sm text-ck-t2 px-3 py-1.5 bg-ck-bg2 rounded-ck"
              >
                <span className="font-medium text-ck-t3 flex-shrink-0">
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
        <div className="flex items-center gap-2 bg-ck-success-bg border border-ck-b1 rounded-ck px-3 py-2">
          <CheckCircle weight="fill" className="w-4 h-4 text-ck-success-t flex-shrink-0" />
          <span className="text-xs font-semibold text-ck-success-t">正确答案</span>
          <Markdown compact className="text-sm font-semibold text-ck-success-t">{correctAnswer}</Markdown>
        </div>
      )}
    </div>
  )
}
