import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import type { QuizAnswerKey, QuizAnswer } from '../../../types'

interface ChoiceEditorProps {
  answerKey: QuizAnswerKey
  onChange: (answerKey: QuizAnswerKey) => void
}

const inputCls =
  'w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500'
const labelCls = 'text-xs font-medium text-gray-500 mb-1'

function QuestionCard({
  answer,
  index,
  onChange,
  onRemove,
}: {
  answer: QuizAnswer
  index: number
  onChange: (a: QuizAnswer) => void
  onRemove: () => void
}) {
  const [hintOpen, setHintOpen] = useState(false)
  const [walkthroughOpen, setWalkthroughOpen] = useState(false)

  const updateOption = (optIdx: number, value: string) => {
    const options = [...answer.options]
    options[optIdx] = value
    onChange({ ...answer, options })
  }

  const addOption = () => {
    onChange({ ...answer, options: [...answer.options, ''] })
  }

  const removeOption = (optIdx: number) => {
    const options = answer.options.filter((_, i) => i !== optIdx)
    const correct = answer.correct >= options.length ? 0 : answer.correct
    onChange({ ...answer, options, correct })
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-500">
          Question {index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="text-gray-400 hover:text-red-500 p-1"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="mb-3">
        <label className={labelCls}>Question Text</label>
        <textarea
          className={inputCls}
          rows={2}
          value={answer.questionText}
          onChange={(e) =>
            onChange({ ...answer, questionText: e.target.value })
          }
        />
      </div>

      <div className="mb-3">
        <label className={labelCls}>Options</label>
        <div className="space-y-2">
          {answer.options.map((opt, optIdx) => (
            <div key={optIdx} className="flex items-center gap-2">
              <input
                type="radio"
                name={`correct-${answer.questionIdx}`}
                checked={answer.correct === optIdx}
                onChange={() => onChange({ ...answer, correct: optIdx })}
                className="shrink-0"
              />
              <input
                type="text"
                className={inputCls}
                value={opt}
                onChange={(e) => updateOption(optIdx, e.target.value)}
                placeholder={`Option ${optIdx + 1}`}
              />
              {answer.options.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeOption(optIdx)}
                  className="text-gray-400 hover:text-red-500 p-1 shrink-0"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addOption}
          className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
        >
          <Plus size={12} /> Add Option
        </button>
      </div>

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setHintOpen(!hintOpen)}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
        >
          {hintOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Hint
        </button>
        {hintOpen && (
          <textarea
            className={inputCls}
            rows={2}
            value={answer.hint ?? ''}
            onChange={(e) => onChange({ ...answer, hint: e.target.value })}
            placeholder="Hint for students..."
          />
        )}

        <button
          type="button"
          onClick={() => setWalkthroughOpen(!walkthroughOpen)}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
        >
          {walkthroughOpen ? (
            <ChevronDown size={12} />
          ) : (
            <ChevronRight size={12} />
          )}
          Walkthrough
        </button>
        {walkthroughOpen && (
          <textarea
            className={inputCls}
            rows={2}
            value={answer.walkthrough ?? ''}
            onChange={(e) =>
              onChange({ ...answer, walkthrough: e.target.value })
            }
            placeholder="Solution walkthrough..."
          />
        )}
      </div>
    </div>
  )
}

export default function ChoiceEditor({
  answerKey,
  onChange,
}: ChoiceEditorProps) {
  const updateQuestion = (idx: number, updated: QuizAnswer) => {
    const answers = [...answerKey.answers]
    answers[idx] = updated
    onChange({ ...answerKey, answers })
  }

  const removeQuestion = (idx: number) => {
    const answers = answerKey.answers
      .filter((_, i) => i !== idx)
      .map((a, i) => ({ ...a, questionIdx: i }))
    onChange({ ...answerKey, answers })
  }

  const addQuestion = () => {
    const newQ: QuizAnswer = {
      questionIdx: answerKey.answers.length,
      questionText: '',
      options: ['', ''],
      correct: 0,
    }
    onChange({ ...answerKey, answers: [...answerKey.answers, newQ] })
  }

  return (
    <div className="space-y-3">
      {answerKey.answers.map((answer, idx) => (
        <QuestionCard
          key={answer.questionIdx}
          answer={answer}
          index={idx}
          onChange={(a) => updateQuestion(idx, a)}
          onRemove={() => removeQuestion(idx)}
        />
      ))}
      <button
        type="button"
        onClick={addQuestion}
        className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-400 hover:border-gray-300 hover:text-gray-500"
      >
        <Plus size={14} /> Add Question
      </button>
    </div>
  )
}
