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
    <div className="border-b border-ck-b2 last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-ck-bg3 transition-colors text-left"
      >
        {isRunning ? (
          <span className="spinner !w-3.5 !h-3.5 !border-2 flex-shrink-0" />
        ) : isFailed ? (
          <XCircle weight="fill" className="w-4 h-4 text-ck-danger-t flex-shrink-0" />
        ) : (
          <CheckCircle weight="fill" className="w-4 h-4 text-ck-success-t flex-shrink-0" />
        )}

        <span className="flex-1 text-ck-t1 truncate">{label}</span>

        <span className="text-xs text-ck-t3 flex-shrink-0">
          {isRunning ? (
            '运行中'
          ) : tool.duration != null ? (
            `${(tool.duration / 1000).toFixed(1)}s`
          ) : null}
        </span>

        {expanded ? (
          <CaretDown weight="bold" className="w-3.5 h-3.5 text-ck-t3 flex-shrink-0" />
        ) : (
          <CaretRight weight="bold" className="w-3.5 h-3.5 text-ck-t3 flex-shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          {tool.toolInput != null && (
            <div>
              <div className="text-[10px] font-semibold text-ck-t3 uppercase tracking-wider mb-1">输入</div>
              <pre className="text-[11px] text-ck-t2 bg-ck-bg2 rounded-ck p-2.5 overflow-x-auto max-h-48 whitespace-pre-wrap break-words">
                {JSON.stringify(tool.toolInput, null, 2)}
              </pre>
            </div>
          )}
          {tool.phase === 'end' && tool.toolOutput != null && (
            <div>
              <div className="text-[10px] font-semibold text-ck-t3 uppercase tracking-wider mb-1">输出</div>
              <pre className="text-[11px] text-ck-t2 bg-ck-bg2 rounded-ck p-2.5 overflow-x-auto max-h-48 whitespace-pre-wrap break-words">
                {JSON.stringify(tool.toolOutput, null, 2)}
              </pre>
            </div>
          )}
          {tool.phase === 'end' && tool.toolError && (
            <div>
              <div className="text-[10px] font-semibold text-ck-danger-t uppercase tracking-wider mb-1">错误</div>
              <pre className="text-[11px] text-ck-danger-t bg-ck-danger-bg rounded-ck p-2.5 overflow-x-auto max-h-48 whitespace-pre-wrap break-words">
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
        className="w-full border border-ck-b1 rounded-ck-lg bg-ck-bg1 hover:bg-ck-bg3 transition-colors px-4 py-2.5 flex items-center gap-2 text-sm text-left animate-fade-in"
      >
        {isProcessing ? (
          <span className="spinner !w-4 !h-4 !border-2 flex-shrink-0" />
        ) : (
          <CheckCircle weight="fill" className="w-4 h-4 text-ck-success-t flex-shrink-0" />
        )}
        <span className="font-medium text-ck-t1 truncate">
          {isProcessing ? (statusText || '分析中…') : '分析完成'}
        </span>
        <span className="text-ck-t3 text-xs flex-shrink-0">
          {isProcessing
            ? `${toolBlocks.length} 次调用`
            : `${completedCount} 步 · 耗时 ${formatSec(elapsed)}`}
        </span>
        {isProcessing && thinkingContent && (
          <span className="text-xs text-ck-t3 truncate ml-1">{thinkingContent}</span>
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
          <div className="relative w-full max-w-[420px] bg-ck-bg1 shadow-composer-hover flex flex-col animate-slide-in-right">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-ck-b1 bg-ck-bg2">
              <div>
                <h2 className="text-sm font-semibold text-ck-t1">
                  {isProcessing ? '分析中…' : '分析完成'}
                </h2>
                <p className="text-xs text-ck-t3 mt-0.5">
                  {isProcessing
                    ? `已运行 ${formatSec(elapsed)} · ${runningCount} 运行中 · ${completedCount} 完成`
                    : `${completedCount} 步完成 · 耗时 ${formatSec(elapsed)}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {toolBlocks.length > 0 && (
                  <button
                    onClick={toggleAll}
                    className="text-[11px] text-ck-accent hover:text-ck-accent-hover font-medium transition-colors duration-200 ease-claude"
                  >
                    {expandOverride === true ? '全部收缩' : '全部展开'}
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-md text-ck-t3 hover:text-ck-t2 hover:bg-ck-bg3 transition-colors duration-200 ease-claude"
                >
                  <X weight="bold" className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto ck-scrollbar">
              {blocks.length > 0 ? (
                <div className="divide-y divide-ck-b2">
                  {blocks.map((block, i) =>
                    block.type === 'text' ? (
                      <div key={`text-${i}`} className="px-4 py-1.5 text-xs text-ck-t2">
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
                <div className="flex items-center gap-2 px-4 py-3 text-sm text-ck-t3">
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
