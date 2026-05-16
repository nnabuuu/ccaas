import { useState } from 'react'
import {
  X,
  Pencil,
  BarChart3,
  Zap,
  Eye,
  MessageSquare,
  FileText,
  ClipboardList,
} from 'lucide-react'
import type { ReadingStep, AnswerKey, Discuss } from '../../types'
import { BLOCK_TYPE_LABELS, createDefaultAnswerKey } from '../../types'
import { ChoiceEditor, DiscussEditor } from './editors'

interface BlockEditorDrawerProps {
  step: ReadingStep
  onStepChange: (step: ReadingStep) => void
  onClose: () => void
}

type SubTab = 'content' | 'observe' | 'rules' | 'preview'

const ANSWER_KEY_TYPES = [
  'quiz',
  'match',
  'matrix',
  'stance',
  'order',
  'select-evidence',
  'map',
  'image-upload',
  'fill-blank',
] as const

const inputCls =
  'w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500'
const labelCls = 'text-xs font-medium text-gray-500 mb-1'
const sectionCls = 'text-sm font-semibold text-gray-700 mt-4 mb-2'

const SUB_TABS: { id: SubTab; label: string; icon: typeof Pencil }[] = [
  { id: 'content', label: '内容', icon: Pencil },
  { id: 'observe', label: '观察', icon: BarChart3 },
  { id: 'rules', label: '规则', icon: Zap },
  { id: 'preview', label: '预览', icon: Eye },
]

function getBlockType(step: ReadingStep): string {
  if (step.answerKey) return step.answerKey.type
  if (step.discuss) return 'discuss'
  return 'instruction'
}

function getBlockIcon(type: string) {
  if (type === 'discuss') return MessageSquare
  if (type === 'instruction') return FileText
  return ClipboardList
}

function TypeSpecificEditor({
  answerKey,
  onChange,
}: {
  answerKey: AnswerKey
  onChange: (ak: AnswerKey) => void
}) {
  switch (answerKey.type) {
    case 'quiz':
      return <ChoiceEditor answerKey={answerKey} onChange={onChange} />
    default:
      return (
        <div className="text-xs text-gray-400 italic py-4 text-center border border-dashed border-gray-200 rounded-lg">
          {BLOCK_TYPE_LABELS[answerKey.type] ?? answerKey.type} editor coming
          soon
        </div>
      )
  }
}

