import { useState } from 'react'
import type { ToolUseBlock } from '@/types/chat'
import { useChatInterfaceContext } from '@/context/ChatInterfaceContext'

// ===== Helpers =====

export function stripMcpPrefix(name: string): string {
  const match = name.match(/^mcp__[^_]+__(.+)$/)
  return match ? match[1] : name
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '\u2026' : text
}

function shortenPath(path: string): string {
  const parts = path.split('/')
  if (parts.length <= 2) return path
  return '\u2026/' + parts.slice(-2).join('/')
}

/** Human-readable labels for known MCP tools (edu-platform) */
const TOOL_LABELS: Record<string, { active: string; done: string }> = {
  curriculum_tree: { active: '正在查询课程知识树', done: '查询课程知识树' },
  student_proficiency: { active: '正在查询学生掌握情况', done: '查询学生掌握情况' },
  teaching_progress: { active: '正在查询教学进度', done: '查询教学进度' },
  generate_docx: { active: '正在生成教学文档', done: '生成教学文档' },
  write_output: { active: '正在同步到面板', done: '已同步到面板' },
}

/** Get human-readable summary for a tool (backward-compat export) */
export function getToolSummary(name: string, input: unknown): string {
  const stripped = stripMcpPrefix(name)
  const inp = input as Record<string, unknown> | null | undefined

  // MCP labels
  const labels = TOOL_LABELS[stripped]
  if (labels) return labels.done

  switch (stripped) {
    case 'Read':
    case 'Write':
    case 'Edit':
      return inp?.file_path ? shortenPath(String(inp.file_path)) : ''
    case 'Bash':
      return inp?.command ? truncate(String(inp.command), 50) : ''
    case 'Glob':
    case 'Grep':
      return inp?.pattern ? String(inp.pattern) : ''
    case 'write_output':
      return inp?.field ? `${inp.field}` : ''
    case 'Task':
      return inp?.description ? truncate(String(inp.description), 50) : ''
    default:
      return ''
  }
}

/** Comprehensive mapping for ALL known internal/backend tool descriptions → Chinese */
const INTERNAL_LABELS: Record<string, string> = {
  'Executing Skill': '执行技能',
  'Executing Agent': '分析数据',
  'Executing AskUserQuestion': '交互提问',
  'Executing Tool': '调用工具',
  'execute_skill': '执行技能',
  'execute_agent': '分析数据',
  'AskUserQuestion': '交互提问',
  'ask_user_question': '交互提问',
}

/** Clean up backend-provided descriptions — NEVER return raw English */
function cleanDescription(desc: string): string {
  // Strip "Completed: " / "Running: " / "Error: " prefixes
  let cleaned = desc.replace(/^(Completed|Running|Error):\s*/i, '')
  // Check known internal labels (exact match)
  const internal = INTERNAL_LABELS[cleaned.trim()]
  if (internal) return internal
  // Catch-all for "Executing XXX" pattern → generic Chinese label
  if (/^Executing\s/i.test(cleaned)) return '正在处理'
  // Strip action verb prefixes
  cleaned = cleaned.replace(/^(Reading|Writing|Editing|Searching files|Searching content|Running):\s*/i, '')
  // Shorten any absolute file paths in the description
  cleaned = cleaned.replace(/\/[^\s]+/g, (path) => shortenPath(path))
  // Final safety: if result is still all-ASCII (likely technical), return generic label
  if (/^[\x20-\x7E]+$/.test(cleaned) && cleaned.length > 20) return '处理数据'
  return truncate(cleaned, 80)
}

