import { useState, useEffect, useCallback } from 'react'
import { useOutputSync, type OutputUpdate } from '@kedge-agentic/react-sdk'
import { useSessionContext } from '../context/SessionContext'
import type { LessonPlan } from '../types/lesson-plan'

const SECTION_IDS = [
  { id: 'basic', label: '基本信息' },
  { id: 'objectives', label: '教学目标' },
  { id: 'activities', label: '教学活动' },
  { id: 'assessment', label: '评估方式' },
  { id: 'differentiation', label: '分层教学' },
] as const

const emptyPlan: LessonPlan = {
  id: '',
  tenantId: 'edu-agent',
  title: '',
  subject: '',
  gradeLevel: '',
  duration: '',
  objectives: [],
  standards: [],
  materials: [],
  activities: [],
  assessment: { formative: [], summative: [] },
  differentiation: { struggling: [], onLevel: [], advanced: [] },
  status: 'draft',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

export function LessonPlanView() {
  const { registerOutputHandler } = useSessionContext()
  const [plan, setPlan] = useState<LessonPlan>(emptyPlan)
  const [activeSection, setActiveSection] = useState('basic')

  const sync = useOutputSync<LessonPlan>({ mode: 'manual' })

  useEffect(() => {
    return registerOutputHandler((update: OutputUpdate) => {
      if (update.field === '__navigation__') return
      sync.handleOutputUpdate(update)
    })
  }, [registerOutputHandler, sync.handleOutputUpdate])

  const handleSync = useCallback((field: string) => {
    sync.syncToForm(field, plan, setPlan)
  }, [sync, plan])

  const handleDiscard = useCallback((field: string) => {
    sync.discardUpdate(field)
  }, [sync])

  const handleUndo = useCallback((field: string) => {
    sync.undoSync(field, plan, setPlan)
  }, [sync, plan])

  const updateField = <K extends keyof LessonPlan>(field: K, value: LessonPlan[K]) => {
    setPlan(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Outline nav */}
      <nav className="w-44 border-r border-border bg-surface-secondary shrink-0 py-3">
        {SECTION_IDS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveSection(id)}
            className={`w-full text-left px-4 py-2 text-sm cursor-pointer transition-colors duration-150 ${
              activeSection === id
                ? 'text-lesson font-medium bg-lesson-light border-r-2 border-lesson'
                : 'text-ink-secondary hover:bg-surface-tertiary'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Center: Content editor */}
      <main className="flex-1 overflow-y-auto p-6">
        {activeSection === 'basic' && (
          <section className="space-y-4 max-w-2xl">
            <h2 className="text-lg font-semibold">基本信息</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="课程标题" value={plan.title} onChange={(v) => updateField('title', v)} modified={sync.modifiedFields.has('title')} />
              <Field label="学科" value={plan.subject} onChange={(v) => updateField('subject', v)} modified={sync.modifiedFields.has('subject')} />
              <Field label="年级" value={plan.gradeLevel} onChange={(v) => updateField('gradeLevel', v)} modified={sync.modifiedFields.has('gradeLevel')} />
              <Field label="课时" value={plan.duration} onChange={(v) => updateField('duration', v)} modified={sync.modifiedFields.has('duration')} />
            </div>
          </section>
        )}

        {activeSection === 'objectives' && (
          <section className="space-y-4 max-w-2xl">
            <h2 className="text-lg font-semibold">教学目标</h2>
            {plan.objectives.length === 0 ? (
              <EmptyState text="暂无教学目标，在 Chat 中让 AI 帮你生成" />
            ) : (
              <div className="space-y-3">
                {plan.objectives.map((obj, i) => (
                  <div key={obj.id} className={`p-4 rounded-xl border ${sync.modifiedFields.has('objectives') ? 'border-warning bg-warning/5' : 'border-border'}`}>
                    <div className="flex items-start gap-3">
                      <span className="text-xs font-mono text-ink-muted bg-surface-tertiary px-1.5 py-0.5 rounded mt-0.5">{i + 1}</span>
                      <div>
                        <p className="text-sm">{obj.description}</p>
                        <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-pill bg-accent-light text-accent font-medium">
                          {obj.bloomLevel}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeSection === 'activities' && (
          <section className="space-y-4 max-w-2xl">
            <h2 className="text-lg font-semibold">教学活动</h2>
            {plan.activities.length === 0 ? (
              <EmptyState text="暂无教学活动，在 Chat 中让 AI 帮你设计" />
            ) : (
              <div className="space-y-3">
                {plan.activities.map((act) => (
                  <div key={act.id} className={`p-4 rounded-xl border ${sync.modifiedFields.has('activities') ? 'border-warning bg-warning/5' : 'border-border'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold">{act.title}</h3>
                      <span className="text-xs text-ink-muted">{act.duration}分钟 &middot; {act.type}</span>
                    </div>
                    <p className="text-sm text-ink-secondary">{act.description}</p>
                    {act.instructions.length > 0 && (
                      <ol className="mt-2 space-y-1">
                        {act.instructions.map((inst, j) => (
                          <li key={j} className="text-xs text-ink-secondary flex gap-2">
                            <span className="text-ink-muted">{j + 1}.</span>
                            {inst}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeSection === 'assessment' && (
          <section className="space-y-4 max-w-2xl">
            <h2 className="text-lg font-semibold">评估方式</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="label mb-2">形成性评估</h3>
                {plan.assessment.formative.length === 0 ? (
                  <EmptyState text="暂无" compact />
                ) : (
                  <ul className="space-y-1">
                    {plan.assessment.formative.map((f, i) => (
                      <li key={i} className="text-sm text-ink-secondary">&bull; {f}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="label mb-2">总结性评估</h3>
                {plan.assessment.summative.length === 0 ? (
                  <EmptyState text="暂无" compact />
                ) : (
                  <ul className="space-y-1">
                    {plan.assessment.summative.map((s, i) => (
                      <li key={i} className="text-sm text-ink-secondary">&bull; {s}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        )}

        {activeSection === 'differentiation' && (
          <section className="space-y-4 max-w-2xl">
            <h2 className="text-lg font-semibold">分层教学</h2>
            <div className="grid grid-cols-3 gap-4">
              <DiffList title="学困生支持" items={plan.differentiation.struggling} />
              <DiffList title="普通学生" items={plan.differentiation.onLevel} />
              <DiffList title="优秀学生拓展" items={plan.differentiation.advanced} />
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

// Expose sync handlers for ChatPanel usage in App
LessonPlanView.useSyncHandlers = function useLessonPlanSync() {
  // This is a placeholder - actual sync is handled internally
  return {}
}

// Helper components
function Field({ label, value, onChange, modified }: { label: string; value: string; onChange: (v: string) => void; modified?: boolean }) {
  return (
    <div>
      <label className="label mb-1 block">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-3 py-2 text-sm rounded-lg border bg-surface outline-none transition-colors duration-150 focus:border-accent focus:ring-1 focus:ring-accent/20 ${
          modified ? 'border-warning bg-warning/5' : 'border-border'
        }`}
      />
    </div>
  )
}

function EmptyState({ text, compact }: { text: string; compact?: boolean }) {
  return (
    <div className={`text-sm text-ink-muted ${compact ? 'py-2' : 'py-8 text-center'}`}>
      {text}
    </div>
  )
}

function DiffList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="label mb-2">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-ink-muted">暂无</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li key={i} className="text-sm text-ink-secondary">&bull; {item}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
