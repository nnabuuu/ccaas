/**
 * Standardized Quiz Display Component
 *
 * Displays:
 * 1. Parsed quiz structure (stem, options, answer)
 * 2. Associated metadata (knowledge points, catalog, difficulty)
 */

import { useState, useEffect } from 'react'
import {
  DocumentCheckIcon,
  TagIcon,
  FolderIcon,
  ChartBarIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'
import LoadingSpinner from './LoadingSpinner'

export interface ParsedQuiz {
  stem: string
  options: string[]
  correctAnswer: string
  quizType: 'choice' | 'fill' | 'subjective'
}

export interface QuizMetadata {
  knowledgePoints: Array<{ id: string; name: string; confidence?: number }>
  catalog: { subjectId: string; path: string[] }
  difficulty: number
}

export interface StandardizedQuizData {
  parsed: ParsedQuiz | null
  metadata: QuizMetadata | null
}

interface StandardizedQuizDisplayProps {
  data: StandardizedQuizData
  isLoading?: boolean
  hideCorrectAnswer?: boolean
}

export default function StandardizedQuizDisplay({
  data,
  isLoading = false,
  hideCorrectAnswer = false,
}: StandardizedQuizDisplayProps) {
  const [showMetadata, setShowMetadata] = useState(true)

  // Auto-show metadata when it's available
  useEffect(() => {
    if (data.metadata) {
      setShowMetadata(true)
    }
  }, [data.metadata])

  // Loading state
  if (isLoading) {
    return <LoadingSpinner message="解析中..." size="md" />
  }

  // Empty state
  if (!data.parsed && !data.metadata) {
    return (
      <div className="text-center py-12 text-slate-400">
        <SparklesIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p className="text-lg">等待分析...</p>
        <p className="text-sm mt-2">提交题目后，AI 将自动解析并展示结构化内容</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
        <DocumentCheckIcon className="w-5 h-5" />
        标准化题目
      </h2>

      {/* Parsed Quiz Content */}
      {data.parsed && (
        <section className="space-y-4">
          {/* Quiz Stem */}
          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-2">题干</h3>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <p className="text-slate-900 whitespace-pre-wrap">{data.parsed.stem}</p>
            </div>
          </div>

          {/* Options (if choice quiz) */}
          {data.parsed.options.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-2">选项</h3>
              <ul className="space-y-2">
                {data.parsed.options.map((option, index) => (
                  <li
                    key={index}
                    className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900"
                  >
                    {option}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Correct Answer (hidden in student mode) */}
          {!hideCorrectAnswer && (
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-2">正确答案</h3>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-green-900 font-medium">{data.parsed.correctAnswer}</p>
              </div>
            </div>
          )}

          {/* Quiz Type */}
          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-2">题型</h3>
            <div className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
              {data.parsed.quizType === 'choice' && '选择题'}
              {data.parsed.quizType === 'fill' && '填空题'}
              {data.parsed.quizType === 'subjective' && '主观题'}
            </div>
          </div>
        </section>
      )}

      {/* Metadata Section */}
      {data.metadata && (
        <section className="space-y-4 pt-6 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <TagIcon className="w-4 h-4" />
              关联元数据
            </h3>
            <button
              onClick={() => setShowMetadata(!showMetadata)}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              {showMetadata ? '收起' : '展开'}
            </button>
          </div>

          {showMetadata && (
            <div className="space-y-4">
              {/* Knowledge Points */}
              {data.metadata.knowledgePoints.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-slate-600 mb-2 flex items-center gap-1">
                    <TagIcon className="w-3 h-3" />
                    相关知识点
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {data.metadata.knowledgePoints.map((kp) => (
                      <span
                        key={kp.id}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 rounded-md text-xs"
                        title={`置信度: ${((kp.confidence || 0) * 100).toFixed(0)}%`}
                      >
                        {kp.name}
                        {kp.confidence && kp.confidence > 0.8 && (
                          <span className="text-purple-600">★</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Catalog Path */}
              {data.metadata.catalog && data.metadata.catalog.path.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-slate-600 mb-2 flex items-center gap-1">
                    <FolderIcon className="w-3 h-3" />
                    所属目录
                  </h4>
                  <div className="flex items-center gap-1 text-xs text-slate-700">
                    {data.metadata.catalog.path.map((segment, index) => (
                      <span key={index} className="flex items-center gap-1">
                        {index > 0 && <span className="text-slate-400">›</span>}
                        <span className="bg-slate-100 px-2 py-1 rounded">{segment}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Difficulty */}
              {data.metadata && data.metadata.difficulty > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-slate-600 mb-2 flex items-center gap-1">
                    <ChartBarIcon className="w-3 h-3" />
                    难度等级
                  </h4>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className={`w-8 h-8 rounded flex items-center justify-center text-xs font-medium ${
                            level <= (data.metadata?.difficulty || 0)
                              ? 'bg-orange-500 text-white'
                              : 'bg-slate-200 text-slate-400'
                          }`}
                        >
                          {level}
                        </div>
                      ))}
                    </div>
                    <span className="text-sm text-slate-600">
                      {data.metadata?.difficulty || 0}/5
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