/** Get display text for a tool row — natural language for MCP, contextual for generic */
function getDisplayText(block: ToolUseBlock): string {
  const stripped = stripMcpPrefix(block.toolName)
  const isRunning = block.phase === 'start' || block.phase === 'progress'
  const inp = block.toolInput as Record<string, unknown> | null | undefined

  // 1. MCP tool labels always take priority (human-readable for teachers)
  const labels = TOOL_LABELS[stripped]
  if (labels) {
    const base = isRunning ? labels.active : labels.done
    if ((stripped === 'teaching_progress' || stripped === 'student_proficiency') && inp) {
      const parts: string[] = []
      if (inp.class_id) parts.push(String(inp.class_id))
      if (inp.subject) parts.push(String(inp.subject))
      if (parts.length > 0) return `${base} \u00b7 ${parts.join(' ')}`
    }
    if (stripped === 'curriculum_tree' && inp) {
      const parts: string[] = []
      if (inp.subject) parts.push(String(inp.subject))
      if (inp.grade) parts.push(String(inp.grade))
      if (parts.length > 0) return `${base} \u00b7 ${parts.join(' ')}`
    }
    return base
  }

  // 2. Generate contextual descriptions from input for known generic tools
  switch (stripped) {
    case 'Bash': {
      if (!inp?.command) return '执行命令'
      // Shorten absolute paths in bash command display
      const cmd = String(inp.command).replace(/\/[^\s"']+/g, (p) => {
        const parts = p.split('/')
        return parts.length > 4 ? '\u2026/' + parts.slice(-3).join('/') : p
      })
      return truncate(cmd, 60)
    }
    case 'Read':
      return inp?.file_path ? `读取 ${shortenPath(String(inp.file_path))}` : '读取文件'
    case 'Write':
      return inp?.file_path ? `写入 ${shortenPath(String(inp.file_path))}` : '写入文件'
    case 'Edit':
      return inp?.file_path ? `编辑 ${shortenPath(String(inp.file_path))}` : '编辑文件'
    case 'Glob': {
      if (!inp?.pattern) return '搜索文件'
      const p = String(inp.pattern)
      // Strip absolute path prefix, keep last 3-4 meaningful segments
      const parts = p.split('/')
      if (parts.length > 4) return `搜索文件: \u2026/${parts.slice(-4).join('/')}`
      return `搜索文件: ${p}`
    }
    case 'Grep': {
      if (!inp?.pattern) return '搜索内容'
      const p = String(inp.pattern)
      // If pattern is a path, shorten it
      const parts = p.split('/')
      if (parts.length > 4) return `搜索内容: \u2026/${parts.slice(-4).join('/')}`
      // If pattern contains regex syntax, simplify for display
      if (/[|.*+?\\[\]{}^$()]/.test(p) && p.length > 30) {
        // Extract human-readable words (Chinese or meaningful English)
        const words = p.replace(/[.*+?\\[\]{}^$|()]/g, ' ').split(/\s+/).filter(w => w.length > 1)
        if (words.length > 0) return `搜索内容: ${truncate(words.join(' '), 50)}`
      }
      return `搜索内容: ${truncate(p, 50)}`
    }
    case 'WebFetch':
    case 'WebSearch':
      return '搜索网页'
    case 'Task':
      return inp?.description ? truncate(String(inp.description), 60) : '子任务'
  }

  // 3. Fall back to cleaned backend description
  if (block.description) return cleanDescription(block.description)

  return stripped
}

/** Shorten all absolute paths in a string for readability */
function shortenPathsInText(text: string): string {
  return text.replace(/\/[^\s\n"',]+/g, (path) => {
    const parts = path.split('/')
    if (parts.length <= 3) return path
    return '\u2026/' + parts.slice(-3).join('/')
  })
}

function formatOutput(name: string, output: unknown): string {
  if (output == null) return ''
  const stripped = stripMcpPrefix(name)
  if (stripped === 'write_output') return '\u2713 已同步'

  // For arrays of content blocks (common Agent/Task output), extract text
  if (Array.isArray(output)) {
    const textParts = output
      .filter((item): item is { type: string; text: string } =>
        typeof item === 'object' && item !== null && 'text' in item)
      .map(item => String(item.text))
    if (textParts.length > 0) {
      const combined = textParts.join('\n')
      const text = combined.length > 500 ? combined.slice(0, 500) + '\u2026' : combined
      return shortenPathsInText(text)
    }
  }

  if (typeof output === 'string') {
    const text = output.length > 500 ? output.slice(0, 500) + '\u2026' : output
    return shortenPathsInText(text)
  }
  const json = JSON.stringify(output, null, 2)
  const text = json.length > 500 ? json.slice(0, 500) + '\u2026' : json
  return shortenPathsInText(text)
}

/** Get the label for the input section (matches Claude Web style) */
function getInputLabel(name: string): string {
  const stripped = stripMcpPrefix(name)
  switch (stripped) {
    case 'Bash': return 'bash'
    case 'Read': case 'Write': case 'Edit': return '文件'
    case 'Glob': return '搜索模式'
    case 'Grep': return '搜索'
    default: return '输入'
  }
}

