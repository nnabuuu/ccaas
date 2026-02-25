/**
 * QuizInput - Quiz content input component
 *
 * Features:
 * - Textarea for quiz content (required)
 * - Optional answer input
 * - Analyze button with Ctrl+Enter shortcut
 * - Clear button
 * - Example quiz button for quick testing
 */

import { useState, useRef, KeyboardEvent } from 'react'
import { FileText, X, Flask } from '@phosphor-icons/react'

const EXAMPLE_QUIZ = `已知函数 f(x) = x² - 2x + 3，求：
1. 函数的顶点坐标
2. 函数的最小值
3. 当 f(x) = 7 时，x 的值`

const EXAMPLE_ANSWER = `1. 顶点坐标：(1, 2)
2. 最小值：2
3. x = -1 或 x = 3`

interface QuizInputProps {
  onAnalyze: (content: string, answer?: string) => void
  disabled?: boolean
}

export default function QuizInput({ onAnalyze, disabled = false }: QuizInputProps) {
  const [content, setContent] = useState('')
  const [answer, setAnswer] = useState('')
  const contentRef = useRef<HTMLTextAreaElement>(null)

  const handleAnalyze = () => {
    if (!content.trim()) {
      alert('请输入题目内容')
      contentRef.current?.focus()
      return
    }

    onAnalyze(content.trim(), answer.trim() || undefined)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault()
      handleAnalyze()
    }
  }

  const handleClear = () => {
    setContent('')
    setAnswer('')
    contentRef.current?.focus()
  }

  const handleLoadExample = () => {
    setContent(EXAMPLE_QUIZ)
    setAnswer(EXAMPLE_ANSWER)
    contentRef.current?.focus()
  }

  return (
    <div className="space-y-4">
      {/* Quiz Content */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          <FileText weight="regular" className="w-4 h-4 inline mr-1" />
          题目内容 <span className="text-red-500">*</span>
        </label>
        <textarea
          ref={contentRef}
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="粘贴或输入题目内容..."
          className="w-full px-4 py-3 border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={12}
          disabled={disabled}
        />
        <p className="mt-1 text-xs text-slate-500">
          提示：支持 <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-300 rounded text-xs">Ctrl</kbd> +{' '}
          <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-300 rounded text-xs">Enter</kbd> 快速分析
        </p>
      </div>

      {/* Optional Answer */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          参考答案 <span className="text-slate-400 text-xs">(可选)</span>
        </label>
        <textarea
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="如果有参考答案，可以在此输入..."
          className="w-full px-4 py-3 border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={4}
          disabled={disabled}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleAnalyze}
          disabled={disabled || !content.trim()}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
        >
          分析题目
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 bg-blue-700 bg-opacity-50 rounded text-xs">
            Ctrl+Enter
          </kbd>
        </button>

        <button
          onClick={handleClear}
          disabled={disabled || (!content && !answer)}
          className="px-4 py-3 border border-slate-300 hover:bg-slate-50 disabled:bg-slate-100 disabled:cursor-not-allowed rounded-lg transition-colors duration-200"
          title="清空输入"
        >
          <X weight="regular" className="w-5 h-5 text-slate-600" />
        </button>

        <button
          onClick={handleLoadExample}
          disabled={disabled}
          className="px-4 py-3 border border-slate-300 hover:bg-slate-50 disabled:bg-slate-100 disabled:cursor-not-allowed rounded-lg transition-colors duration-200"
          title="加载示例题目"
        >
          <Flask weight="regular" className="w-5 h-5 text-slate-600" />
        </button>
      </div>
    </div>
  )
}
