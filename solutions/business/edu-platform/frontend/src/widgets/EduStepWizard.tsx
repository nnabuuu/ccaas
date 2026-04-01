import { useState, useCallback } from 'react'
import type { WidgetComponentProps } from '@kedge-agentic/chat-interface'

// ─── Types ─────────────────────────────────────────────────

interface FormField {
  key: string
  label: string
  type: 'select'
  options: Array<{ label: string; value: string; selected?: boolean }>
}

interface TreeItem {
  id: string
  label: string
  children?: TreeItem[]
}

interface GapItem {
  kp: string
  rate: number
}

interface EduStepWizardProps {
  title: string
  submit_action: string
  submit_label?: string
  steps: string[]
  fields?: FormField[]
  tree?: TreeItem[]
  gaps?: GapItem[]
  summary_rows?: Array<{ label: string; value: string }>
}

type StepWizardState = {
  currentStep: number
  formData: Record<string, string>
  selectedChapters: string[]
  emphasisFlags: Record<string, boolean>
}

// ─── Sub-components ────────────────────────────────────────

function StepIndicator({
  steps,
  current,
  onGo,
}: {
  steps: string[]
  current: number
  onGo: (i: number) => void
}) {
  return (
    <div className="flex gap-1 mb-4">
      {steps.map((label, i) => (
        <button
          key={i}
          onClick={() => i <= current && onGo(i)}
          className={`flex-1 text-center py-2 text-[11px] border-b-[2.5px] transition-colors cursor-pointer ${
            i === current
              ? 'text-[var(--t1)] font-semibold border-[var(--t1)]'
              : i < current
                ? 'text-[var(--success-t)] border-[var(--success-t)]'
                : 'text-[var(--t3)] border-[var(--b2)] cursor-default'
          }`}
        >
          {i < current ? '\u2713 ' : ''}
          {label}
        </button>
      ))}
    </div>
  )
}

