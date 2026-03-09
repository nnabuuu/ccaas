/**
 * QuizAnalyzePage — Single-column layout organized by teacher workflow:
 *
 * View modes:
 * - prep (备课): Full analysis — quickSummary → 题目概览 → 正确答案 → 解题思路 → 讲解稿 → 教学参考 → 处理详情
 * - classroom (课堂): Brief — quickSummary → 正确答案 → 核心洞察
 * - student (学生): Guided — quickSummary → 题目概览 → 正确答案 → 解题思路(no KP pills)
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  MagnifyingGlass,
  ArrowCounterClockwise,
  Columns,
  TreeStructure,
  Notepad,
  Warning,
} from '@phosphor-icons/react'
import type { ToolBlock } from '@kedge-agentic/react-sdk'
import type { ViewMode, DifficultyAssessment } from '../types'
import ErrorBoundary from '../components/ErrorBoundary'
import ConnectionStatus from '../components/ConnectionStatus'
import ProcessPanel from '../components/ProcessPanel'
import KpResultPanel from '../components/KpResultPanel'
import ParsedContentPanel from '../components/ParsedContentPanel'
import SolutionStepsPanel from '../components/SolutionStepsPanel'
import AnalysisStrategyPanel from '../components/AnalysisStrategyPanel'
import { GeometryFigure } from '../components/GeometryFigure'
import ViewModeToggle from '../components/ViewModeToggle'
import { useQuizAnalyze } from '../hooks/useQuizAnalyze'

const TOOL_PHASE_LABELS: Record<string, string> = {
  fuzzy_search_knowledge_points: '模糊搜索定位',
  get_knowledge_point_path: '获取导航路径',
  get_knowledge_point_children: '兄弟验证 / 上溯',
  get_leaf_nodes: '钻探叶节点',
  parse_quiz_content: '解析题目内容',
  list_subjects: '查询学科列表',
  write_output: '输出结果',
}

/** Inline component: renders pitfalls in the 教学参考 section */
function PitfallsBlock({ assessment }: { assessment: DifficultyAssessment }) {
  if (!assessment.pitfalls?.length) return null
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
        <Warning weight="fill" className="w-3.5 h-3.5" />
        学生易错点
      </div>
      <ul className="space-y-1 pl-5 list-disc">
        {assessment.pitfalls.map((p, i) => (
          <li key={i} className="text-xs text-amber-800 leading-relaxed">{p}</li>
        ))}
      </ul>
      {assessment.reasoning && (
        <p className="text-xs text-zinc-500 pt-1 border-t border-amber-100">
          {assessment.reasoning}
        </p>
      )}
    </div>
  )
}

