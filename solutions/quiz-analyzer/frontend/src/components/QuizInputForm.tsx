/**
 * Quiz Input Form Component
 *
 * Features:
 * - Quiz content input (required)
 * - Correct answer input (required)
 * - Student answer input (optional)
 * - Form validation
 */

import { useState, useCallback } from 'react'
import { DocumentTextIcon, CheckCircleIcon, UserIcon } from '@heroicons/react/24/outline'

export interface QuizInputData {
  content: string
  correctAnswer: string
  studentAnswer?: string
}

interface QuizInputFormProps {
  onSubmit: (data: QuizInputData) => void
  disabled?: boolean
}

export default function QuizInputForm({ onSubmit, disabled = false }: QuizInputFormProps) {
  const [content, setContent] = useState('')
  const [correctAnswer, setCorrectAnswer] = useState('')
  const [studentAnswer, setStudentAnswer] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Validate form
  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {}

    if (!content.trim()) {
      newErrors.content = '请输入题目内容'
    }

    if (!correctAnswer.trim()) {
      newErrors.correctAnswer = '请输入参考答案'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [content, correctAnswer])

  // Handle submit
  const handleSubmit = useCallback(() => {
    if (!validate()) {
      return
    }

    onSubmit({
      content: content.trim(),
      correctAnswer: correctAnswer.trim(),
      studentAnswer: studentAnswer.trim() || undefined,
    })
  }, [content, correctAnswer, studentAnswer, validate, onSubmit])

  // Handle Enter key in textarea (Ctrl+Enter to submit)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
        <DocumentTextIcon className="w-5 h-5" />
        输入题目
      </h2>

      {/* Quiz Content */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          题目内容 <span className="text-red-500">*</span>
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="请输入题目内容（包括题干和选项）&#10;&#10;示例：&#10;已知函数 f(x) = x² - 2x + 1，求 f(x) 的最小值。&#10;A. -1&#10;B. 0&#10;C. 1&#10;D. 2"
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[200px] resize-y font-mono text-sm ${
            errors.content ? 'border-red-300' : 'border-slate-300'
          }`}
          disabled={disabled}
        />
        {errors.content && <p className="mt-1 text-sm text-red-600">{errors.content}</p>}
      </div>

      {/* Correct Answer */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
          <CheckCircleIcon className="w-4 h-4" />
          参考答案 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={correctAnswer}
          onChange={(e) => setCorrectAnswer(e.target.value)}
          placeholder="例如：B 或 2x+3 或 详细文字答案"
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.correctAnswer ? 'border-red-300' : 'border-slate-300'
          }`}
          disabled={disabled}
        />
        {errors.correctAnswer && (
          <p className="mt-1 text-sm text-red-600">{errors.correctAnswer}</p>
        )}
      </div>

      {/* Student Answer (Optional) */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
          <UserIcon className="w-4 h-4" />
          学生答案 <span className="text-slate-400 text-xs">(可选)</span>
        </label>
        <input
          type="text"
          value={studentAnswer}
          onChange={(e) => setStudentAnswer(e.target.value)}
          placeholder="留空则只分析题目本身"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={disabled}
        />
        <p className="mt-1 text-xs text-slate-500">
          提供学生答案后，AI 将分析错误原因和知识盲点
        </p>
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={disabled || !content.trim() || !correctAnswer.trim()}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {disabled ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            分析中...
          </>
        ) : (
          '开始分析'
        )}
      </button>

      {/* Keyboard shortcut hint */}
      <p className="text-xs text-slate-400 text-center">
        提示：Ctrl+Enter 快速提交
      </p>
    </div>
  )
}
