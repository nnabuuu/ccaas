/**
 * Standardized Quiz Display Component
 *
 * Displays:
 * 1. Parsed quiz structure (stem, options, answer)
 * 2. Associated metadata (knowledge points, catalog, difficulty)
 */

import { useState, useEffect } from 'react'
import {
  FileText,
  Tag,
  Folder,
  ChartBar,
  Sparkle,
} from '@phosphor-icons/react'
import { SkeletonCard } from './SkeletonLoader'

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
    return (
      <div className="space-y-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  // Empty state
  if (!data.parsed && !data.metadata) {
    return (
      <div className="text-center py-12 text-ck-t3">
        <Sparkle weight="regular" className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p className="text-lg">等待分析...</p>
        <p className="text-sm mt-2">提交题目后，AI 将自动解析并展示结构化内容</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-ck-t1 mb-4 flex items-center gap-2">
        <FileText weight="regular" className="w-5 h-5" />
        标准化题目
      </h2>

      {/* Parsed Quiz Content */}
      {data.parsed && (
        <section className="space-y-4">
          {/* Quiz Stem */}
          <div>
            <h3 className="text-sm font-medium text-ck-t2 mb-2">题干</h3>
            <div className="bg-ck-bg2 border border-ck-b1 rounded-ck p-4">
              <p className="text-ck-t1 whitespace-pre-wrap">{data.parsed.stem}</p>
            </div>
          </div>

          {/* Options (if choice quiz) */}
          {data.parsed.options.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-ck-t2 mb-2">选项</h3>
              <ul className="space-y-2">
                {data.parsed.options.map((option, index) => (
                  <li
                    key={index}
                    className="bg-ck-bg2 border border-ck-b1 rounded-ck p-3 text-ck-t1"
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
              <h3 className="text-sm font-medium text-ck-t2 mb-2">正确答案</h3>
              <div className="bg-ck-success-bg border border-ck-b1 rounded-ck p-3">
                <p className="text-ck-success-t font-medium">{data.parsed.correctAnswer}</p>
              </div>
            </div>
          )}

          {/* Quiz Type */}
          <div>
            <h3 className="text-sm font-medium text-ck-t2 mb-2">题型</h3>
            <div className="inline-flex items-center px-3 py-1 bg-ck-info-bg text-ck-info-t rounded-full text-sm font-medium">
              {data.parsed.quizType === 'choice' && '选择题'}
              {data.parsed.quizType === 'fill' && '填空题'}
              {data.parsed.quizType === 'subjective' && '主观题'}
            </div>
          </div>
        </section>
      )}

      {/* Metadata Section */}
      {data.metadata && (
        <section className="space-y-4 pt-6 border-t border-ck-b1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-ck-t2 flex items-center gap-2">
              <Tag weight="regular" className="w-4 h-4" />
              关联元数据
            </h3>
            <button
              onClick={() => setShowMetadata(!showMetadata)}
              className="text-xs text-ck-accent hover:text-ck-accent-hover transition-colors duration-200 ease-claude"
            >
              {showMetadata ? '收起' : '展开'}
            </button>
          </div>

          {showMetadata && (
            <div className="space-y-4">
              {/* Knowledge Points */}
              {data.metadata.knowledgePoints.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-ck-t2 mb-2 flex items-center gap-1">
                    <Tag weight="regular" className="w-3 h-3" />
                    相关知识点
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {data.metadata.knowledgePoints.map((kp) => (
                      <span
                        key={kp.id}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-both-light text-both-dark rounded-md text-xs"
                        title={`置信度: ${((kp.confidence || 0) * 100).toFixed(0)}%`}
                      >
                        {kp.name}
                        {kp.confidence && kp.confidence > 0.8 && (
                          <span className="text-both">*</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Catalog Path */}
              {data.metadata.catalog && data.metadata.catalog.path.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-ck-t2 mb-2 flex items-center gap-1">
                    <Folder weight="regular" className="w-3 h-3" />
                    所属目录
                  </h4>
                  <div className="flex items-center gap-1 text-xs text-ck-t2">
                    {data.metadata.catalog.path.map((segment, index) => (
                      <span key={index} className="flex items-center gap-1">
                        {index > 0 && <span className="text-ck-t3">&rsaquo;</span>}
                        <span className="bg-ck-bg2 px-2 py-1 rounded-ck">{segment}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Difficulty */}
              {data.metadata && data.metadata.difficulty > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-ck-t2 mb-2 flex items-center gap-1">
                    <ChartBar weight="regular" className="w-3 h-3" />
                    难度等级
                  </h4>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className={`w-8 h-8 rounded-ck flex items-center justify-center text-xs font-medium transition-colors duration-200 ease-claude ${
                            level <= (data.metadata?.difficulty || 0)
                              ? 'bg-ck-accent text-white'
                              : 'bg-ck-bg2 text-ck-t3'
                          }`}
                        >
                          {level}
                        </div>
                      ))}
                    </div>
                    <span className="text-sm text-ck-t2">
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
