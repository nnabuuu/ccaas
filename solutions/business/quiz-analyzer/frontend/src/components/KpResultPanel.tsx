/**
 * KP Result Panel - Displays KpRefinementResult with tags, traversal type, and trace
 */

import { useState, useCallback } from 'react'
import { Tag, TreeStructure, CaretDown, CaretRight, ClipboardText, Check } from '@phosphor-icons/react'
import type { KpRefinementResult, KpRefinementTag } from '../types'

// --- Sub-components ---

function TagCard({ tag }: { tag: KpRefinementTag }) {
  const roleBadge = {
    primary: { bg: 'bg-ck-info-bg', text: 'text-ck-info-t', label: '主' },
    secondary: { bg: 'bg-ck-bg2', text: 'text-ck-t2', label: '次' },
    tertiary: { bg: 'bg-ck-bg2', text: 'text-ck-t2', label: '辅' },
  }[tag.role]

  const confidenceColor =
    tag.confidence >= 0.9 ? 'bg-green-500' :
    tag.confidence >= 0.8 ? 'bg-blue-500' :
    tag.confidence >= 0.75 ? 'bg-amber-500' :
    'bg-red-500'

  const confidenceTextColor =
    tag.confidence >= 0.9 ? 'text-ck-success-t' :
    tag.confidence >= 0.8 ? 'text-ck-info-t' :
    tag.confidence >= 0.75 ? 'text-ck-warn-t' :
    'text-ck-danger-t'

  return (
    <div className="ck-card !p-4 !cursor-default hover:!scale-100">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Tag weight="fill" className="w-4 h-4 text-ck-accent" />
          <span className="font-medium text-sm text-ck-t1">{tag.name}</span>
        </div>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${roleBadge.bg} ${roleBadge.text}`}>
          {roleBadge.label}
        </span>
      </div>
      <div className="text-[11px] text-ck-t3 mb-2 font-mono">{tag.id}</div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-ck-bg2 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${confidenceColor}`}
            style={{ width: `${tag.confidence * 100}%` }}
          />
        </div>
        <span className={`text-xs font-semibold ${confidenceTextColor}`}>
          {(tag.confidence * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  )
}

function TraversalTypeBadge({ type }: { type: string }) {
  const base = type.replace(/\+multi_tag$/, '')
  const hasMulti = type.includes('+multi_tag')

  const colorMap: Record<string, { bg: string; text: string }> = {
    sibling_validated: { bg: 'bg-ck-success-bg', text: 'text-ck-success-t' },
    sibling_replaced: { bg: 'bg-ck-warn-bg', text: 'text-ck-warn-t' },
    ascend_confirmed: { bg: 'bg-ck-info-bg', text: 'text-ck-info-t' },
    branch_switched: { bg: 'bg-ck-danger-bg', text: 'text-ck-danger-t' },
  }

  const style = colorMap[base] || { bg: 'bg-ck-bg2', text: 'text-ck-t2' }

  return (
    <div className="flex items-center gap-1.5">
      <TreeStructure weight="fill" className={`w-4 h-4 ${style.text}`} />
      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${style.bg} ${style.text}`}>
        {TRAVERSAL_LABELS[base] || base.replace(/_/g, ' ')}
      </span>
      {hasMulti && (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-ck-accent/10 text-ck-accent">
          +multi_tag
        </span>
      )}
    </div>
  )
}

// --- Trace Step Renderers ---

const STEP_META: Record<string, { title: string; desc: string }> = {
  step0: {
    title: '题意分析',
    desc: '分析题目考查的核心技能和关键操作，提取搜索关键词',
  },
  step1: {
    title: '兄弟验证',
    desc: '在锚点的同级节点中逐一比对，评估哪个最匹配题目核心技能',
  },
  step2: {
    title: '上溯确认',
    desc: '置信度不足时向上一层查看其他分支，确认或切换到更匹配的分支',
  },
  step3: {
    title: '标签决策',
    desc: '判断是否需要补充标签以覆盖题目涉及的多个独立技能点',
  },
  result: {
    title: '最终结果',
    desc: '',
  },
}

const DECISION_META: Record<string, { label: string; tip: string }> = {
  accept:     { label: '确认', tip: '锚点节点置信度 ≥ 0.85，直接采用' },
  escalate:   { label: '上溯', tip: '置信度 < 0.85，需向上层确认分支正确性' },
  switch:     { label: '切换', tip: '发现同级中有更匹配的节点，切换锚点' },
  single_tag: { label: '单标签', tip: '一个知识点即可覆盖题目所有核心技能' },
  multi_tag:  { label: '多标签', tip: '题目涉及多个独立技能点，需补充标签' },
}

const TRAVERSAL_LABELS: Record<string, string> = {
  sibling_validated: '同级确认',
  sibling_replaced:  '同级替换',
  ascend_confirmed:  '上溯确认',
  branch_switched:   '分支切换',
}

function ConfidenceBar({ value }: { value: number }) {
  const color =
    value >= 0.9 ? 'bg-green-500' :
    value >= 0.8 ? 'bg-blue-500' :
    value >= 0.75 ? 'bg-amber-500' :
    'bg-red-500'
  const textColor =
    value >= 0.9 ? 'text-ck-success-t' :
    value >= 0.8 ? 'text-ck-info-t' :
    value >= 0.75 ? 'text-ck-warn-t' :
    'text-ck-danger-t'

  const confidenceLabel =
    value >= 0.95 ? '明确匹配' :
    value >= 0.85 ? '语义匹配' :
    value >= 0.75 ? '多候选' :
    '不确定'

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-ck-t2 shrink-0">置信度</span>
      <div className="flex-1 h-1.5 bg-ck-bg2 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value * 100}%` }} />
      </div>
      <span className={`text-xs font-semibold ${textColor}`}>{(value * 100).toFixed(0)}%</span>
      <span className="text-[10px] text-ck-t3 ml-1">{confidenceLabel}</span>
    </div>
  )
}

