import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import type { Discuss, DiscussCluster, TargetPoint, FallbackMC } from '../../../types'

interface DiscussEditorProps {
  discuss: Discuss
  onChange: (discuss: Discuss) => void
}

const inputCls =
  'w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500'
const labelCls = 'text-xs font-medium text-gray-500 mb-1'
const sectionCls = 'text-sm font-semibold text-gray-700 mt-4 mb-2'

function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-sm font-semibold text-gray-700 mt-4 mb-2 hover:text-gray-900"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {title}
      </button>
      {open && children}
    </div>
  )
}

function FallbackMCEditor({
  fallbackMC,
  onChange,
}: {
  fallbackMC: FallbackMC
  onChange: (mc: FallbackMC) => void
}) {
  const updateOption = (idx: number, value: string) => {
    const options = [...fallbackMC.options]
    options[idx] = value
    onChange({ ...fallbackMC, options })
  }

  const addOption = () => {
    onChange({ ...fallbackMC, options: [...fallbackMC.options, ''] })
  }

  const removeOption = (idx: number) => {
    const options = fallbackMC.options.filter((_, i) => i !== idx)
    const correctIndex =
      fallbackMC.correctIndex >= options.length ? 0 : fallbackMC.correctIndex
    onChange({ ...fallbackMC, options, correctIndex })
  }

  return (
    <div className="space-y-3 pl-2 border-l-2 border-gray-100">
      <div>
        <label className={labelCls}>Question</label>
        <input
          type="text"
          className={inputCls}
          value={fallbackMC.question}
          onChange={(e) =>
            onChange({ ...fallbackMC, question: e.target.value })
          }
        />
      </div>

      <div>
        <label className={labelCls}>Options</label>
        <div className="space-y-2">
          {fallbackMC.options.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                className={inputCls}
                value={opt}
                onChange={(e) => updateOption(idx, e.target.value)}
                placeholder={`Option ${idx + 1}`}
              />
              {fallbackMC.options.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeOption(idx)}
                  className="text-gray-400 hover:text-red-500 p-1 shrink-0"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addOption}
          className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
        >
          <Plus size={12} /> Add Option
        </button>
      </div>

      <div>
        <label className={labelCls}>Correct Index</label>
        <select
          className={inputCls}
          value={fallbackMC.correctIndex}
          onChange={(e) =>
            onChange({ ...fallbackMC, correctIndex: Number(e.target.value) })
          }
        >
          {fallbackMC.options.map((_, idx) => (
            <option key={idx} value={idx}>
              {idx} — {fallbackMC.options[idx] || `Option ${idx + 1}`}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelCls}>Explanation</label>
        <textarea
          className={inputCls}
          rows={2}
          value={fallbackMC.explanation}
          onChange={(e) =>
            onChange({ ...fallbackMC, explanation: e.target.value })
          }
        />
      </div>
    </div>
  )
}

export default function DiscussEditor({
  discuss,
  onChange,
}: DiscussEditorProps) {
  const updateScaffold = (idx: number, value: string) => {
    const scaffolds = [...(discuss.scaffolds ?? [])]
    scaffolds[idx] = value
    onChange({ ...discuss, scaffolds })
  }

  const addScaffold = () => {
    onChange({ ...discuss, scaffolds: [...(discuss.scaffolds ?? []), ''] })
  }

  const removeScaffold = (idx: number) => {
    onChange({
      ...discuss,
      scaffolds: (discuss.scaffolds ?? []).filter((_, i) => i !== idx),
    })
  }

  const updateCluster = (idx: number, updated: DiscussCluster) => {
    const clusters = [...(discuss.clusters ?? [])]
    clusters[idx] = updated
    onChange({ ...discuss, clusters })
  }

  const addCluster = () => {
    const clusters = discuss.clusters ?? []
    onChange({
      ...discuss,
      clusters: [
        ...clusters,
        { id: `c${clusters.length + 1}`, label: '', description: '' },
      ],
    })
  }

  const removeCluster = (idx: number) => {
    onChange({
      ...discuss,
      clusters: (discuss.clusters ?? []).filter((_, i) => i !== idx),
    })
  }

  const updateTargetPoint = (idx: number, updated: TargetPoint) => {
    const targetPoints = [...(discuss.targetPoints ?? [])]
    targetPoints[idx] = updated
    onChange({ ...discuss, targetPoints })
  }

  const addTargetPoint = () => {
    const pts = discuss.targetPoints ?? []
    onChange({
      ...discuss,
      targetPoints: [
        ...pts,
        { id: `tp${pts.length + 1}`, label: '', description: '' },
      ],
    })
  }

  const removeTargetPoint = (idx: number) => {
    onChange({
      ...discuss,
      targetPoints: (discuss.targetPoints ?? []).filter((_, i) => i !== idx),
    })
  }

  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Opening Question</label>
        <textarea
          className={inputCls}
          rows={3}
          value={discuss.openingQ}
          onChange={(e) => onChange({ ...discuss, openingQ: e.target.value })}
        />
      </div>

      <div>
        <label className={labelCls}>Goal</label>
        <input
          type="text"
          className={inputCls}
          value={discuss.goal ?? ''}
          onChange={(e) => onChange({ ...discuss, goal: e.target.value })}
        />
      </div>

      <div>
        <label className={labelCls}>System Prompt</label>
        <textarea
          className={`${inputCls} font-mono`}
          rows={6}
          value={discuss.systemPrompt}
          onChange={(e) =>
            onChange({ ...discuss, systemPrompt: e.target.value })
          }
        />
      </div>

      <div>
        <label className={labelCls}>Max Rounds</label>
        <input
          type="number"
          className={inputCls}
          min={1}
          value={discuss.maxRounds ?? ''}
          onChange={(e) =>
            onChange({
              ...discuss,
              maxRounds: e.target.value ? Number(e.target.value) : undefined,
            })
          }
        />
      </div>

      <div>
        <label className={labelCls}>Scaffolds</label>
        <div className="space-y-2">
          {(discuss.scaffolds ?? []).map((s, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                className={inputCls}
                value={s}
                onChange={(e) => updateScaffold(idx, e.target.value)}
                placeholder={`Scaffold ${idx + 1}`}
              />
              <button
                type="button"
                onClick={() => removeScaffold(idx)}
                className="text-gray-400 hover:text-red-500 p-1 shrink-0"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addScaffold}
          className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
        >
          <Plus size={12} /> Add Scaffold
        </button>
      </div>

      <div>
        <label className={labelCls}>Insight</label>
        <textarea
          className={inputCls}
          rows={3}
          value={discuss.insight}
          onChange={(e) => onChange({ ...discuss, insight: e.target.value })}
        />
      </div>

      <h3 className={sectionCls}>Fallback MC</h3>
      <FallbackMCEditor
        fallbackMC={discuss.fallbackMC}
        onChange={(mc) => onChange({ ...discuss, fallbackMC: mc })}
      />

      <CollapsibleSection title="Clusters">
        <div className="space-y-3">
          {(discuss.clusters ?? []).map((cluster, idx) => (
            <div
              key={idx}
              className="border border-gray-200 rounded-lg p-3 bg-white"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500">
                  Cluster {idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeCluster(idx)}
                  className="text-gray-400 hover:text-red-500 p-1"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <div className="space-y-2">
                <div>
                  <label className={labelCls}>ID</label>
                  <input
                    type="text"
                    className={inputCls}
                    value={cluster.id}
                    onChange={(e) =>
                      updateCluster(idx, { ...cluster, id: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className={labelCls}>Label</label>
                  <input
                    type="text"
                    className={inputCls}
                    value={cluster.label}
                    onChange={(e) =>
                      updateCluster(idx, { ...cluster, label: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className={labelCls}>Description</label>
                  <textarea
                    className={inputCls}
                    rows={2}
                    value={cluster.description}
                    onChange={(e) =>
                      updateCluster(idx, {
                        ...cluster,
                        description: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addCluster}
            className="w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-gray-200 rounded-lg text-xs text-gray-400 hover:border-gray-300 hover:text-gray-500"
          >
            <Plus size={12} /> Add Cluster
          </button>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Target Points">
        <div className="space-y-3">
          {(discuss.targetPoints ?? []).map((tp, idx) => (
            <div
              key={idx}
              className="border border-gray-200 rounded-lg p-3 bg-white"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500">
                  Point {idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeTargetPoint(idx)}
                  className="text-gray-400 hover:text-red-500 p-1"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <div className="space-y-2">
                <div>
                  <label className={labelCls}>ID</label>
                  <input
                    type="text"
                    className={inputCls}
                    value={tp.id}
                    onChange={(e) =>
                      updateTargetPoint(idx, { ...tp, id: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className={labelCls}>Label</label>
                  <input
                    type="text"
                    className={inputCls}
                    value={tp.label}
                    onChange={(e) =>
                      updateTargetPoint(idx, { ...tp, label: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className={labelCls}>Description</label>
                  <textarea
                    className={inputCls}
                    rows={2}
                    value={tp.description}
                    onChange={(e) =>
                      updateTargetPoint(idx, {
                        ...tp,
                        description: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addTargetPoint}
            className="w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-gray-200 rounded-lg text-xs text-gray-400 hover:border-gray-300 hover:text-gray-500"
          >
            <Plus size={12} /> Add Target Point
          </button>
        </div>
      </CollapsibleSection>
    </div>
  )
}
