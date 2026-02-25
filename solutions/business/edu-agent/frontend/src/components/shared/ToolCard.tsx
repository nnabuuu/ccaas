import { Wrench, Check, X, SpinnerGap } from '@phosphor-icons/react'
import type { ToolActivity } from '../../types'

interface ToolCardProps {
  tool: ToolActivity
}

function normalizeToolName(name: string): string {
  return name
    .replace(/^mcp__[^_]+__/, '')
    .replace(/^mcp__/, '')
}

function getToolLabel(name: string): string {
  const labels: Record<string, string> = {
    write_output: '写入数据',
    navigate_to: '导航页面',
    search_curriculum_standards: '搜索课标',
    search_textbook: '搜索教材',
    get_textbook_subjects: '获取学科',
    get_textbook_chapters: '获取章节',
    get_curriculum_standards: '获取课标',
    get_knowledge_points: '获取知识点',
    calculate_difficulty: '计算难度',
    generate_script_template: '生成讲稿模板',
  }
  return labels[normalizeToolName(name)] || normalizeToolName(name)
}

function getInputSummary(tool: ToolActivity): string | null {
  const name = normalizeToolName(tool.toolName)
  const input = tool.toolInput as Record<string, unknown> | undefined
  if (!input) return null

  if (name === 'write_output') {
    return input.preview as string || `更新 ${input.field}`
  }
  if (name === 'navigate_to') {
    return input.reason as string || `跳转到 ${input.route}`
  }
  return tool.description || null
}

export function ToolCard({ tool }: ToolCardProps) {
  const isRunning = tool.phase === 'start' || tool.phase === 'progress'
  const isSuccess = tool.phase === 'end' && tool.success !== false
  const isError = tool.phase === 'end' && tool.success === false
  const summary = getInputSummary(tool)

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-tertiary border border-border-subtle text-xs my-1">
      {isRunning && <SpinnerGap size={12} className="animate-spin text-accent" weight="bold" />}
      {isSuccess && <Check size={12} className="text-success" weight="bold" />}
      {isError && <X size={12} className="text-error" weight="bold" />}
      {!isRunning && !isSuccess && !isError && <Wrench size={12} className="text-ink-muted" weight="regular" />}

      <span className="font-medium text-ink-secondary">{getToolLabel(tool.toolName)}</span>
      {summary && <span className="text-ink-muted truncate max-w-[200px]">{summary}</span>}
      {tool.duration != null && (
        <span className="text-ink-muted">{(tool.duration / 1000).toFixed(1)}s</span>
      )}
    </div>
  )
}