function DecisionBadge({ decision }: { decision: string }) {
  const styles: Record<string, { bg: string; text: string }> = {
    accept: { bg: 'bg-ck-success-bg', text: 'text-ck-success-t' },
    escalate: { bg: 'bg-ck-warn-bg', text: 'text-ck-warn-t' },
    switch: { bg: 'bg-ck-danger-bg', text: 'text-ck-danger-t' },
    single_tag: { bg: 'bg-ck-info-bg', text: 'text-ck-info-t' },
    multi_tag: { bg: 'bg-ck-accent/10', text: 'text-ck-accent' },
  }
  const s = styles[decision] || { bg: 'bg-ck-bg2', text: 'text-ck-t2' }
  const meta = DECISION_META[decision]
  return (
    <div className="flex items-center gap-2">
      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
        {meta?.label || decision}
      </span>
      {meta?.tip && (
        <span className="text-[11px] text-ck-t3">{meta.tip}</span>
      )}
    </div>
  )
}

function Pills({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <span key={i} className="text-[11px] px-2 py-0.5 bg-ck-bg2 text-ck-t2 rounded-full">
          {item}
        </span>
      ))}
    </div>
  )
}

/** Safely convert a trace value to a renderable string (handles {id, name} objects) */
function toLabel(val: unknown): string {
  if (typeof val === 'string') return val
  if (typeof val === 'number' || typeof val === 'boolean') return String(val)
  if (val && typeof val === 'object' && 'name' in val) return String((val as Record<string, unknown>).name)
  return JSON.stringify(val)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function StepContent({ stepKey, data }: { stepKey: string; data: any }) {
  if (!data || typeof data !== 'object') {
    return <pre className="text-[11px] text-ck-t2 bg-ck-bg2 rounded-ck p-3 whitespace-pre-wrap break-words">{JSON.stringify(data, null, 2)}</pre>
  }

  switch (stepKey) {
    case 'step0':
      return (
        <div className="space-y-2">
          {data.coreSkill && (
            <div className="text-sm"><span className="font-semibold text-ck-t1">核心技能：</span>{toLabel(data.coreSkill)}</div>
          )}
          {data.summary && <div className="text-[13px] text-ck-t2">{toLabel(data.summary)}</div>}
          {data.keyOperation && (
            <div className="text-[12px] text-ck-t2"><span className="font-medium">关键操作：</span>{toLabel(data.keyOperation)}</div>
          )}
          {Array.isArray(data.requiredSkills) && data.requiredSkills.length > 0 && (
            <div>
              <span className="text-[11px] text-ck-t3 block mb-1">所需技能</span>
              <Pills items={data.requiredSkills.map((s: unknown) => typeof s === 'string' ? s : JSON.stringify(s))} />
            </div>
          )}
        </div>
      )

    case 'step1':
      return (
        <div className="space-y-2">
          {data.parentNode && (
            <div className="text-sm"><span className="font-medium text-ck-t2">父节点：</span><span className="text-ck-t1">{toLabel(data.parentNode)}</span></div>
          )}
          {Array.isArray(data.siblings) && data.siblings.length > 0 && (
            <div>
              <span className="text-[11px] text-ck-t3 block mb-1">兄弟节点</span>
              <Pills items={data.siblings.map((s: unknown) => typeof s === 'string' ? s : JSON.stringify(s))} />
            </div>
          )}
          {data.confidence != null && <ConfidenceBar value={data.confidence} />}
          {data.decision && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-ck-t2">决策</span>
              <DecisionBadge decision={toLabel(data.decision)} />
            </div>
          )}
          {data.drillDown && typeof data.drillDown === 'object' && (
            <div className="bg-ck-bg2 rounded-ck p-2.5 text-[11px] text-ck-t2">
              <span className="font-medium block mb-1">钻探详情</span>
              <pre className="whitespace-pre-wrap break-words">{JSON.stringify(data.drillDown, null, 2)}</pre>
            </div>
          )}
        </div>
      )

    case 'step2':
      return (
        <div className="space-y-2">
          {data.grandparentNode && (
            <div className="text-sm"><span className="font-medium text-ck-t2">祖父节点：</span><span className="text-ck-t1">{toLabel(data.grandparentNode)}</span></div>
          )}
          {data.selectedBranch && (
            <div className="text-sm"><span className="font-medium text-ck-t2">选中分支：</span><span className="text-ck-t1">{toLabel(data.selectedBranch)}</span></div>
          )}
          {data.confidence != null && <ConfidenceBar value={data.confidence} />}
          {data.decision && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-ck-t2">决策</span>
              <DecisionBadge decision={toLabel(data.decision)} />
            </div>
          )}
        </div>
      )

    case 'step3':
      return (
        <div className="space-y-2">
          {data.decision && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-ck-t2">决策</span>
              <DecisionBadge decision={toLabel(data.decision)} />
            </div>
          )}
          {Array.isArray(data.supplementaryTags) && data.supplementaryTags.length > 0 && (
            <div>
              <span className="text-[11px] text-ck-t3 block mb-1">补充标签</span>
              <Pills items={data.supplementaryTags.map((t: unknown) =>
                typeof t === 'string' ? t : JSON.stringify(t)
              )} />
            </div>
          )}
          {Array.isArray(data.skillCoverage) && data.skillCoverage.length > 0 && (
            <div>
              <span className="text-[11px] text-ck-t3 block mb-1">技能覆盖</span>
              <Pills items={data.skillCoverage.map((sc: unknown) =>
                typeof sc === 'string' ? sc :
                sc && typeof sc === 'object' && 'skill' in sc ? String((sc as Record<string, unknown>).skill) :
                JSON.stringify(sc)
              )} />
            </div>
          )}
        </div>
      )

    case 'result':
      return (
        <div className="space-y-2">
          {data.traversalType && <TraversalTypeBadge type={data.traversalType} />}
          {data.tagCount != null && (
            <div className="text-sm text-ck-t2">共 <span className="font-semibold">{data.tagCount}</span> 个标签</div>
          )}
          {Array.isArray(data.tags) && data.tags.length > 0 && (
            <div>
              <span className="text-[11px] text-ck-t3 block mb-1">匹配标签</span>
              <Pills items={data.tags.map((t: string | { name?: string; id?: string }) => typeof t === 'string' ? t : (t.name || t.id || JSON.stringify(t)))} />
            </div>
          )}
        </div>
      )

    default:
      return (
        <pre className="text-[11px] text-ck-t2 bg-ck-bg2 rounded-ck p-3 overflow-x-auto max-h-48 whitespace-pre-wrap break-words">
          {JSON.stringify(data, null, 2)}
        </pre>
      )
  }
}