/** Get contextual output label by tool type */
function getOutputLabel(name: string): string {
  const stripped = stripMcpPrefix(name)
  switch (stripped) {
    case 'Bash': return '命令输出'
    case 'Read': return '文件内容'
    case 'Write': case 'Edit': return '操作结果'
    case 'Glob': return '匹配文件'
    case 'Grep': return '搜索结果'
    case 'WebFetch': case 'WebSearch': return '搜索结果'
    default: {
      // MCP tools
      if (TOOL_LABELS[stripped]) return '查询结果'
      return '输出'
    }
  }
}

function formatInput(name: string, input: unknown): string {
  if (input == null) return ''
  if (typeof input !== 'object') return String(input)
  const stripped = stripMcpPrefix(name)
  const inp = input as Record<string, unknown>
  switch (stripped) {
    case 'Bash':
      return String(inp.command ?? '')
    case 'Read':
    case 'Write':
    case 'Edit':
      return String(inp.file_path ?? '')
    case 'Glob':
      return `${inp.pattern ?? '*'}${inp.path ? `  (in ${shortenPath(String(inp.path))})` : ''}`
    case 'Grep':
      return `${inp.pattern ?? ''}${inp.path ? `  (in ${shortenPath(String(inp.path))})` : ''}`
    default: {
      // For skill/agent tools, show simplified format
      if (inp.skill || inp.args) {
        const parts: string[] = []
        if (inp.skill) parts.push(`技能: ${inp.skill}`)
        if (inp.args) parts.push(`参数: ${inp.args}`)
        return parts.join('\n')
      }
      // For Agent/subagent tools, simplify the display
      if (inp.subagent_type || inp.prompt) {
        const parts: string[] = []
        if (inp.description) parts.push(`描述: ${truncate(String(inp.description), 80)}`)
        if (inp.subagent_type) parts.push(`类型: ${inp.subagent_type}`)
        if (inp.prompt && !inp.description) parts.push(`指令: ${truncate(String(inp.prompt), 120)}`)
        return parts.join('\n')
      }
      // For MCP tools, show key-value pairs in Chinese-friendly format
      const entries = Object.entries(inp).filter(([, v]) => v != null)
      if (entries.length <= 5) {
        return entries.map(([k, v]) => {
          const val = typeof v === 'string' ? v : JSON.stringify(v)
          return `${k}: ${truncate(val, 80)}`
        }).join('\n')
      }
      return JSON.stringify(input, null, 2)
    }
  }
}

// ===== Category Badges (colored letter badges per design doc) =====
// 紫色 M = MCP 调用, 蓝色 AI = Agent/LLM 工具, 绿色 F = 文件操作

type ToolCategory = 'mcp' | 'ai' | 'file'

function getToolCategory(name: string): ToolCategory {
  const stripped = stripMcpPrefix(name)
  // MCP tools (domain-specific)
  if (name.startsWith('mcp__')) return 'mcp'
  if (['curriculum_tree', 'student_proficiency', 'teaching_progress', 'write_output'].includes(stripped)) return 'mcp'
  // File operations
  if (['Read', 'Write', 'Edit', 'generate_docx'].includes(stripped)) return 'file'
  // Everything else = AI/agent activity
  return 'ai'
}

const BADGE_STYLES: Record<ToolCategory, { bg: string; text: string; letter: string }> = {
  mcp:  { bg: 'bg-purple-100', text: 'text-purple-600', letter: 'M' },
  ai:   { bg: 'bg-blue-100',   text: 'text-blue-600',   letter: 'AI' },
  file: { bg: 'bg-emerald-100', text: 'text-emerald-600', letter: 'F' },
}