function FormPanel({
  fields,
  formData,
  onFieldChange,
  onNext,
}: {
  fields: FormField[]
  formData: Record<string, string>
  onFieldChange: (key: string, value: string) => void
  onNext: () => void
}) {
  return (
    <div>
      {/* Render fields in rows of 2-3 */}
      {(() => {
        const rows: FormField[][] = []
        let row: FormField[] = []
        for (const f of fields) {
          row.push(f)
          if (row.length === 3 || f === fields[fields.length - 1]) {
            rows.push([...row])
            row = []
          }
        }
        if (row.length > 0) rows.push(row)
        return rows.map((r, ri) => (
          <div key={ri} className="flex gap-2.5 mb-3">
            {r.map((f) => (
              <div key={f.key} className="flex-1">
                <div className="text-[11px] text-[var(--t2)] mb-1 font-medium">{f.label}</div>
                <select
                  className="w-full px-2.5 py-2 border-[0.5px] border-[var(--b1)] rounded-md text-[12px] bg-[var(--bg1)] text-[var(--t1)] outline-none focus:border-[var(--info-t)]"
                  value={formData[f.key] ?? f.options.find((o) => o.selected)?.value ?? f.options[0]?.value ?? ''}
                  onChange={(e) => onFieldChange(f.key, e.target.value)}
                >
                  {f.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        ))
      })()}
      <div className="flex justify-end mt-3.5">
        <button
          onClick={onNext}
          className="text-[12px] px-4 py-[7px] rounded-[var(--r)] bg-[var(--t1)] text-[var(--bg1)] border-[0.5px] border-[var(--t1)] cursor-pointer transition-colors hover:opacity-90 active:scale-[0.98]"
        >
          {'\u2192'} 下一步
        </button>
      </div>
    </div>
  )
}

function TreePanel({
  items,
  selected,
  onToggle,
  onPrev,
  onNext,
}: {
  items: TreeItem[]
  selected: string[]
  onToggle: (id: string) => void
  onPrev: () => void
  onNext: () => void
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div>
      <div className="border-[0.5px] border-[var(--b1)] rounded-[var(--rl)] px-3.5 py-2.5 max-h-[200px] overflow-y-auto text-[12px] text-[var(--t2)]">
        {items.map((chapter) => (
          <div key={chapter.id}>
            <div
              className="py-[3px] font-medium cursor-pointer hover:text-[var(--t1)]"
              onClick={() => toggleCollapse(chapter.id)}
            >
              {collapsed[chapter.id] ? '\u25B6' : '\u25BC'} {chapter.label}
            </div>
            {!collapsed[chapter.id] &&
              chapter.children?.map((section) => {
                const isOn = selected.includes(section.id)
                return (
                  <div
                    key={section.id}
                    className={`pl-[18px] py-[3px] cursor-pointer ${
                      isOn ? 'text-[var(--t1)] font-semibold' : ''
                    }`}
                    onClick={() => onToggle(section.id)}
                  >
                    {isOn ? '\u2611' : '\u2610'} {section.label}
                  </div>
                )
              })}
          </div>
        ))}
      </div>
      {selected.length > 0 && (
        <div className="text-[11px] text-[var(--t3)] mt-1.5">
          已选: {selected.join(', ')}
        </div>
      )}
      <div className="flex gap-2 justify-end mt-3.5">
        <button
          onClick={onPrev}
          className="text-[12px] px-4 py-[7px] rounded-[var(--r)] border-[0.5px] border-[var(--b1)] bg-[var(--bg1)] text-[var(--t2)] cursor-pointer hover:bg-[var(--bg2)] transition-colors"
        >
          {'\u2190'} 上一步
        </button>
        <button
          onClick={onNext}
          disabled={selected.length === 0}
          className="text-[12px] px-4 py-[7px] rounded-[var(--r)] bg-[var(--t1)] text-[var(--bg1)] border-[0.5px] border-[var(--t1)] cursor-pointer transition-colors hover:opacity-90 active:scale-[0.98] disabled:opacity-35 disabled:cursor-not-allowed"
        >
          查看学情 {'\u2192'}
        </button>
      </div>
    </div>
  )
}

function GapPanel({
  gaps,
  emphasisFlags,
  onToggleEmphasis,
  onPrev,
  onNext,
}: {
  gaps: GapItem[]
  emphasisFlags: Record<string, boolean>
  onToggleEmphasis: (kp: string) => void
  onPrev: () => void
  onNext: () => void
}) {
  return (
    <div>
      {gaps.map((g, i) => {
        const color =
          g.rate >= 35
            ? 'var(--danger-t)'
            : g.rate >= 25
              ? 'var(--warn-t)'
              : 'var(--success-t)'
        const isEm = emphasisFlags[g.kp] ?? g.rate >= 30

        return (
          <div
            key={i}
            className="flex items-center gap-2 px-2.5 py-[7px] border-[0.5px] border-[var(--b1)] rounded-md mb-1.5 text-[12px] bg-[var(--bg1)]"
          >
            <span className="w-[110px] shrink-0">{g.kp}</span>
            <div className="flex-1 h-[6px] bg-[var(--bg3)] rounded-sm overflow-hidden">
              <div
                className="h-full rounded-sm"
                style={{ width: `${g.rate}%`, backgroundColor: color }}
              />
            </div>
            <span
              className="w-[36px] text-right font-semibold text-[11px]"
              style={{ color }}
            >
              {g.rate}%
            </span>
            <button
              onClick={() => onToggleEmphasis(g.kp)}
              className={`w-4 h-4 rounded-[3px] border-[1.5px] flex items-center justify-center cursor-pointer text-[10px] shrink-0 transition-colors ${
                isEm
                  ? 'bg-[var(--warn-bg)] border-[var(--warn-t)] text-[var(--warn-t)]'
                  : 'border-[var(--b1)] text-transparent'
              }`}
            >
              {isEm ? '!' : ''}
            </button>
          </div>
        )
      })}
      <div className="text-[11px] text-[var(--t3)] mt-1.5 leading-relaxed">
        点击 ! 标记重点关注的知识点
      </div>
      <div className="flex gap-2 justify-end mt-3.5">
        <button
          onClick={onPrev}
          className="text-[12px] px-4 py-[7px] rounded-[var(--r)] border-[0.5px] border-[var(--b1)] bg-[var(--bg1)] text-[var(--t2)] cursor-pointer hover:bg-[var(--bg2)] transition-colors"
        >
          {'\u2190'} 上一步
        </button>
        <button
          onClick={onNext}
          className="text-[12px] px-4 py-[7px] rounded-[var(--r)] bg-[var(--t1)] text-[var(--bg1)] border-[0.5px] border-[var(--t1)] cursor-pointer transition-colors hover:opacity-90 active:scale-[0.98]"
        >
          确认 {'\u2192'}
        </button>
      </div>
    </div>
  )
}

function SummaryPanel({
  rows,
  emphasisGaps,
  onPrev,
  onSubmit,
  submitLabel,
}: {
  rows: Array<{ label: string; value: string }>
  emphasisGaps: Array<{ kp: string; rate: number }>
  onPrev: () => void
  onSubmit: () => void
  submitLabel: string
}) {
  return (
    <div>
      <div className="bg-[var(--bg2)] rounded-[var(--rl)] px-4 py-3.5 mb-3">
        {rows.map((r, i) => (
          <div key={i} className="flex justify-between py-1 text-[13px]">
            <span className="text-[var(--t2)]">{r.label}</span>
            <span className="font-semibold">{r.value}</span>
          </div>
        ))}
        {emphasisGaps.length > 0 && (
          <div className="flex justify-between py-1 text-[13px]">
            <span className="text-[var(--t2)]">重点关注</span>
            <span className="font-semibold">
              {emphasisGaps.map((g, i) => (
                <span
                  key={i}
                  className="inline-block text-[11px] px-2.5 py-[3px] rounded-[10px] mx-0.5 bg-[var(--warn-bg)] text-[var(--warn-t)] font-medium"
                >
                  {g.kp} {g.rate}%
                </span>
              ))}
            </span>
          </div>
        )}
      </div>
      <div className="flex gap-2 justify-end mt-3.5">
        <button
          onClick={onPrev}
          className="text-[12px] px-4 py-[7px] rounded-[var(--r)] border-[0.5px] border-[var(--b1)] bg-[var(--bg1)] text-[var(--t2)] cursor-pointer hover:bg-[var(--bg2)] transition-colors"
        >
          {'\u2190'} 上一步
        </button>
        <button
          onClick={onSubmit}
          className="text-[12px] px-4 py-[7px] rounded-[var(--r)] bg-[var(--t1)] text-[var(--bg1)] border-[0.5px] border-[var(--t1)] cursor-pointer transition-colors hover:opacity-90 active:scale-[0.98]"
        >
          {submitLabel} {'\u2197'}
        </button>
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────

export function EduStepWizard({
  props,
  widgetState,
  onStateChange,
  onSubmit,
}: WidgetComponentProps<EduStepWizardProps>) {
  const steps = props.steps ?? ['选择范围', '选择章节', '学情分析', '确认生成']
  const fields = props.fields ?? []
  const tree = props.tree ?? []
  const gaps = props.gaps ?? []

  // Local state (wizard internal)
  const [state, setState] = useState<StepWizardState>(() => ({
    currentStep: 0,
    formData: {},
    selectedChapters: [],
    emphasisFlags: Object.fromEntries(gaps.filter((g) => g.rate >= 30).map((g) => [g.kp, true])),
  }))

  const goTo = useCallback((step: number) => {
    setState((prev) => ({ ...prev, currentStep: step }))
  }, [])

  const handleFieldChange = useCallback((key: string, value: string) => {
    setState((prev) => ({
      ...prev,
      formData: { ...prev.formData, [key]: value },
    }))
    onStateChange(key, value)
  }, [onStateChange])

  const handleToggleChapter = useCallback((id: string) => {
    setState((prev) => {
      const selected = prev.selectedChapters.includes(id)
        ? prev.selectedChapters.filter((s) => s !== id)
        : [...prev.selectedChapters, id]
      onStateChange('selectedChapters', selected)
      return { ...prev, selectedChapters: selected }
    })
  }, [onStateChange])

  const handleToggleEmphasis = useCallback((kp: string) => {
    setState((prev) => {
      const flags = { ...prev.emphasisFlags, [kp]: !prev.emphasisFlags[kp] }
      onStateChange('emphasisFlags', flags)
      return { ...prev, emphasisFlags: flags }
    })
  }, [onStateChange])

  const handleSubmit = useCallback(() => {
    const emphasisGaps = gaps.filter((g) => state.emphasisFlags[g.kp])
    onSubmit?.({
      ...widgetState,
      ...state.formData,
      selectedChapters: state.selectedChapters,
      emphasisGaps: emphasisGaps.map((g) => g.kp),
      _action: props.submit_action,
    })
  }, [gaps, state, widgetState, onSubmit, props.submit_action])

  // Build summary rows from formData
  const summaryRows = props.summary_rows ?? [
    { label: '学科 / 年级', value: `${state.formData.subject ?? '数学'} \u00B7 ${state.formData.grade ?? '八年级上'}` },
    { label: '班级', value: state.formData.class ?? '八(2)班' },
    { label: '课型 / 时长', value: `${state.formData.lesson_type ?? '新授课'} \u00B7 ${state.formData.duration ?? '45 分钟'}` },
    { label: '教学内容', value: state.selectedChapters.join(', ') || '未选择' },
  ]

  const emphasisGaps = gaps.filter((g) => state.emphasisFlags[g.kp])

  return (
    <div className="border-[0.5px] border-[var(--b1)] rounded-[var(--rl)] bg-[var(--bg1)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-3 border-b-[0.5px] border-[var(--b1)]">
        <span className="text-[13px] font-semibold">{props.title}</span>
        <span className="text-[10px] px-2 py-0.5 rounded-lg bg-[var(--info-bg)] text-[var(--info-t)]">
          StepWizard
        </span>
      </div>

      <div className="p-4">
        <StepIndicator steps={steps} current={state.currentStep} onGo={goTo} />

        {state.currentStep === 0 && (
          <FormPanel
            fields={fields}
            formData={state.formData}
            onFieldChange={handleFieldChange}
            onNext={() => goTo(1)}
          />
        )}

        {state.currentStep === 1 && (
          <TreePanel
            items={tree}
            selected={state.selectedChapters}
            onToggle={handleToggleChapter}
            onPrev={() => goTo(0)}
            onNext={() => goTo(2)}
          />
        )}

        {state.currentStep === 2 && (
          <GapPanel
            gaps={gaps}
            emphasisFlags={state.emphasisFlags}
            onToggleEmphasis={handleToggleEmphasis}
            onPrev={() => goTo(1)}
            onNext={() => goTo(3)}
          />
        )}

        {state.currentStep === 3 && (
          <SummaryPanel
            rows={summaryRows}
            emphasisGaps={emphasisGaps}
            onPrev={() => goTo(2)}
            onSubmit={handleSubmit}
            submitLabel={props.submit_label ?? '生成教案'}
          />
        )}
      </div>
    </div>
  )
}