function TracePanel({ trace }: { trace: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false)

  // Sort trace keys to show step0, step1, ... , result in order
  const keys = Object.keys(trace).sort((a, b) => {
    if (a === 'result') return 1
    if (b === 'result') return -1
    return a.localeCompare(b, undefined, { numeric: true })
  })

  return (
    <div className="border border-ck-b1 rounded-ck-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-ck-t1 hover:bg-ck-bg2 transition-colors duration-200 ease-claude"
      >
        {expanded ? (
          <CaretDown weight="bold" className="w-4 h-4" />
        ) : (
          <CaretRight weight="bold" className="w-4 h-4" />
        )}
        搜索轨迹 ({keys.length} 步)
      </button>

      {expanded && (
        <div className="border-t border-ck-b1 px-4 py-3">
          <div className="relative pl-4">
            {/* Timeline line */}
            <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-ck-b1" />

            {keys.map((key, i) => (
              <div key={key} className="relative mb-4 last:mb-0">
                {/* Timeline dot */}
                <div className={`absolute -left-[1px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                  key === 'result' ? 'bg-ck-success-t' : 'bg-ck-accent'
                }`} />

                <div className="ml-5">
                  {(() => {
                    const meta = STEP_META[key]
                    return (
                      <div className="mb-1.5">
                        <div className="text-xs font-semibold text-ck-t2">
                          {key === 'result' ? '最终结果' : `第 ${i} 步 — ${meta?.title || key}`}
                        </div>
                        {meta?.desc && (
                          <div className="text-[11px] text-ck-t3 mt-0.5">{meta.desc}</div>
                        )}
                      </div>
                    )
                  })()}
                  <StepContent stepKey={key} data={trace[key]} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// --- Main Component ---

interface KpResultPanelProps {
  result: KpRefinementResult
}

export default function KpResultPanel({ result }: KpResultPanelProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyTags = useCallback(async () => {
    const tsv = result.tags
      .map((t) => `${t.name}\t${t.id}\t${(t.confidence * 100).toFixed(0)}%\t${t.role}`)
      .join('\n')
    await navigator.clipboard.writeText(tsv)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [result.tags])

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header row: traversal type + tag count + copy button */}
      <div className="flex items-center justify-between">
        <TraversalTypeBadge type={result.traversalType} />
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopyTags}
            className="flex items-center gap-1.5 text-xs text-ck-t2 hover:text-ck-accent transition-colors duration-200 ease-claude"
          >
            {copied ? (
              <>
                <Check weight="bold" className="w-3.5 h-3.5 text-ck-success-t" />
                <span className="text-ck-success-t">已复制</span>
              </>
            ) : (
              <>
                <ClipboardText weight="regular" className="w-3.5 h-3.5" />
                <span>复制标签</span>
              </>
            )}
          </button>
          <span className="text-xs text-ck-t3">
            {result.tagCount} 个知识点标签
          </span>
        </div>
      </div>

      {/* Tags */}
      <div className="grid gap-3 sm:grid-cols-2">
        {result.tags.map((tag) => (
          <TagCard key={tag.id} tag={tag} />
        ))}
      </div>

      {/* Trace */}
      {result.trace && Object.keys(result.trace).length > 0 && (
        <TracePanel trace={result.trace} />
      )}
    </div>
  )
}