function CategoryBadge({ name }: { name: string }) {
  const cat = getToolCategory(name)
  const style = BADGE_STYLES[cat]
  return (
    <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold leading-none flex-shrink-0 ${style.bg} ${style.text}`}>
      {style.letter}
    </span>
  )
}

function StatusIndicator({ block }: { block: ToolUseBlock }) {
  const isRunning = block.phase === 'start' || block.phase === 'progress'

  if (isRunning) {
    return (
      <span className="inline-block w-3.5 h-3.5 border-[1.5px] border-ck-t3 border-t-transparent rounded-full animate-spin flex-shrink-0" />
    )
  }

  if (block.success === false) {
    return (
      <svg className="w-3.5 h-3.5 text-red-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    )
  }

  if (block.phase === 'end') {
    return (
      <svg className="w-3.5 h-3.5 text-ck-success-t flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    )
  }

  return null
}

/** Expanded detail area — gray bg block with labeled sections (matches Claude Web) */
function ExpandedDetail({ block }: { block: ToolUseBlock }) {
  const stripped = stripMcpPrefix(block.toolName)
  const isBash = stripped === 'Bash'
  const inputLabel = getInputLabel(block.toolName)
  const inputText = formatInput(block.toolName, block.toolInput)
  const outputText = formatOutput(block.toolName, block.toolOutput)
  const outputLabel = getOutputLabel(block.toolName)
  const hasInput = inputText.length > 0
  const hasOutput = outputText.length > 0

  return (
    <div className="mt-1.5 rounded-lg bg-ck-bg3 overflow-hidden text-xs">
      {hasInput && (
        <div className="px-3 py-2">
          <div className="text-ck-t3 text-[11px] font-medium mb-1">
            {inputLabel}
          </div>
          <pre className={`whitespace-pre-wrap break-all font-mono text-[12px] leading-relaxed ${
            isBash ? 'text-ck-t1' : 'text-ck-t2'
          }`}>
            {inputText}
          </pre>
        </div>
      )}
      {block.toolError && (
        <div className={`px-3 py-2 ${hasInput ? 'border-t border-ck-b2' : ''}`}>
          <div className="text-red-500 text-[11px] font-medium mb-1">错误</div>
          <pre className="whitespace-pre-wrap break-all font-mono text-[12px] text-red-600 leading-relaxed">
            {block.toolError}
          </pre>
        </div>
      )}
      {hasOutput && !block.toolError && (
        <div className={`px-3 py-2 ${hasInput ? 'border-t border-ck-b2' : ''}`}>
          <div className="text-ck-t3 text-[11px] font-medium mb-1">{outputLabel}</div>
          <pre className="whitespace-pre-wrap break-all font-mono text-[12px] text-ck-t2 leading-relaxed max-h-[200px] overflow-y-auto">
            {outputText}
          </pre>
        </div>
      )}
    </div>
  )
}

// ===== Main Component =====

interface ToolActivityBlockProps {
  block: ToolUseBlock
}

export function ToolActivityBlock({ block }: ToolActivityBlockProps) {
  const [expanded, setExpanded] = useState(false)
  const { toolRenderers } = useChatInterfaceContext()

  const stripped = stripMcpPrefix(block.toolName)

  // Check for solution-provided custom renderer
  const customRenderer = toolRenderers[stripped] ?? toolRenderers[block.toolName]
  if (customRenderer) {
    const result = customRenderer(block)
    if (result) return <>{result}</>
  }

  const displayText = getDisplayText(block)
  const hasDetails = block.toolInput != null || block.toolOutput != null || block.toolError

  return (
    <div className="py-0.5">
      {/* Inline row — no border, no background, matching text rhythm */}
      <div
        className={`flex items-center gap-2 py-0.5 ${
          hasDetails ? 'cursor-pointer' : ''
        }`}
        onClick={() => hasDetails && setExpanded(!expanded)}
      >
        {/* Expand chevron */}
        {hasDetails && (
          <svg
            className={`w-3 h-3 text-ck-t3 transition-transform duration-150 flex-shrink-0 ${expanded ? 'rotate-90' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        )}
        {!hasDetails && <span className="w-3 flex-shrink-0" />}

        {/* Category badge */}
        <CategoryBadge name={block.toolName} />

        {/* Description text — same size as AI text (14px) for visual rhythm */}
        <span className="text-ck-t2 text-[14px] leading-[1.6] truncate">{displayText}</span>

        {/* Spacer */}
        <span className="flex-1" />

        {/* Status indicator */}
        <StatusIndicator block={block} />
      </div>

      {/* Expanded detail area */}
      {expanded && hasDetails && (
        <div className="ml-[38px]">
          <ExpandedDetail block={block} />
        </div>
      )}
    </div>
  )
}
