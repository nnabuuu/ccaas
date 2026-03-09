/**
 * ProcessPanel — Trigger bar (always inline) + slide-over popup for tool call details.
 *
 * - Trigger: one-line summary with elapsed time + call count
 * - Popup: right-side slide-over with semi-transparent backdrop
 */

import { useState, useEffect, useRef } from 'react'
import {
  CaretDown,
  CaretRight,
  CheckCircle,
  XCircle,
  X,
} from '@phosphor-icons/react'
import type { ToolBlock, ContentBlock } from '@kedge-agentic/react-sdk'

function useElapsed(active: boolean): number {
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(0)

  useEffect(() => {
    if (active) {
      startRef.current = Date.now()
      setElapsed(0)
      const id = setInterval(() => {
        setElapsed(Date.now() - startRef.current)
      }, 1000)
      return () => clearInterval(id)
    }
  }, [active])

  return elapsed
}

function formatSec(ms: number): string {
  return (ms / 1000).toFixed(1) + 's'
}

const DEFAULT_PHASE_LABELS: Record<string, string> = {
  fuzzy_search_knowledge_points: '模糊搜索定位',
  get_knowledge_point_path: '获取导航路径',
  get_knowledge_point_children: '兄弟验证 / 上溯',
  get_leaf_nodes: '钻探叶节点',
  parse_quiz_content: '解析题目内容',
  write_output: '输出结果',
}

export function ProcessEventRow({
  block,
  forceExpanded,
  phaseLabels,
}: {
  block: ToolBlock
  forceExpanded?: boolean | null
  phaseLabels?: Record<string, string>
}) {
  const [expanded, setExpanded] = useState(false)
  const labels = { ...DEFAULT_PHASE_LABELS, ...phaseLabels }

  useEffect(() => {
    if (forceExpanded != null) {
      setExpanded(forceExpanded)
    }
  }, [forceExpanded])

  const { tool } = block
  const shortName = tool.toolName.replace(/^mcp__[^_]+__/, '')
  const label = labels[shortName] || shortName
  const isRunning = tool.phase === 'start' || tool.phase === 'progress'
  const isFailed = tool.phase === 'end' && tool.success === false

  return (
    <div className="border-b border-zinc-100 last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-zinc-50/50 transition-colors text-left"
      >
        {isRunning ? (
          <span className="spinner !w-3.5 !h-3.5 !border-2 flex-shrink-0" />
        ) : isFailed ? (
          <XCircle weight="fill" className="w-4 h-4 text-red-500 flex-shrink-0" />
        ) : (
          <CheckCircle weight="fill" className="w-4 h-4 text-green-500 flex-shrink-0" />
        )}

        <span className="flex-1 text-zinc-700 truncate">{label}</span>

        <span className="text-xs text-zinc-400 flex-shrink-0">
          {isRunning ? (
            '运行中'
          ) : tool.duration != null ? (
            `${(tool.duration / 1000).toFixed(1)}s`
          ) : null}
        </span>

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

export default function ProcessPanel({
  blocks,
  isProcessing,
  thinkingContent,
  phaseLabels,
  statusText,
}: {
  blocks: ContentBlock[]
  isProcessing: boolean
  thinkingContent?: string
  phaseLabels?: Record<string, string>
  statusText?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [expandOverride, setExpandOverride] = useState<boolean | null>(null)
  const elapsed = useElapsed(isProcessing)

  const toolBlocks = blocks.filter((b): b is ToolBlock => b.type === 'tool')

  if (toolBlocks.length === 0 && !isProcessing) return null

  const completedCount = toolBlocks.filter(b => b.tool.phase === 'end').length
  const runningCount = toolBlocks.filter(b => b.tool.phase === 'start' || b.tool.phase === 'progress').length

  const toggleAll = () => setExpandOverride(prev => prev === true ? false : true)

  return (
    <>
      {/* Trigger bar — always inline */}
      <button
        onClick={() => setIsOpen(true)}
        className="w-full border border-zinc-200 rounded-xl bg-white hover:bg-zinc-50 transition-colors px-4 py-2.5 flex items-center gap-2 text-sm text-left animate-fade-in"
      >
        {isProcessing ? (
          <span className="spinner !w-4 !h-4 !border-2 flex-shrink-0" />
        ) : (
          <CheckCircle weight="fill" className="w-4 h-4 text-green-500 flex-shrink-0" />
        )}
        <span className="font-medium text-zinc-700 truncate">
          {isProcessing ? (statusText || '分析中…') : '分析完成'}
        </span>
        <span className="text-zinc-400 text-xs flex-shrink-0">
          {isProcessing
            ? `${toolBlocks.length} 次调用`
            : `${completedCount} 步 · 耗时 ${formatSec(elapsed)}`}
        </span>
        {isProcessing && thinkingContent && (
          <span className="text-xs text-zinc-400 truncate ml-1">{thinkingContent}</span>
        )}
      </button>

      {/* Slide-over popup */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/20 transition-opacity"
            onClick={() => setIsOpen(false)}
          />
          {/* Panel */}
          <div className="relative w-full max-w-[420px] bg-white shadow-xl flex flex-col animate-slide-in-right">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 bg-zinc-50">
              <div>
                <h2 className="text-sm font-semibold text-zinc-700">
                  {isProcessing ? '分析中…' : '分析完成'}
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {isProcessing
                    ? `已运行 ${formatSec(elapsed)} · ${runningCount} 运行中 · ${completedCount} 完成`
                    : `${completedCount} 步完成 · 耗时 ${formatSec(elapsed)}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {toolBlocks.length > 0 && (
                  <button
                    onClick={toggleAll}
                    className="text-[11px] text-primary-600 hover:text-primary-700 font-medium transition-colors"
                  >
                    {expandOverride === true ? '全部收缩' : '全部展开'}
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
                >
                  <X weight="bold" className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {blocks.length > 0 ? (
                <div className="divide-y divide-zinc-100">
                  {blocks.map((block, i) =>
                    block.type === 'text' ? (
                      <div key={`text-${i}`} className="px-4 py-1.5 text-xs text-zinc-500">
                        {block.text}
                      </div>
                    ) : (
                      <ProcessEventRow
                        key={`${block.tool.toolId}-${block.tool.phase}-${i}`}
                        block={block}
                        forceExpanded={expandOverride}
                        phaseLabels={phaseLabels}
                      />
                    )
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 px-4 py-3 text-sm text-zinc-400">
                  <span className="spinner !w-3.5 !h-3.5 !border-2" />
                  等待工具调用…
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
