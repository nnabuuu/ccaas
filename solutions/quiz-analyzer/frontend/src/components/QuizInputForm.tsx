/**
 * Quiz Input Form Component
 *
 * Features:
 * - Quiz content input (required)
 * - Teacher mode: correct answer input (required)
 * - Student mode: student answer input (required, "我的解答")
 * - Form validation
 */

import { useState, useCallback } from 'react'
import { DocumentTextIcon, CheckCircleIcon, UserIcon } from '@heroicons/react/24/outline'

export interface QuizInputData {
  content: string
  correctAnswer?: string
  studentAnswer?: string
}

interface QuizInputFormProps {
  onSubmit: (data: QuizInputData) => void
  disabled?: boolean
  viewMode?: 'teacher' | 'student'
}

export default function QuizInputForm({
  onSubmit,
  disabled = false,
  viewMode = 'teacher',
}: QuizInputFormProps) {
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

    if (viewMode === 'teacher' && !correctAnswer.trim()) {
      newErrors.correctAnswer = '请输入参考答案'
    }

    if (viewMode === 'student' && !studentAnswer.trim()) {
      newErrors.studentAnswer = '请输入你的解答'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [content, correctAnswer, studentAnswer, viewMode])

  // Handle submit
  const handleSubmit = useCallback(() => {
    if (!validate()) {
      return
    }

    onSubmit({
      content: content.trim(),
      correctAnswer: viewMode === 'teacher' ? correctAnswer.trim() : undefined,
      studentAnswer: viewMode === 'student' ? studentAnswer.trim() : undefined,
    })
  }, [content, correctAnswer, studentAnswer, viewMode, validate, onSubmit])

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

  const isSubmitDisabled =
    disabled ||
    !content.trim() ||
    (viewMode === 'teacher' && !correctAnswer.trim()) ||
    (viewMode === 'student' && !studentAnswer.trim())

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
        <DocumentTextIcon className="w-5 h-5" />
        {viewMode === 'student' ? '提交解答' : '输入题目'}
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

      {/* Teacher mode: Correct Answer (required) */}
      {viewMode === 'teacher' && (
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
      )}

      {/* Student mode: Student Answer (required) */}
      {viewMode === 'student' && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
            <UserIcon className="w-4 h-4" />
            我的解答 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={studentAnswer}
            onChange={(e) => setStudentAnswer(e.target.value)}
            placeholder="请输入你的解答过程或答案..."
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 min-h-[100px] resize-y text-sm ${
              errors.studentAnswer ? 'border-red-300' : 'border-slate-300'
            }`}
            disabled={disabled}
          />
          {errors.studentAnswer && (
            <p className="mt-1 text-sm text-red-600">{errors.studentAnswer}</p>
          )}
          <p className="mt-1 text-xs text-slate-500">
            AI 会检查你的解答，指出错误并给出引导提示
          </p>
        </div>
      )}

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={isSubmitDisabled}
        className={`w-full text-white py-3 rounded-lg font-medium disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 ${
          viewMode === 'student'
            ? 'bg-green-600 hover:bg-green-700 disabled:bg-slate-300'
            : 'bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300'
        }`}
      >
        {disabled ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            {viewMode === 'student' ? '检查中...' : '分析中...'}
          </>
        ) : viewMode === 'student' ? (
          '提交解答'
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
