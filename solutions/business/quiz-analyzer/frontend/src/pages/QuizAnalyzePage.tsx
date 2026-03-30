/**
 * QuizAnalyzePage — Single-column layout organized by information hierarchy:
 *
 * Layout: ① 题目(含答案) → ② 知识点 → ③ 解题思路 → ④ 教学参考
 *
 * View modes:
 * - prep (备课): Full analysis — all sections
 * - classroom (课堂): Brief — 核心思路 only
 * - student (学生): Guided — ①②③ (no KP pills in steps)
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
import type { ContentBlock } from '@kedge-agentic/react-sdk'
import type { ViewMode, DifficultyAssessment } from '../types'
import ErrorBoundary from '../components/ErrorBoundary'
import ConnectionStatus from '../components/ConnectionStatus'
import ProcessPanel from '../components/ProcessPanel'
import KpResultPanel from '../components/KpResultPanel'
import ParsedContentPanel from '../components/ParsedContentPanel'
import SolutionStepsPanel from '../components/SolutionStepsPanel'
import { GeometryFigure } from '../components/GeometryFigure'
import ViewModeToggle from '../components/ViewModeToggle'
import Markdown from '../components/Markdown'
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
    <div className="bg-ck-warn-bg border border-ck-b1 rounded-ck p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-ck-warn-t">
        <Warning weight="fill" className="w-3.5 h-3.5" />
        学生易错点
      </div>
      <ul className="space-y-1 pl-5 list-disc">
        {assessment.pitfalls.map((p, i) => (
          <li key={i} className="text-xs text-ck-warn-t leading-relaxed">{p}</li>
        ))}
      </ul>
      {assessment.reasoning && (
        <p className="text-xs text-ck-t2 pt-1 border-t border-ck-b2">
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
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const resultTopRef = useRef<HTMLDivElement>(null)
  const prevIsProcessing = useRef(session.isProcessing)

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  // Scroll to result when processing completes
  useEffect(() => {
    if (prevIsProcessing.current && !session.isProcessing && session.result.solutionSteps) {
      setTimeout(() => {
        resultTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
    prevIsProcessing.current = session.isProcessing
  }, [session.isProcessing, session.result.solutionSteps])

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
  }, [session.clearConversation])

  // Extract all content blocks (text + tool) for ProcessPanel
  const contentBlocks: ContentBlock[] = session.messages
    .flatMap(m => m.contentBlocks ?? [])

  // Extract latest AI text output as status text for ProcessPanel
  const latestStatusText = (() => {
    if (!session.isProcessing) return undefined
    const msgs = session.messages
    if (!msgs.length) return undefined
    const lastMsg = msgs[msgs.length - 1]
    if (!lastMsg?.contentBlocks?.length) return undefined
    for (let i = lastMsg.contentBlocks.length - 1; i >= 0; i--) {
      const block = lastMsg.contentBlocks[i]
      if (block.type === 'text' && block.text.trim()) {
        return block.text.trim()
      }
    }
    return undefined
  })()

  const { result } = session
  const hasAnyResult = result.kpRefinementResult || result.parsedContent || result.correctAnswer || result.analysisStrategy || result.solutionSteps || result.quickSummary

  // View mode helpers
  const showFullAnalysis = viewMode === 'prep'
  const showClassroomBrief = viewMode === 'classroom'

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col bg-ck-bg2">
        {/* Header */}
        <header className="bg-ck-bg1 border-b border-ck-b2">
          <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
            <h1 className="text-lg font-bold text-ck-t1">题目分析与讲解</h1>
            <div className="flex items-center gap-3">
              <Link
                to="/full-analysis"
                className="flex items-center gap-1.5 text-xs text-ck-t2 hover:text-ck-t1 transition-colors duration-200 ease-claude"
              >
                <Columns weight="regular" className="w-3.5 h-3.5" />
                完整分析
              </Link>
              <Link
                to="/kp-match"
                className="flex items-center gap-1.5 text-xs text-ck-t2 hover:text-ck-t1 transition-colors duration-200 ease-claude"
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
          <div className="bg-ck-bg1 border border-ck-b2 rounded-ck-lg p-4 space-y-3">
            <textarea
              ref={textareaRef}
              value={quizText}
              onChange={(e) => setQuizText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="在此粘贴数学题、物理题或其他学科题目..."
              rows={4}
              className="input resize-y !rounded-ck-lg"
              disabled={session.isProcessing}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-ck-t3">Ctrl + Enter 发送</span>
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

          {/* Process panel — unified "分析中…" / "分析完成" bar */}
          <ProcessPanel
            blocks={contentBlocks}
            isProcessing={session.isProcessing}
            thinkingContent={session.isThinking ? session.thinkingContent : undefined}
            phaseLabels={TOOL_PHASE_LABELS}
            statusText={latestStatusText}
          />

          {/* Empty state */}
          {!hasAnyResult && !session.isProcessing && (
            <div className="bg-ck-bg1 border border-ck-b2 rounded-ck-lg p-8 text-center">
              <Notepad weight="regular" className="w-12 h-12 text-ck-t3 mx-auto mb-3" />
              <p className="text-sm text-ck-t3">粘贴题目并点击"开始分析"，结果将在此逐步展示</p>
            </div>
          )}

          {/* Skeleton loader while processing with no results yet */}
          {!hasAnyResult && session.isProcessing && (
            <div className="bg-ck-bg1 border border-ck-b2 rounded-ck-lg p-8">
              <div className="space-y-3">
                <div className="h-4 bg-ck-bg2 rounded-ck w-1/3 animate-pulse" />
                <div className="h-3 bg-ck-bg2 rounded-ck w-full animate-pulse" />
                <div className="h-3 bg-ck-bg2 rounded-ck w-2/3 animate-pulse" />
                <div className="h-20 bg-ck-bg2 rounded-ck animate-pulse mt-4" />
              </div>
            </div>
          )}

          {/* ① 题目卡片 — stem + options + answer + one-line meta + geometry (prep + student) */}
          {!showClassroomBrief && result.parsedContent && (
            <section ref={resultTopRef} className="bg-ck-bg1 border border-ck-b2 rounded-ck-lg p-4 animate-fade-in">
              <ParsedContentPanel
                parsedContent={result.parsedContent}
                difficultyAssessment={result.difficultyAssessment}
                correctAnswer={result.correctAnswer}
              />
              {result.geometryFigure && (
                <div className="mt-4 pt-4 border-t border-ck-b2">
                  <GeometryFigure spec={result.geometryFigure} size={380} />
                  <details className="mt-2">
                    <summary className="text-xs text-ck-t3 cursor-pointer hover:text-ck-t2 select-none">
                      查看原始 JSON
                    </summary>
                    <pre className="mt-1 p-2 bg-ck-bg2 border border-ck-b1 rounded-ck text-xs text-ck-t2 overflow-auto max-h-60 whitespace-pre-wrap break-all">
                      {JSON.stringify(result.geometryFigure, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </section>
          )}

          {/* ② 知识点 — KP refinement result (prep + student) */}
          {!showClassroomBrief && result.kpRefinementResult && (
            <section className="bg-ck-bg1 border border-ck-b2 rounded-ck-lg p-4 animate-fade-in">
              <h3 className="text-sm font-semibold text-ck-t2 mb-3">知识点</h3>
              <KpResultPanel result={result.kpRefinementResult} />
            </section>
          )}

          {/* ③ 解题思路 — merged strategy + solution steps */}
          {/* Classroom mode: only show key insight */}
          {showClassroomBrief && result.analysisStrategy && (
            <section className="bg-ck-bg1 border border-ck-b2 rounded-ck-lg p-4 space-y-3 animate-fade-in">
              <h3 className="text-sm font-semibold text-ck-t2">核心思路</h3>
              <div className="bg-ck-info-bg border border-ck-b1 rounded-ck px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-ck-info-t">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  核心洞察
                </div>
                <Markdown compact className="text-sm text-ck-info-t mt-1">{result.analysisStrategy.keyInsight}</Markdown>
              </div>
            </section>
          )}

          {/* prep + student modes: unified strategy + steps */}
          {!showClassroomBrief && (result.analysisStrategy || (result.solutionSteps && result.solutionSteps.length > 0)) && (
            <section className="bg-ck-bg1 border border-ck-b2 rounded-ck-lg p-4 space-y-4 animate-fade-in">
              <h3 className="text-sm font-semibold text-ck-t2">解题思路</h3>
              <SolutionStepsPanel
                steps={result.solutionSteps ?? []}
                baseGeometryFigure={result.geometryFigure ?? undefined}
                analysisStrategy={result.analysisStrategy ?? undefined}
              />
              {result.solutionGeometryFigure && (
                <div className="pt-4 border-t border-ck-b2">
                  <h4 className="text-xs font-semibold text-ck-t2 mb-2">解题图形（可交互）</h4>
                  <GeometryFigure spec={result.solutionGeometryFigure} size={380} />
                  <details className="mt-2">
                    <summary className="text-xs text-ck-t3 cursor-pointer hover:text-ck-t2 select-none">
                      查看原始 JSON
                    </summary>
                    <pre className="mt-1 p-2 bg-ck-bg2 border border-ck-b1 rounded-ck text-xs text-ck-t2 overflow-auto max-h-60 whitespace-pre-wrap break-all">
                      {JSON.stringify(result.solutionGeometryFigure, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </section>
          )}

          {/* ④ 教学参考 (备课视图) — quickSummary + pitfalls */}
          {showFullAnalysis && (result.quickSummary || result.difficultyAssessment) && (
            <section className="bg-ck-bg1 border border-ck-b2 rounded-ck-lg p-4 space-y-4 animate-fade-in">
              <h3 className="text-sm font-semibold text-ck-t2">教学参考</h3>
              {/* 一句话总结 */}
              {result.quickSummary && (
                <div className="bg-ck-info-bg border border-ck-b1 rounded-ck px-3 py-2.5">
                  <Markdown compact className="text-sm font-medium text-ck-info-t">{result.quickSummary}</Markdown>
                </div>
              )}
              {/* 易错点 */}
              {result.difficultyAssessment && (
                <PitfallsBlock assessment={result.difficultyAssessment} />
              )}
            </section>
          )}

        </main>

        {/* Footer */}
        <footer className="bg-ck-bg1 border-t border-ck-b2">
          <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between text-xs">
            <ConnectionStatus
              connected={session.connected}
              error={session.error}
              onReconnect={session.reconnect}
            />
            <div className="text-ck-t2">
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
