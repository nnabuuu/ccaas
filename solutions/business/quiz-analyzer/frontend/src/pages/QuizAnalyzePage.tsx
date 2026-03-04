/**
 * QuizAnalyzePage — Two-column layout: left=input+process, right=progressive results.
 * Root page for quiz analysis + explanation workflow.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  MagnifyingGlass,
  ArrowCounterClockwise,
  Columns,
  TreeStructure,
  Notepad,
} from '@phosphor-icons/react'
import type { ToolBlock } from '@kedge-agentic/react-sdk'
import type { ViewMode } from '../types'
import ErrorBoundary from '../components/ErrorBoundary'
import ConnectionStatus from '../components/ConnectionStatus'
import ProcessPanel from '../components/ProcessPanel'
import KpResultPanel from '../components/KpResultPanel'
import ParsedContentPanel from '../components/ParsedContentPanel'
import SolutionStepsPanel from '../components/SolutionStepsPanel'
import ViewModeToggle from '../components/ViewModeToggle'
import { useQuizAnalyze } from '../hooks/useQuizAnalyze'

const TOOL_PHASE_LABELS: Record<string, string> = {
  fuzzy_search_knowledge_points: '阶段1: 模糊搜索定位',
  get_knowledge_point_path: '阶段1: 获取导航路径',
  get_knowledge_point_children: '阶段1: 兄弟验证 / 上溯',
  get_leaf_nodes: '阶段1: 钻探叶节点',
  parse_quiz_content: '阶段1: 解析题目内容',
  list_subjects: '查询学科列表',
  write_output: '输出结果',
}

export default function QuizAnalyzePage() {
  const session = useQuizAnalyze()
  const [quizText, setQuizText] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('teacher')
  const [processCollapsed, setProcessCollapsed] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const resultTopRef = useRef<HTMLDivElement>(null)
  const prevIsProcessing = useRef(session.isProcessing)

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  // Auto-collapse process panel when done, scroll to result
  useEffect(() => {
    if (prevIsProcessing.current && !session.isProcessing && session.result.solutionSteps) {
      setProcessCollapsed(true)
      setTimeout(() => {
        resultTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
    prevIsProcessing.current = session.isProcessing
  }, [session.isProcessing, session.result.solutionSteps])

  // Expand process panel when new analysis starts
  useEffect(() => {
    if (session.isProcessing) {
      setProcessCollapsed(false)
    }
  }, [session.isProcessing])

  const handleSubmit = useCallback(() => {
    const trimmed = quizText.trim()
    if (!trimmed || session.isProcessing) return
    session.sendMessage(trimmed)
  }, [quizText, session.isProcessing, session.sendMessage])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit],
  )

  const handleReset = useCallback(() => {
    session.clearConversation()
    setQuizText('')
    setProcessCollapsed(false)
  }, [session.clearConversation])

  // Active tool labels
  const activeToolLabels = Array.from(session.activeTools.values())
    .map((t) => TOOL_PHASE_LABELS[t.toolName] || t.toolName)
    .filter((v, i, a) => a.indexOf(v) === i)

  // Extract tool blocks
  const toolBlocks = session.messages
    .flatMap(m => m.contentBlocks ?? [])
    .filter((b): b is ToolBlock => b.type === 'tool')

  const { result } = session
  const hasAnyResult = result.kpRefinementResult || result.parsedContent || result.correctAnswer || result.solutionSteps

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col bg-slate-50">
        {/* Header */}
        <header className="bg-white border-b border-zinc-200">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
            <h1 className="text-lg font-bold text-zinc-900">题目分析与讲解</h1>
            <div className="flex items-center gap-3">
              <Link
                to="/full-analysis"
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 transition-colors"
              >
                <Columns weight="regular" className="w-3.5 h-3.5" />
                完整分析
              </Link>
              <Link
                to="/kp-match"
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 transition-colors"
              >
                <TreeStructure weight="regular" className="w-3.5 h-3.5" />
                知识点匹配
              </Link>
              <ViewModeToggle value={viewMode} onChange={setViewMode} />
              <button onClick={handleReset} className="btn-secondary flex items-center gap-2 text-sm">
                <ArrowCounterClockwise weight="regular" className="w-4 h-4" />
                重置
              </button>
            </div>
          </div>
        </header>

        {/* Main — two-column grid */}
        <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-6 items-start">
            {/* Left column: Input + Process */}
            <div className="space-y-4">
              {/* Input section */}
              <div className="bg-white border border-zinc-200 rounded-xl p-4 space-y-3">
                <label className="text-sm font-medium text-zinc-700">粘贴题目内容</label>
                <textarea
                  ref={textareaRef}
                  value={quizText}
                  onChange={(e) => setQuizText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="在此粘贴数学题、物理题或其他学科题目..."
                  rows={6}
                  className="input resize-y !rounded-xl"
                  disabled={session.isProcessing}
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Ctrl + Enter 发送</span>
                  <button
                    onClick={handleSubmit}
                    disabled={!quizText.trim() || session.isProcessing}
                    className="btn-primary flex items-center gap-2"
                  >
                    {session.isProcessing ? (
                      <>
                        <span className="spinner !w-4 !h-4 !border-2" />
                        分析中…
                      </>
                    ) : (
                      <>
                        <MagnifyingGlass weight="bold" className="w-4 h-4" />
                        开始分析
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Tool activity indicator */}
              {session.isProcessing && activeToolLabels.length > 0 && (
                <div className="flex flex-wrap gap-2 animate-fade-in">
                  {activeToolLabels.map((label) => (
                    <div
                      key={label}
                      className="flex items-center gap-2 px-3 py-1.5 bg-primary-50 border border-primary-200 rounded-full text-xs font-medium text-primary-700"
                    >
                      <span className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-pulse" />
                      {label}
                    </div>
                  ))}
                </div>
              )}

              {/* Process panel */}
              <ProcessPanel
                blocks={toolBlocks}
                isProcessing={session.isProcessing}
                collapsed={processCollapsed}
                onToggleCollapsed={() => setProcessCollapsed(c => !c)}
                title="分析过程"
                phaseLabels={TOOL_PHASE_LABELS}
              />

              {/* Thinking indicator */}
              {session.isThinking && (
                <div className="bg-white border border-zinc-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <span className="spinner !w-4 !h-4 !border-2" />
                    正在思考…
                  </div>
                  {session.thinkingContent && (
                    <p className="mt-2 text-xs text-zinc-400 line-clamp-3">{session.thinkingContent}</p>
                  )}
                </div>
              )}
            </div>

            {/* Right column: Progressive results */}
            <div className="space-y-4" ref={resultTopRef}>
              {!hasAnyResult && !session.isProcessing && (
                <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center">
                  <Notepad weight="regular" className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                  <p className="text-sm text-zinc-400">粘贴题目并点击"开始分析"，结果将在此逐步展示</p>
                </div>
              )}

              {!hasAnyResult && session.isProcessing && (
                <div className="bg-white border border-zinc-200 rounded-xl p-8">
                  <div className="space-y-3">
                    {/* Skeleton loaders */}
                    <div className="h-4 bg-zinc-100 rounded-lg w-1/3 animate-pulse" />
                    <div className="h-3 bg-zinc-100 rounded-lg w-full animate-pulse" />
                    <div className="h-3 bg-zinc-100 rounded-lg w-2/3 animate-pulse" />
                    <div className="h-20 bg-zinc-50 rounded-lg animate-pulse mt-4" />
                  </div>
                </div>
              )}

              {/* 1. Parsed Content + difficulty + time + KP tags */}
              {result.parsedContent && (
                <div className="bg-white border border-zinc-200 rounded-xl p-4 animate-fade-in">
                  <ParsedContentPanel
                    parsedContent={result.parsedContent}
                    difficultyAssessment={result.difficultyAssessment}
                    timeAssessment={result.timeAssessment}
                    timeEstimate={result.timeEstimate}
                    kpResult={result.kpRefinementResult}
                  />
                </div>
              )}

              {/* 2. Correct Answer */}
              {result.correctAnswer && (
                <div className="bg-white border border-zinc-200 rounded-xl p-4 animate-fade-in">
                  <h3 className="text-sm font-semibold text-zinc-700 mb-2">正确答案</h3>
                  <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800 whitespace-pre-wrap">
                    {result.correctAnswer}
                  </div>
                </div>
              )}

              {/* 3. Solution Steps */}
              {result.solutionSteps && result.solutionSteps.length > 0 && (
                <div className="bg-white border border-zinc-200 rounded-xl p-4 animate-fade-in">
                  <SolutionStepsPanel steps={result.solutionSteps} viewMode={viewMode} />
                </div>
              )}

              {/* 4. KP Refinement Result (teacher view only) */}
              {viewMode === 'teacher' && result.kpRefinementResult && (
                <div className="bg-white border border-zinc-200 rounded-xl p-4 animate-fade-in">
                  <KpResultPanel result={result.kpRefinementResult} />
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-zinc-200">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between text-xs">
            <ConnectionStatus
              connected={session.connected}
              error={session.error}
              onReconnect={session.reconnect}
            />
            <div className="text-zinc-500">
              {session.sessionId && (
                <span>会话 ID: {session.sessionId.substring(0, 8)}</span>
              )}
            </div>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  )
}
