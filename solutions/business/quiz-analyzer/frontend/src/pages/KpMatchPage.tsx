/**
 * KP Match Page - Standalone page for knowledge point matching via unified-kp-search skill
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  MagnifyingGlass,
  ArrowLeft,
  ArrowCounterClockwise,
  CaretDown,
  CaretRight,
  CheckCircle,
  XCircle,
  ArrowDown,
} from '@phosphor-icons/react'
import type { ToolBlock } from '@kedge-agentic/react-sdk'
import ErrorBoundary from '../components/ErrorBoundary'
import ConnectionStatus from '../components/ConnectionStatus'
import KpResultPanel from '../components/KpResultPanel'
import { useKpMatch } from '../hooks/useKpMatch'

// Tool phase labels
const TOOL_PHASE_LABELS: Record<string, string> = {
  fuzzy_search_knowledge_points: '阶段 A: 模糊搜索定位',
  get_knowledge_point_path: '阶段 A→B: 获取导航路径',
  get_knowledge_point_children: '阶段 B: 兄弟验证 / 上溯',
  get_leaf_nodes: '阶段 B: 钻探叶节点',
  write_output: '输出结果',
}

// --- Process Event Components ---

function ProcessEventRow({ block, forceExpanded }: { block: ToolBlock; forceExpanded?: boolean | null }) {
  const [expanded, setExpanded] = useState(false)

  // Sync with global override when it changes
  useEffect(() => {
    if (forceExpanded != null) {
      setExpanded(forceExpanded)
    }
  }, [forceExpanded])

  const { tool } = block
  const label = TOOL_PHASE_LABELS[tool.toolName] || tool.toolName
  const isRunning = tool.phase === 'start' || tool.phase === 'progress'
  const isFailed = tool.phase === 'end' && tool.success === false

  return (
    <div className="border-b border-zinc-100 last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-zinc-50/50 transition-colors text-left"
      >
        {/* Status icon */}
        {isRunning ? (
          <span className="spinner !w-3.5 !h-3.5 !border-2 flex-shrink-0" />
        ) : isFailed ? (
          <XCircle weight="fill" className="w-4 h-4 text-red-500 flex-shrink-0" />
        ) : (
          <CheckCircle weight="fill" className="w-4 h-4 text-green-500 flex-shrink-0" />
        )}

        {/* Label */}
        <span className="flex-1 text-zinc-700 truncate">{label}</span>

        {/* Duration / status */}
        <span className="text-xs text-zinc-400 flex-shrink-0">
          {isRunning ? (
            '运行中'
          ) : tool.duration != null ? (
            `${(tool.duration / 1000).toFixed(1)}s`
          ) : null}
        </span>

        {/* Expand caret */}
        {expanded ? (
          <CaretDown weight="bold" className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
        ) : (
          <CaretRight weight="bold" className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          {tool.toolInput != null && (
            <div>
              <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">输入</div>
              <pre className="text-[11px] text-zinc-600 bg-zinc-50 rounded-lg p-2.5 overflow-x-auto max-h-48 whitespace-pre-wrap break-words">
                {JSON.stringify(tool.toolInput, null, 2)}
              </pre>
            </div>
          )}
          {tool.phase === 'end' && tool.toolOutput != null && (
            <div>
              <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">输出</div>
              <pre className="text-[11px] text-zinc-600 bg-zinc-50 rounded-lg p-2.5 overflow-x-auto max-h-48 whitespace-pre-wrap break-words">
                {JSON.stringify(tool.toolOutput, null, 2)}
              </pre>
            </div>
          )}
          {tool.phase === 'end' && tool.toolError && (
            <div>
              <div className="text-[10px] font-semibold text-red-400 uppercase tracking-wider mb-1">错误</div>
              <pre className="text-[11px] text-red-600 bg-red-50 rounded-lg p-2.5 overflow-x-auto max-h-48 whitespace-pre-wrap break-words">
                {tool.toolError}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ProcessPanel({ blocks, isProcessing, collapsed, onToggleCollapsed }: {
  blocks: ToolBlock[]
  isProcessing: boolean
  collapsed: boolean
  onToggleCollapsed: () => void
}) {
  const [expandOverride, setExpandOverride] = useState<boolean | null>(null)

  if (blocks.length === 0 && !isProcessing) return null

  const completedCount = blocks.filter(b => b.tool.phase === 'end').length
  const runningCount = blocks.filter(b => b.tool.phase === 'start' || b.tool.phase === 'progress').length
  const totalDuration = blocks.reduce((sum, b) => sum + (b.tool.duration ?? 0), 0)

  const toggleAll = () => setExpandOverride(prev => prev === true ? false : true)

  // Collapsed summary mode
  if (collapsed && !isProcessing) {
    return (
      <div className="border border-zinc-200 rounded-xl overflow-hidden bg-white animate-fade-in">
        <button
          onClick={onToggleCollapsed}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-zinc-50 transition-colors"
        >
          <CaretRight weight="bold" className="w-3.5 h-3.5 text-zinc-400" />
          <CheckCircle weight="fill" className="w-4 h-4 text-green-500" />
          <span className="text-zinc-600">
            {completedCount} 步完成, {(totalDuration / 1000).toFixed(1)}s
          </span>
        </button>
      </div>
    )
  }

  return (
    <div className="border border-zinc-200 rounded-xl overflow-hidden bg-white animate-fade-in">
      <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-50 border-b border-zinc-200">
        <div className="flex items-center gap-2">
          {!isProcessing && (
            <button onClick={onToggleCollapsed} className="text-zinc-400 hover:text-zinc-600 transition-colors">
              <CaretDown weight="bold" className="w-3.5 h-3.5" />
            </button>
          )}
          <span className="text-xs font-semibold text-zinc-600">匹配过程</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-zinc-400">
          {blocks.length > 0 && (
            <button
              onClick={toggleAll}
              className="text-[11px] text-primary-600 hover:text-primary-700 font-medium transition-colors"
            >
              {expandOverride === true ? '全部收缩' : '全部展开'}
            </button>
          )}
          {runningCount > 0 && (
            <span className="flex items-center gap-1">
              <span className="spinner !w-3 !h-3 !border-[1.5px]" />
              {runningCount} 运行中
            </span>
          )}
          {completedCount > 0 && (
            <span className="flex items-center gap-1">
              <CheckCircle weight="fill" className="w-3 h-3 text-green-500" />
              {completedCount} 完成
            </span>
          )}
        </div>
      </div>
      {blocks.length > 0 ? (
        <div className="divide-y divide-zinc-100">
          {blocks.map((block, i) => (
            <ProcessEventRow key={`${block.tool.toolId}-${block.tool.phase}-${i}`} block={block} forceExpanded={expandOverride} />
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-3 text-sm text-zinc-400">
          <span className="spinner !w-3.5 !h-3.5 !border-2" />
          等待工具调用…
        </div>
      )}
    </div>
  )
}

export default function KpMatchPage() {
  const session = useKpMatch()
  const [quizText, setQuizText] = useState('')
  const [showChat, setShowChat] = useState(false)
  const [processCollapsed, setProcessCollapsed] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)
  const prevIsProcessing = useRef(session.isProcessing)

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  // Auto-collapse ProcessPanel and auto-scroll to result when processing finishes
  useEffect(() => {
    if (prevIsProcessing.current && !session.isProcessing && session.kpResult) {
      setProcessCollapsed(true)
      // Small delay so DOM updates with collapsed panel before scrolling
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
    prevIsProcessing.current = session.isProcessing
  }, [session.isProcessing, session.kpResult])

  // Expand ProcessPanel when a new search starts
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
    setShowChat(false)
    setProcessCollapsed(false)
  }, [session.clearConversation])

  const handleContinueMatch = useCallback(() => {
    setQuizText('')
    textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // Focus after scroll animation settles
    setTimeout(() => textareaRef.current?.focus(), 400)
  }, [])

  // Active tool labels
  const activeToolLabels = Array.from(session.activeTools.values())
    .map((t) => TOOL_PHASE_LABELS[t.toolName] || t.toolName)
    .filter((v, i, a) => a.indexOf(v) === i) // dedupe

  // Extract tool blocks from message contentBlocks for process panel
  const toolBlocks = session.messages
    .flatMap(m => m.contentBlocks ?? [])
    .filter((b): b is ToolBlock => b.type === 'tool')

  // Chat messages from assistant that have visible text content
  const assistantMessages = session.messages.filter(
    (m) => m.role === 'assistant' && m.content.trim().length > 0,
  )

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col bg-slate-50">
        {/* Header */}
        <header className="bg-white border-b border-zinc-200">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to="/"
                className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
              >
                <ArrowLeft weight="bold" className="w-4 h-4" />
                返回
              </Link>
              <h1 className="text-xl font-bold text-zinc-900">知识点匹配</h1>
            </div>
            <button onClick={handleReset} className="btn-secondary flex items-center gap-2 text-sm">
              <ArrowCounterClockwise weight="regular" className="w-4 h-4" />
              重置
            </button>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-8 space-y-6">
          {/* Input section */}
          <div className="bento-card !cursor-default hover:!scale-100 space-y-4">
            <label className="text-sm font-medium text-zinc-700">粘贴题目内容</label>
            <textarea
              ref={textareaRef}
              value={quizText}
              onChange={(e) => setQuizText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="在此粘贴数学题、物理题或其他学科题目..."
              rows={5}
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
                    搜索中…
                  </>
                ) : (
                  <>
                    <MagnifyingGlass weight="bold" className="w-4 h-4" />
                    搜索知识点
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

          {/* Process events panel */}
          <ProcessPanel
            blocks={toolBlocks}
            isProcessing={session.isProcessing}
            collapsed={processCollapsed}
            onToggleCollapsed={() => setProcessCollapsed(c => !c)}
          />

          {/* Thinking indicator */}
          {session.isThinking && (
            <div className="bento-card !cursor-default hover:!scale-100 !p-4">
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <span className="spinner !w-4 !h-4 !border-2" />
                正在思考…
              </div>
              {session.thinkingContent && (
                <p className="mt-2 text-xs text-zinc-400 line-clamp-3">{session.thinkingContent}</p>
              )}
            </div>
          )}

          {/* Result section */}
          {session.kpResult && (
            <div ref={resultRef} className="space-y-4">
              <div className="bento-card !cursor-default hover:!scale-100">
                <KpResultPanel result={session.kpResult} />
              </div>
              <div className="flex justify-center">
                <button onClick={handleContinueMatch} className="btn-secondary flex items-center gap-2 text-sm">
                  <ArrowDown weight="bold" className="w-4 h-4 rotate-180" />
                  继续匹配
                </button>
              </div>
            </div>
          )}

          {/* Chat transcript (collapsed by default) */}
          {assistantMessages.length > 0 && (
            <div className="border border-zinc-200 rounded-xl overflow-hidden bg-white">
              <button
                onClick={() => setShowChat(!showChat)}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
              >
                {showChat ? (
                  <CaretDown weight="bold" className="w-4 h-4" />
                ) : (
                  <CaretRight weight="bold" className="w-4 h-4" />
                )}
                AI 对话记录 ({assistantMessages.length} 条)
              </button>
              {showChat && (
                <div className="border-t border-zinc-200 divide-y divide-zinc-100 max-h-96 overflow-y-auto">
                  {assistantMessages.map((msg, i) => (
                    <div key={i} className="px-4 py-3 text-sm text-zinc-600 whitespace-pre-wrap">
                      {msg.content}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-zinc-200">
          <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between text-xs">
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
