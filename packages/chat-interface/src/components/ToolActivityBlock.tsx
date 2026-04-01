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
  let cleaned = desc.replace(/^(Completed|Running|Error):\s*/i, '')
  const internal = INTERNAL_LABELS[cleaned.trim()]
  if (internal) return internal
  if (/^Executing\s/i.test(cleaned)) return '正在处理'
  cleaned = cleaned.replace(/^(Reading|Writing|Editing|Searching files|Searching content|Running):\s*/i, '')
  cleaned = cleaned.replace(/\/[^\s]+/g, (path) => shortenPath(path))
  if (/^[\x20-\x7E]+$/.test(cleaned) && cleaned.length > 20) return '处理数据'
  return truncate(cleaned, 80)
}

/** Get display text for a tool row */
function getDisplayText(block: ToolUseBlock): string {
  const stripped = stripMcpPrefix(block.toolName)
  const isRunning = block.phase === 'start' || block.phase === 'progress'
  const inp = block.toolInput as Record<string, unknown> | null | undefined

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

  switch (stripped) {
    case 'Bash': {
      if (!inp?.command) return '执行命令'
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
      const parts = p.split('/')
      if (parts.length > 4) return `搜索文件: \u2026/${parts.slice(-4).join('/')}`
      return `搜索文件: ${p}`
    }
    case 'Grep': {
      if (!inp?.pattern) return '搜索内容'
      const p = String(inp.pattern)
      const parts = p.split('/')
      if (parts.length > 4) return `搜索内容: \u2026/${parts.slice(-4).join('/')}`
      if (/[|.*+?\\[\]{}^$()]/.test(p) && p.length > 30) {
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

// ===== Step Icon (semantic colored circle with SVG — matches prototype) =====

type StepCategory = 'mcp' | 'ai' | 'file' | 'done'

function getStepCategory(block: ToolUseBlock): StepCategory {
  if (block.phase === 'end' && block.success !== false) return 'done'
  const stripped = stripMcpPrefix(block.toolName)
  if (block.toolName.startsWith('mcp__')) return 'mcp'
  if (['curriculum_tree', 'student_proficiency', 'teaching_progress', 'write_output', 'generate_docx'].includes(stripped)) return 'mcp'
  if (['Read', 'Write', 'Edit', 'Glob', 'Grep'].includes(stripped)) return 'file'
  return 'ai'
}

const STEP_ICON_STYLES: Record<StepCategory, { bg: string; color: string }> = {
  mcp:  { bg: 'bg-ck-purple-bg', color: 'text-ck-purple-t' },
  file: { bg: 'bg-ck-purple-bg', color: 'text-ck-purple-t' },
  ai:   { bg: 'bg-ck-info-bg',   color: 'text-ck-info-t'   },
  done: { bg: 'bg-ck-success-bg', color: 'text-ck-success-t' },
}

function StepIcon({ block }: { block: ToolUseBlock }) {
  const isRunning = block.phase === 'start' || block.phase === 'progress'
  if (isRunning) {
    return (
      <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-ck-info-bg flex-shrink-0">
        <span className="inline-block w-[11px] h-[11px] border-[1.5px] border-ck-info-t border-t-transparent rounded-full animate-spin" />
      </span>
    )
  }

  if (block.success === false) {
    return (
      <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-ck-danger-bg flex-shrink-0">
        <svg className="w-[11px] h-[11px] text-ck-danger-t" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="4" y1="4" x2="12" y2="12" /><line x1="12" y1="4" x2="4" y2="12" />
        </svg>
      </span>
    )
  }

  const cat = getStepCategory(block)
  const style = STEP_ICON_STYLES[cat]

  return (
    <span className={`inline-flex items-center justify-center w-[18px] h-[18px] rounded-full flex-shrink-0 ${style.bg}`}>
      {cat === 'done' ? (
        <svg className={`w-[11px] h-[11px] ${style.color}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M13.5 4.5l-7 7L3 8" />
        </svg>
      ) : cat === 'ai' ? (
        <svg className={`w-[11px] h-[11px] ${style.color}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="8" cy="8" r="6" /><path d="M8 4v4l3 2" />
        </svg>
      ) : (
        <svg className={`w-[11px] h-[11px] ${style.color}`} viewBox="0 0 16 16" fill="currentColor" stroke="none">
          <path d="M4 1h5.5L14 5.5V14a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1z" /><path d="M9 1v4h4" fill="none" stroke="currentColor" strokeWidth="1" />
        </svg>
      )}
    </span>
  )
}

// ===== Table/JSON Tabbed Detail (Layer 3) =====

/** Parse input/output into key-value pairs for table view */
function toKeyValuePairs(data: unknown): Array<{ key: string; value: string }> {
  if (data == null) return []
  if (typeof data === 'string') return [{ key: 'value', value: data.length > 200 ? data.slice(0, 200) + '\u2026' : data }]
  if (Array.isArray(data)) {
    const textParts = data
      .filter((item): item is { type: string; text: string } =>
        typeof item === 'object' && item !== null && 'text' in item)
      .map(item => String(item.text))
    if (textParts.length > 0) return [{ key: 'text', value: truncate(textParts.join('\n'), 300) }]
    return [{ key: 'items', value: truncate(JSON.stringify(data), 300) }]
  }
  if (typeof data === 'object') {
    return Object.entries(data as Record<string, unknown>)
      .filter(([, v]) => v != null)
      .slice(0, 15)
      .map(([k, v]) => ({
        key: k,
        value: typeof v === 'string' ? truncate(v, 200) : truncate(JSON.stringify(v), 200),
      }))
  }
  return [{ key: 'value', value: String(data) }]
}

function formatJsonBlock(name: string, input: unknown, output: unknown): string {
  const parts: string[] = []
  if (input != null) {
    parts.push('// Request')
    parts.push(typeof input === 'string' ? input : JSON.stringify(input, null, 2))
  }
  if (output != null) {
    if (parts.length > 0) parts.push('')
    parts.push('// Response')
    if (typeof output === 'string') {
      parts.push(shortenPathsInText(output.length > 600 ? output.slice(0, 600) + '\u2026' : output))
    } else if (Array.isArray(output)) {
      const textParts = output
        .filter((item): item is { type: string; text: string } =>
          typeof item === 'object' && item !== null && 'text' in item)
        .map(item => String(item.text))
      if (textParts.length > 0) {
        parts.push(shortenPathsInText(truncate(textParts.join('\n'), 600)))
      } else {
        const json = JSON.stringify(output, null, 2)
        parts.push(shortenPathsInText(json.length > 600 ? json.slice(0, 600) + '\u2026' : json))
      }
    } else {
      const json = JSON.stringify(output, null, 2)
      parts.push(shortenPathsInText(json.length > 600 ? json.slice(0, 600) + '\u2026' : json))
    }
  }
  return parts.join('\n')
}

function KVTable({ pairs, label }: { pairs: Array<{ key: string; value: string }>; label: string }) {
  if (pairs.length === 0) return null
  return (
    <>
      <div className="text-[10px] font-medium text-ck-t3 py-1.5 uppercase tracking-wider">{label}</div>
      <table className="w-full border-collapse text-[10px] my-0.5">
        <thead>
          <tr>
            <th className="text-left px-2 py-1 bg-ck-bg2 text-ck-t2 font-medium border-b-[0.5px] border-ck-b1">Key</th>
            <th className="text-left px-2 py-1 bg-ck-bg2 text-ck-t2 font-medium border-b-[0.5px] border-ck-b1">Value</th>
          </tr>
        </thead>
        <tbody>
          {pairs.map((p, i) => (
            <tr key={i}>
              <td className="px-2 py-1 border-b-[0.5px] border-ck-b2 text-ck-t2 w-[110px] align-top">{p.key}</td>
              <td className="px-2 py-1 border-b-[0.5px] border-ck-b2 font-mono text-[10px] text-ck-t1 break-all">{p.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function TabbedDetail({ block }: { block: ToolUseBlock }) {
  const [activeTab, setActiveTab] = useState<'table' | 'json'>('table')

  const inputPairs = toKeyValuePairs(block.toolInput)
  const outputPairs = toKeyValuePairs(block.toolOutput)
  const jsonText = formatJsonBlock(block.toolName, block.toolInput, block.toolOutput)

  return (
    <div className="mt-1.5" onClick={e => e.stopPropagation()}>
      {/* Tab bar */}
      <div className="inline-flex gap-0.5 bg-ck-bg2 rounded-md p-0.5 mb-1">
        <button
          className={`px-2.5 py-[3px] text-[10px] font-medium rounded cursor-pointer border-none transition-all duration-100 ${
            activeTab === 'table'
              ? 'bg-ck-bg1 text-ck-t1 shadow-[0_0.5px_2px_rgba(0,0,0,0.08)]'
              : 'bg-transparent text-ck-t3 hover:text-ck-t2'
          }`}
          onClick={() => setActiveTab('table')}
        >
          Table
        </button>
        <button
          className={`px-2.5 py-[3px] text-[10px] font-medium rounded cursor-pointer border-none transition-all duration-100 ${
            activeTab === 'json'
              ? 'bg-ck-bg1 text-ck-t1 shadow-[0_0.5px_2px_rgba(0,0,0,0.08)]'
              : 'bg-transparent text-ck-t3 hover:text-ck-t2'
          }`}
          onClick={() => setActiveTab('json')}
        >
          JSON
        </button>
      </div>

      {/* Table pane */}
      {activeTab === 'table' && (
        <div>
          {inputPairs.length > 0 && <KVTable pairs={inputPairs} label="Request" />}
          {outputPairs.length > 0 && <KVTable pairs={outputPairs} label="Response" />}
          {block.toolError && (
            <div className="text-[10px] text-ck-danger-t py-1">{block.toolError}</div>
          )}
        </div>
      )}

      {/* JSON pane */}
      {activeTab === 'json' && (
        <pre className="bg-ck-bg2 px-2.5 py-2 rounded-md font-mono text-[10px] overflow-x-auto whitespace-pre-wrap text-ck-t1 leading-relaxed my-1 max-h-[300px] overflow-y-auto">
          {block.toolError ? `// Error\n${block.toolError}` : jsonText}
        </pre>
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
  const durationMs = block.duration

  return (
    <div className="flex gap-2.5 py-1.5" style={{ borderBottom: '0.5px solid var(--b2)' }}>
      {/* Step icon */}
      <StepIcon block={block} />

      {/* Step content */}
      <div className="flex-1 min-w-0">
        <div
          className={`text-[12px] text-ck-t1 leading-relaxed rounded px-1 -mx-1 transition-colors duration-100 ${
            hasDetails ? 'cursor-pointer hover:bg-ck-bg2' : ''
          }`}
          onClick={(e) => { e.stopPropagation(); hasDetails && setExpanded(!expanded) }}
        >
          {displayText}
          {stripped && (
            <span className="text-ck-t3 font-mono text-[10px] ml-1">{stripped}</span>
          )}
        </div>

        {/* Layer 3: Table/JSON detail */}
        {expanded && hasDetails && (
          <TabbedDetail block={block} />
        )}
      </div>

      {/* Duration */}
      {durationMs != null && durationMs > 0 && (
        <span className="text-[10px] text-ck-t3 flex-shrink-0 mt-0.5">
          {durationMs >= 1000 ? `${(durationMs / 1000).toFixed(1)}s` : `${durationMs}ms`}
        </span>
      )}
    </div>
  )
}
