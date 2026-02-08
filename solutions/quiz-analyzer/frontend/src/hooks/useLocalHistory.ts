/**
 * useLocalHistory - LocalStorage-based analysis history management
 *
 * Stores up to 50 quiz analysis records in localStorage
 * Provides analyze, export, and history management functions
 */

import { useState, useEffect, useCallback } from 'react'
import type { QuizAnalysis } from '../types'

const STORAGE_KEY = 'quiz-analysis-history'
const MAX_HISTORY = 50

export interface AnalysisRecord {
  id: string
  quiz: {
    content: string
    answer?: string
  }
  analysis: QuizAnalysis
  timestamp: Date
}

export interface UseLocalHistoryReturn {
  history: AnalysisRecord[]
  current: AnalysisRecord | null

  saveAnalysis: (content: string, answer: string | undefined, analysis: QuizAnalysis) => void
  setCurrent: (record: AnalysisRecord | null) => void
  deleteRecord: (id: string) => void
  clearHistory: () => void

  exportJSON: () => void
  exportMarkdown: () => void
  copyToClipboard: () => Promise<boolean>
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function formatMarkdown(record: AnalysisRecord): string {
  const { quiz, analysis } = record
  const date = new Date(record.timestamp).toLocaleString('zh-CN')

  let md = `# 题目分析报告\n\n`
  md += `**分析时间**: ${date}\n\n`
  md += `---\n\n`
  md += `## 题目内容\n\n${quiz.content}\n\n`

  if (quiz.answer) {
    md += `**参考答案**: ${quiz.answer}\n\n`
  }

  md += `---\n\n`

  if (analysis.quiz_analysis) {
    md += `## 整体分析\n\n${analysis.quiz_analysis}\n\n`
  }

  if (analysis.thinking_process) {
    md += `## 解题思路\n\n${analysis.thinking_process}\n\n`
  }

  if (analysis.solution_steps && analysis.solution_steps.length > 0) {
    md += `## 解题步骤\n\n`
    analysis.solution_steps.forEach((step, i) => {
      md += `### 步骤 ${i + 1}: ${step.title || step.description}\n\n`
      md += `${step.description}\n\n`
      if (step.formula) md += `**公式**: ${step.formula}\n\n`
      if (step.reasoning) md += `**推理**: ${step.reasoning}\n\n`
    })
  }

  if (analysis.common_mistakes && analysis.common_mistakes.length > 0) {
    md += `## 常见错误\n\n`
    analysis.common_mistakes.forEach((mistake, i) => {
      md += `### 错误 ${i + 1}\n\n`
      md += `**描述**: ${mistake.description}\n\n`
      md += `**频率**: ${mistake.frequency}\n\n`
      md += `**知识缺口**: ${mistake.knowledgeGaps.join(', ')}\n\n`
      md += `**补救措施**: ${mistake.remediation}\n\n`
    })
  }

  if (analysis.knowledge_gap_analysis) {
    md += `## 知识缺口分析\n\n${analysis.knowledge_gap_analysis}\n\n`
  }

  if (analysis.difficulty_analysis) {
    md += `## 难度分析\n\n`
    md += `**难度等级**: ${analysis.difficulty_analysis.overview}\n\n`
    if (analysis.difficulty_analysis.commonDifficulties && analysis.difficulty_analysis.commonDifficulties.length > 0) {
      md += `**常见难点**: ${analysis.difficulty_analysis.commonDifficulties.join(', ')}\n\n`
    }
  }

  if (analysis.knowledge_point_tags && analysis.knowledge_point_tags.length > 0) {
    md += `## 知识点标签\n\n`
    analysis.knowledge_point_tags.forEach(tag => {
      md += `- ${tag.name} (置信度: ${(tag.confidence * 100).toFixed(0)}%)\n`
    })
    md += `\n`
  }

  if (analysis.related_quizzes && analysis.related_quizzes.length > 0) {
    md += `## 相关题目\n\n`
    analysis.related_quizzes.forEach((related, i) => {
      md += `${i + 1}. ${related.content.substring(0, 50)}... (相似度: ${(related.similarity * 100).toFixed(0)}%)\n`
      md += `   **原因**: ${related.similarityReason}\n`
    })
    md += `\n`
  }

  return md
}

export function useLocalHistory(): UseLocalHistoryReturn {
  const [history, setHistory] = useState<AnalysisRecord[]>([])
  const [current, setCurrent] = useState<AnalysisRecord | null>(null)

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        // Convert timestamp strings back to Date objects
        const records = parsed.map((r: any) => ({
          ...r,
          timestamp: new Date(r.timestamp),
        }))
        setHistory(records)
      }
    } catch (error) {
      console.error('Failed to load history from localStorage:', error)
    }
  }, [])

  // Save history to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
    } catch (error) {
      console.error('Failed to save history to localStorage:', error)
    }
  }, [history])

  const saveAnalysis = useCallback(
    (content: string, answer: string | undefined, analysis: QuizAnalysis) => {
      const record: AnalysisRecord = {
        id: generateId(),
        quiz: { content, answer },
        analysis,
        timestamp: new Date(),
      }

      setHistory(prev => {
        const newHistory = [record, ...prev].slice(0, MAX_HISTORY)
        return newHistory
      })
      setCurrent(record)
    },
    []
  )

  const deleteRecord = useCallback((id: string) => {
    setHistory(prev => prev.filter(r => r.id !== id))
    setCurrent(prev => (prev?.id === id ? null : prev))
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
    setCurrent(null)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const exportJSON = useCallback(() => {
    if (!current) return

    const filename = `analysis-${current.id}.json`
    const content = JSON.stringify(current, null, 2)
    downloadFile(content, filename, 'application/json')
  }, [current])

  const exportMarkdown = useCallback(() => {
    if (!current) return

    const filename = `analysis-${current.id}.md`
    const content = formatMarkdown(current)
    downloadFile(content, filename, 'text/markdown')
  }, [current])

  const copyToClipboard = useCallback(async (): Promise<boolean> => {
    if (!current) return false

    try {
      const content = formatMarkdown(current)
      await navigator.clipboard.writeText(content)
      return true
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      return false
    }
  }, [current])

  return {
    history,
    current,
    saveAnalysis,
    setCurrent,
    deleteRecord,
    clearHistory,
    exportJSON,
    exportMarkdown,
    copyToClipboard,
  }
}