function ContentTab({
  step,
  onStepChange,
}: {
  step: ReadingStep
  onStepChange: (step: ReadingStep) => void
}) {
  const handleAnswerKeyTypeChange = (newType: string) => {
    if (newType === step.answerKey?.type) return
    onStepChange({ ...step, answerKey: createDefaultAnswerKey(newType) })
  }

  return (
    <div className="space-y-3">
      {/* Common fields */}
      <div>
        <label className={labelCls}>Label</label>
        <input
          type="text"
          className={inputCls}
          value={step.label ?? ''}
          onChange={(e) => onStepChange({ ...step, label: e.target.value })}
          placeholder="Step label"
        />
      </div>

      <div>
        <label className={labelCls}>Description</label>
        <textarea
          className={inputCls}
          rows={2}
          value={step.description ?? ''}
          onChange={(e) =>
            onStepChange({ ...step, description: e.target.value })
          }
          placeholder="Step description"
        />
      </div>

      <div>
        <label className={labelCls}>Duration (minutes)</label>
        <input
          type="number"
          className={inputCls}
          min={0}
          value={step.duration ?? ''}
          onChange={(e) =>
            onStepChange({
              ...step,
              duration: e.target.value ? Number(e.target.value) : undefined,
            })
          }
        />
      </div>

      <div>
        <label className={labelCls}>Student View Title</label>
        <input
          type="text"
          className={inputCls}
          value={step.studentView?.title ?? ''}
          onChange={(e) =>
            onStepChange({
              ...step,
              studentView: {
                ...(step.studentView ?? { title: '', body: '' }),
                title: e.target.value,
              },
            })
          }
        />
      </div>

      <div>
        <label className={labelCls}>Student View Body</label>
        <textarea
          className={inputCls}
          rows={3}
          value={step.studentView?.body ?? ''}
          onChange={(e) =>
            onStepChange({
              ...step,
              studentView: {
                ...(step.studentView ?? { title: '', body: '' }),
                body: e.target.value,
              },
            })
          }
        />
      </div>

      <div>
        <label className={labelCls}>Strategy</label>
        <input
          type="text"
          className={inputCls}
          value={step.strategy ?? ''}
          onChange={(e) => onStepChange({ ...step, strategy: e.target.value })}
          placeholder="e.g. guided-reading, practice..."
        />
      </div>

      {/* Exercise configuration */}
      {step.answerKey && (
        <>
          <h3 className={sectionCls}>Exercise Configuration</h3>

          <div>
            <label className={labelCls}>Type</label>
            <select
              className={inputCls}
              value={step.answerKey.type}
              onChange={(e) => handleAnswerKeyTypeChange(e.target.value)}
            >
              {ANSWER_KEY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {BLOCK_TYPE_LABELS[t] ?? t}
                </option>
              ))}
            </select>
          </div>

          <TypeSpecificEditor
            answerKey={step.answerKey}
            onChange={(ak) => onStepChange({ ...step, answerKey: ak })}
          />
        </>
      )}

      {/* Discussion configuration */}
      {step.discuss && (
        <>
          <h3 className={sectionCls}>Discussion Configuration</h3>
          <DiscussEditor
            discuss={step.discuss}
            onChange={(d: Discuss) => onStepChange({ ...step, discuss: d })}
          />
        </>
      )}

      {/* AI fields */}
      <h3 className={sectionCls}>AI Tutor</h3>

      <div>
        <label className={labelCls}>AI Tutor Instruction</label>
        <textarea
          className={inputCls}
          rows={3}
          value={step.teacherView?.speechLine ?? ''}
          onChange={(e) =>
            onStepChange({
              ...step,
              teacherView: {
                ...(step.teacherView ?? { speechLine: '' }),
                speechLine: e.target.value,
              },
            })
          }
          placeholder="Instructions for the AI tutor..."
        />
      </div>

      <div>
        <label className={labelCls}>Completion Mode</label>
        <div className="flex gap-4 mt-1">
          {(
            [
              { value: 'confirm', label: 'Manual' },
              { value: 'submit', label: 'Hard' },
            ] as const
          ).map((opt) => (
            <label key={opt.value} className="flex items-center gap-1.5 text-sm text-gray-700">
              <input
                type="radio"
                name="advanceOn"
                value={opt.value}
                checked={(step.advanceOn ?? 'submit') === opt.value}
                onChange={() =>
                  onStepChange({ ...step, advanceOn: opt.value })
                }
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function BlockEditorDrawer({
  step,
  onStepChange,
  onClose,
}: BlockEditorDrawerProps) {
  const [activeTab, setActiveTab] = useState<SubTab>('content')
  const blockType = getBlockType(step)
  const Icon = getBlockIcon(blockType)
  const typeLabel = BLOCK_TYPE_LABELS[blockType] ?? blockType

  return (
    <div className="w-[420px] max-w-[50%] h-full border-l border-gray-200 bg-white flex flex-col shrink-0 animate-slide-in">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
        <Icon size={16} className="text-blue-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900 truncate">
            {step.label || `Step ${step.idx}`}
          </div>
        </div>
        <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full shrink-0">
          {typeLabel}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 p-1 shrink-0"
        >
          <X size={16} />
        </button>
      </div>

      {/* Sub-tabs */}
      <div className="flex border-b border-gray-100 px-4">
        {SUB_TABS.map((tab) => {
          const TabIcon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                active
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <TabIcon size={12} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'content' && (
          <ContentTab step={step} onStepChange={onStepChange} />
        )}
        {activeTab === 'observe' && (
          <div className="text-xs text-gray-400 italic py-8 text-center">
            Observation configuration — coming soon
          </div>
        )}
        {activeTab === 'rules' && (
          <div className="text-xs text-gray-400 italic py-8 text-center">
            Rules configuration — coming soon
          </div>
        )}
        {activeTab === 'preview' && (
          <div className="text-xs text-gray-400 italic py-8 text-center">
            Preview — coming soon
          </div>
        )}
      </div>
    </div>
  )
}
