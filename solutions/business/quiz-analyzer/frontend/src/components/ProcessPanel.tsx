/**
 * ProcessPanel — Shared component for visualizing tool call execution process.
 * Extracted from KpMatchPage for reuse across pages.
 */

import { useState, useEffect } from 'react'
import {
  CaretDown,
  CaretRight,
  CheckCircle,
  XCircle,
} from '@phosphor-icons/react'
import type { ToolBlock } from '@kedge-agentic/react-sdk'

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
  const label = labels[tool.toolName] || tool.toolName
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
  collapsed,
  onToggleCollapsed,
  title = '匹配过程',
  phaseLabels,
}: {
  blocks: ToolBlock[]
  isProcessing: boolean
  collapsed: boolean
  onToggleCollapsed: () => void
  title?: string
  phaseLabels?: Record<string, string>
}) {
  const [expandOverride, setExpandOverride] = useState<boolean | null>(null)

  if (blocks.length === 0 && !isProcessing) return null

  const completedCount = blocks.filter(b => b.tool.phase === 'end').length
  const runningCount = blocks.filter(b => b.tool.phase === 'start' || b.tool.phase === 'progress').length
  const totalDuration = blocks.reduce((sum, b) => sum + (b.tool.duration ?? 0), 0)

  const toggleAll = () => setExpandOverride(prev => prev === true ? false : true)

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
          <span className="text-xs font-semibold text-zinc-600">{title}</span>
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
            <ProcessEventRow
              key={`${block.tool.toolId}-${block.tool.phase}-${i}`}
              block={block}
              forceExpanded={expandOverride}
              phaseLabels={phaseLabels}
            />
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