export default function QuizAnalyzePage() {
  const session = useQuizAnalyze()
  const [quizText, setQuizText] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('prep')
  const [processCollapsed, setProcessCollapsed] = useState(true)
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
    setProcessCollapsed(true)
  }, [session.clearConversation])

  // Extract tool blocks
  const toolBlocks = session.messages
    .flatMap(m => m.contentBlocks ?? [])
    .filter((b): b is ToolBlock => b.type === 'tool')

  const { result } = session
  const hasAnyResult = result.kpRefinementResult || result.parsedContent || result.correctAnswer || result.analysisStrategy || result.solutionSteps || result.quickSummary

  // View mode helpers
  const showFullAnalysis = viewMode === 'prep'
  const showClassroomBrief = viewMode === 'classroom'

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col bg-slate-50">
        {/* Header */}
        <header className="bg-white border-b border-zinc-200">
          <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
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

        {/* Main — single column, centered */}
        <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-6 space-y-4">
          {/* Input section — compact */}
          <div className="bg-white border border-zinc-200 rounded-xl p-4 space-y-3">
            <textarea
              ref={textareaRef}
              value={quizText}
              onChange={(e) => setQuizText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="在此粘贴数学题、物理题或其他学科题目..."
              rows={4}
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

          {/* Processing indicator — minimal, one line */}
          {session.isProcessing && (
            <div className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm text-zinc-600">
              <span className="spinner !w-4 !h-4 !border-2" />
              分析中…
              {session.isThinking && session.thinkingContent && (
                <span className="text-xs text-zinc-400 truncate ml-2">{session.thinkingContent}</span>
              )}
            </div>
          )}

          {/* Empty state */}
          {!hasAnyResult && !session.isProcessing && (
            <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center">
              <Notepad weight="regular" className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
              <p className="text-sm text-zinc-400">粘贴题目并点击"开始分析"，结果将在此逐步展示</p>
            </div>
          )}

          {/* Skeleton loader while processing with no results yet */}
          {!hasAnyResult && session.isProcessing && (
            <div className="bg-white border border-zinc-200 rounded-xl p-8">
              <div className="space-y-3">
                <div className="h-4 bg-zinc-100 rounded-lg w-1/3 animate-pulse" />
                <div className="h-3 bg-zinc-100 rounded-lg w-full animate-pulse" />
                <div className="h-3 bg-zinc-100 rounded-lg w-2/3 animate-pulse" />
                <div className="h-20 bg-zinc-50 rounded-lg animate-pulse mt-4" />
              </div>
            </div>
          )}

          {/* ⓪ 一句话总结 — prominent top card, visible in all modes */}
          {result.quickSummary && (
            <section
              ref={resultTopRef}
              className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 animate-fade-in"
            >
              <p className="text-sm font-medium text-indigo-900">{result.quickSummary}</p>
            </section>
          )}

          {/* ① 题目概览 — metadata + stem + options + geometry (hidden in classroom mode) */}
          {!showClassroomBrief && result.parsedContent && (
            <section className={`bg-white border border-zinc-200 rounded-xl p-4 animate-fade-in ${!result.quickSummary ? '' : ''}`} ref={!result.quickSummary ? resultTopRef : undefined}>
              <ParsedContentPanel
                parsedContent={result.parsedContent}
                difficultyAssessment={result.difficultyAssessment}
                timeAssessment={result.timeAssessment}
                timeEstimate={result.timeEstimate}
              />
              {result.geometryFigure && (
                <div className="mt-4 pt-4 border-t border-zinc-100">
                  <GeometryFigure spec={result.geometryFigure} size={380} />
                  <details className="mt-2">
                    <summary className="text-xs text-zinc-400 cursor-pointer hover:text-zinc-600 select-none">
                      查看原始 JSON
                    </summary>
                    <pre className="mt-1 p-2 bg-zinc-50 border border-zinc-200 rounded text-xs text-zinc-600 overflow-auto max-h-60 whitespace-pre-wrap break-all">
                      {JSON.stringify(result.geometryFigure, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </section>
          )}

          {/* ② 正确答案 — standalone prominent card (visible in all modes) */}
          {result.correctAnswer && (
            <section className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 animate-fade-in flex items-center gap-3">
              <span className="text-lg">✅</span>
              <div>
                <span className="text-xs font-semibold text-green-600 uppercase tracking-wide">正确答案</span>
                <p className="text-base font-semibold text-green-900 whitespace-pre-wrap">{result.correctAnswer}</p>
              </div>
            </section>
          )}

          {/* ③ 解题思路 — strategy + solution steps */}
          {/* Classroom mode: only show key insight from strategy */}
          {showClassroomBrief && result.analysisStrategy && (
            <section className="bg-white border border-zinc-200 rounded-xl p-4 space-y-3 animate-fade-in">
              <h3 className="text-sm font-semibold text-zinc-700">核心思路</h3>
              {/* Chosen approach — compact */}
              <div className="bg-violet-50 border border-violet-200 rounded-lg px-3 py-2.5">
                <p className="text-sm text-violet-900 font-medium">
                  {result.analysisStrategy.chosenApproach.split(/[。.！!？?\n]/)[0]}
                </p>
              </div>
              {/* Key insight */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  核心洞察
                </div>
                <p className="text-sm text-blue-800 mt-1">{result.analysisStrategy.keyInsight}</p>
              </div>
            </section>
          )}

          {/* Full analysis view (prep + student modes): strategy + steps */}
          {!showClassroomBrief && (result.analysisStrategy || (result.solutionSteps && result.solutionSteps.length > 0)) && (
            <section className="bg-white border border-zinc-200 rounded-xl p-4 space-y-4 animate-fade-in">
              <h3 className="text-sm font-semibold text-zinc-700">解题思路</h3>
              {result.analysisStrategy && (
                <AnalysisStrategyPanel strategy={result.analysisStrategy} />
              )}
              {result.solutionSteps && result.solutionSteps.length > 0 && (
                <>
                  <div className="flex items-center gap-2 pt-1">
                    <div className="flex-1 h-px bg-zinc-200" />
                    <span className="text-xs font-semibold text-zinc-500">分步解析</span>
                    <div className="flex-1 h-px bg-zinc-200" />
                  </div>
                  <SolutionStepsPanel steps={result.solutionSteps} viewMode={viewMode} />
                </>
              )}
              {result.solutionGeometryFigure && (
                <div className="pt-4 border-t border-zinc-100">
                  <h4 className="text-xs font-semibold text-zinc-500 mb-2">解题图形（可交互）</h4>
                  <GeometryFigure spec={result.solutionGeometryFigure} size={380} />
                  <details className="mt-2">
                    <summary className="text-xs text-zinc-400 cursor-pointer hover:text-zinc-600 select-none">
                      查看原始 JSON
                    </summary>
                    <pre className="mt-1 p-2 bg-zinc-50 border border-zinc-200 rounded text-xs text-zinc-600 overflow-auto max-h-60 whitespace-pre-wrap break-all">
                      {JSON.stringify(result.solutionGeometryFigure, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </section>
          )}

          {/* ④ 讲解稿 — oral-style lecture script (prep mode only) */}
          {showFullAnalysis && result.lectureScript && (
            <section className="bg-white border border-zinc-200 rounded-xl p-4 space-y-3 animate-fade-in">
              <div className="flex items-center gap-2">
                <span className="text-sm">🎙️</span>
                <h3 className="text-sm font-semibold text-zinc-700">讲解稿</h3>
                <span className="text-xs text-zinc-400">可直接用于课堂讲解</span>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3">
                <p className="text-sm text-zinc-800 leading-relaxed whitespace-pre-wrap">{result.lectureScript}</p>
              </div>
            </section>
          )}

          {/* ⑤ 教学参考 (备课视图) — pitfalls + KP details */}
          {showFullAnalysis && (result.difficultyAssessment || result.kpRefinementResult) && (
            <section className="bg-white border border-zinc-200 rounded-xl p-4 space-y-4 animate-fade-in">
              <h3 className="text-sm font-semibold text-zinc-700">教学参考</h3>
              {/* 易错点 */}
              {result.difficultyAssessment && (
                <PitfallsBlock assessment={result.difficultyAssessment} />
              )}
              {/* 知识点详情 */}
              {result.kpRefinementResult && (
                <KpResultPanel result={result.kpRefinementResult} />
              )}
            </section>
          )}

          {/* 🔧 处理详情 — bottom, default collapsed */}
          <ProcessPanel
            blocks={toolBlocks}
            isProcessing={session.isProcessing}
            collapsed={processCollapsed}
            onToggleCollapsed={() => setProcessCollapsed(c => !c)}
            title="处理详情"
            phaseLabels={TOOL_PHASE_LABELS}
          />
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-zinc-200">
          <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between text-xs">
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
