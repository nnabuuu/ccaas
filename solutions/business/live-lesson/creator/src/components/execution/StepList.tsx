import { useState, useCallback } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  GripVertical,
} from 'lucide-react'
import type { ReadingStep } from '../../types'
import { getStepColor } from '../../types'
import { getBlockIcon, getBlockBadgeClass, getBlockLabel } from '../../types/block-registry'

// ── Color maps for Tailwind (no dynamic class construction) ──

const STEP_BORDER: Record<string, string> = {
  teal: 'border-l-teal-500',
  blue: 'border-l-blue-500',
  purple: 'border-l-purple-500',
  amber: 'border-l-amber-500',
  green: 'border-l-green-500',
}

const STEP_BADGE_BG: Record<string, string> = {
  teal: 'bg-teal-100 text-teal-700',
  blue: 'bg-blue-100 text-blue-700',
  purple: 'bg-purple-100 text-purple-700',
  amber: 'bg-amber-100 text-amber-700',
  green: 'bg-green-100 text-green-700',
}


// ── Props ──

interface StepListProps {
  steps: ReadingStep[]
  onStepsChange: (steps: ReadingStep[]) => void
  onSelectBlock: (stepIdx: number, blockType: string) => void
  selectedBlock: { stepIdx: number } | null
}

export default function StepList({ steps, onStepsChange, onSelectBlock, selectedBlock }: StepListProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  // Reindex steps after mutation — preserve existing IDs, only update idx
  function reindex(arr: ReadingStep[]): ReadingStep[] {
    return arr.map((s, i) => ({ ...s, idx: i }))
  }

  const deleteStep = useCallback(
    (idx: number) => {
      const next = steps.filter((_, i) => i !== idx)
      onStepsChange(reindex(next))
    },
    [steps, onStepsChange],
  )

  const moveStep = useCallback(
    (idx: number, dir: -1 | 1) => {
      const target = idx + dir
      if (target < 0 || target >= steps.length) return
      const next = [...steps]
      const tmp = next[idx]
      next[idx] = next[target]
      next[target] = tmp
      onStepsChange(reindex(next))
    },
    [steps, onStepsChange],
  )

  const updateStep = useCallback(
    (idx: number, patch: Partial<ReadingStep>) => {
      const next = steps.map((s, i) => (i === idx ? { ...s, ...patch } : s))
      onStepsChange(next)
    },
    [steps, onStepsChange],
  )

  const addBlock = useCallback(
    (stepIdx: number, blockType: 'discuss' | 'answerKey') => {
      if (blockType === 'discuss') {
        updateStep(stepIdx, {
          discuss: {
            openingQ: '',
            systemPrompt: '',
            fallbackMC: { question: '', options: ['', '', '', ''], correctIndex: 0, explanation: '' },
            insight: '',
          },
        })
      } else {
        updateStep(stepIdx, {
          answerKey: { type: 'quiz', answers: [] },
        })
      }
    },
    [updateStep],
  )

  const removeBlock = useCallback(
    (stepIdx: number, blockType: 'discuss' | 'answerKey') => {
      const step = steps[stepIdx]
      const patched = { ...step }
      if (blockType === 'discuss') delete patched.discuss
      else delete patched.answerKey
      const next = steps.map((s, i) => (i === stepIdx ? patched : s))
      onStepsChange(next)
    },
    [steps, onStepsChange],
  )

  // Collect blocks for a step
  function getBlocks(step: ReadingStep): { type: string; key: 'answerKey' | 'discuss'; label: string; description: string }[] {
    const blocks: { type: string; key: 'answerKey' | 'discuss'; label: string; description: string }[] = []
    if (step.answerKey) {
      const t = step.answerKey.type
      blocks.push({
        type: t,
        key: 'answerKey',
        label: getBlockLabel(t),
        description: step.exerciseLabel || '',
      })
    }
    if (step.discuss) {
      blocks.push({
        type: 'discuss',
        key: 'discuss',
        label: '讨论',
        description: step.discuss.openingQ || '',
      })
    }
    return blocks
  }

  if (steps.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        No steps yet. Add a step to get started.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {steps.map((step, i) => {
        const color = getStepColor(i)
        const isExpanded = expanded[step.id] ?? false
        const blocks = getBlocks(step)
        const hasAK = !!step.answerKey
        const hasDiscuss = !!step.discuss

        return (
          <div
            key={step.id}
            data-step-id={step.id}
            className={`bg-white border border-gray-200 ${STEP_BORDER[color]} border-l-4 rounded-lg overflow-hidden`}
          >
            {/* Step header */}
            <div className="flex items-center gap-2 px-4 py-3">
              <GripVertical size={14} className="text-gray-300 shrink-0 cursor-grab" />

              {/* Step number badge */}
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${STEP_BADGE_BG[color]}`}>
                {i + 1}
              </span>

              {/* Title */}
              <input
                type="text"
                value={step.label || ''}
                onChange={(e) => updateStep(i, { label: e.target.value })}
                placeholder="Step title..."
                className="flex-1 text-sm font-medium text-gray-900 bg-transparent border-none outline-none placeholder:text-gray-300 min-w-0"
              />

              {/* Type badge */}
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${getBlockBadgeClass(step.type || 'task')}`}>
                {step.type || 'task'}
              </span>

              {/* Duration */}
              <div className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
                <input
                  type="number"
                  value={step.duration ?? 5}
                  onChange={(e) => updateStep(i, { duration: parseInt(e.target.value) || 1 })}
                  className="w-8 text-center bg-gray-50 border border-gray-200 rounded text-xs py-0.5"
                  min={1}
                />
                <span>min</span>
              </div>

              {/* Block count */}
              {blocks.length > 0 && (
                <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                  {blocks.length} block{blocks.length > 1 ? 's' : ''}
                </span>
              )}

              {/* Reorder */}
              <button
                onClick={() => moveStep(i, -1)}
                disabled={i === 0}
                className="p-1 text-gray-300 hover:text-gray-500 disabled:opacity-30"
                title="Move up"
              >
                <ArrowUp size={14} />
              </button>
              <button
                onClick={() => moveStep(i, 1)}
                disabled={i === steps.length - 1}
                className="p-1 text-gray-300 hover:text-gray-500 disabled:opacity-30"
                title="Move down"
              >
                <ArrowDown size={14} />
              </button>

              {/* Delete */}
              <button
                onClick={() => deleteStep(i)}
                className="p-1 text-gray-300 hover:text-red-500"
                title="Delete step"
              >
                <Trash2 size={14} />
              </button>

              {/* Expand/collapse */}
              <button
                onClick={() => toggleExpand(step.id)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50">
                {/* Blocks */}
                {blocks.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {blocks.map((block) => {
                      const Icon = getBlockIcon(block.type)
                      const isSelected = selectedBlock?.stepIdx === i
                      return (
                        <div
                          key={block.key}
                          onClick={() => onSelectBlock(i, block.type)}
                          className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                            isSelected
                              ? 'border-blue-300 bg-blue-50'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <Icon size={16} className="text-gray-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-700">{block.label}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${getBlockBadgeClass(block.type)}`}>
                                {block.type}
                              </span>
                            </div>
                            {block.description && (
                              <p className="text-xs text-gray-400 truncate mt-0.5">{block.description}</p>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              removeBlock(i, block.key)
                            }}
                            className="p-1 text-gray-300 hover:text-red-500"
                            title={`Remove ${block.label}`}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Add block buttons */}
                <div className="flex gap-2">
                  {!hasAK && (
                    <button
                      onClick={() => addBlock(i, 'answerKey')}
                      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 border border-dashed border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-300 transition-colors"
                    >
                      <Plus size={12} />
                      Exercise
                    </button>
                  )}
                  {!hasDiscuss && (
                    <button
                      onClick={() => addBlock(i, 'discuss')}
                      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 border border-dashed border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-300 transition-colors"
                    >
                      <Plus size={12} />
                      Discuss
                    </button>
                  )}
                </div>

                {/* Student view note for instruction steps */}
                {step.type === 'instruction' && step.studentView && (
                  <div className="mt-3 text-xs text-gray-400">
                    Student view: {step.studentView.title}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
