// ═══════════════════════════════════════════
// TRAINING PLAN FORM
// Displays sync fields with per-field SyncButton when AI proposes updates
// ═══════════════════════════════════════════

import { X, Sparkle } from '@phosphor-icons/react'
import type { RehabPlan, SyncField, PendingUpdate, ExerciseRenderData } from '../types'
import { MONO_FONT } from '../constants'

const FIELD_LABELS: Record<SyncField, string> = {
  title: '训练标题',
  subtitle: '副标题',
  medicalSummary: '医学摘要',
  contraindications: '禁忌事项',
  principlesDo: '推荐原则',
  principlesAvoid: '禁忌原则',
  frequency: '训练频率',
  exercises: '训练动作',
  progressionPlan: '进阶计划',
  medicalReminder: '医疗提醒',
}

interface SyncButtonProps {
  field: SyncField
  update: PendingUpdate
  onApply: (field: SyncField) => void
  onDiscard: (field: SyncField) => void
}

function SyncButton({ field, update, onApply, onDiscard }: SyncButtonProps) {
  return (
    <div style={{
      marginTop: 6,
      padding: '8px 10px',
      background: '#0d1f12',
      border: '1px solid #22d3ee44',
      borderRadius: 8,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    }}>
      <div style={{
        flex: 1,
        fontSize: 11,
        color: '#64d4c4',
        fontFamily: MONO_FONT,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        <Sparkle size={12} weight="regular" style={{ flexShrink: 0, verticalAlign: 'middle', marginRight: 4 }} />{update.preview}
      </div>
      <button
        onClick={() => onApply(field)}
        style={{
          background: 'linear-gradient(135deg,#0891b2,#06b6d4)',
          border: 'none',
          borderRadius: 6,
          padding: '4px 12px',
          color: '#fff',
          fontSize: 11,
          fontWeight: 700,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        Sync
      </button>
      <button
        onClick={() => onDiscard(field)}
        style={{
          background: 'transparent',
          border: '1px solid #2a3a4a',
          borderRadius: 6,
          padding: '4px 8px',
          color: '#4a6070',
          fontSize: 11,
          cursor: 'pointer',
        }}
      >
        <X size={12} weight="regular" />
      </button>
    </div>
  )
}

interface FieldRowProps {
  field: SyncField
  label: string
  value: string
  pending?: PendingUpdate
  onApply: (field: SyncField) => void
  onDiscard: (field: SyncField) => void
  onChange: (value: string) => void
  multiline?: boolean
}

function FieldRow({ field, label, value, pending, onApply, onDiscard, onChange, multiline }: FieldRowProps) {
  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: '#0a1120',
    border: '1px solid #1a2a3c',
    borderRadius: 6,
    padding: '6px 8px',
    color: '#cbd5e1',
    fontSize: 12,
    fontFamily: MONO_FONT,
    resize: 'vertical' as const,
    boxSizing: 'border-box' as const,
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        fontSize: 10,
        color: '#3a5060',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        marginBottom: 4,
        fontFamily: MONO_FONT,
      }}>
        {label}
        {pending && (
          <span style={{
            marginLeft: 8,
            background: '#22d3ee22',
            border: '1px solid #22d3ee44',
            borderRadius: 4,
            padding: '1px 6px',
            color: '#22d3ee',
            fontSize: 9,
          }}>
            AI 提议
          </span>
        )}
      </div>

      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          style={inputStyle}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
        />
      )}

      {pending && (
        <SyncButton
          field={field}
          update={pending}
          onApply={onApply}
          onDiscard={onDiscard}
        />
      )}
    </div>
  )
}

interface TrainingPlanFormProps {
  plan: RehabPlan
  pendingUpdates: Map<SyncField, PendingUpdate>
  onApplyField: (field: SyncField) => void
  onDiscardField: (field: SyncField) => void
  onUpdateField: <K extends keyof RehabPlan>(field: K, value: RehabPlan[K]) => void
  onApplyAll: () => void
}

const TEXT_FIELDS: SyncField[] = [
  'title',
  'subtitle',
  'medicalSummary',
  'contraindications',
  'principlesDo',
  'principlesAvoid',
  'frequency',
  'progressionPlan',
  'medicalReminder',
]

const MULTILINE_FIELDS: SyncField[] = [
  'medicalSummary',
  'contraindications',
  'principlesDo',
  'principlesAvoid',
  'frequency',
  'progressionPlan',
  'medicalReminder',
]

export function TrainingPlanForm({
  plan,
  pendingUpdates,
  onApplyField,
  onDiscardField,
  onUpdateField,
  onApplyAll,
}: TrainingPlanFormProps) {
  const hasPending = pendingUpdates.size > 0

  return (
    <div style={{ fontFamily: MONO_FONT, padding: '4px 0' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <div style={{ fontSize: 11, color: '#22d3ee', letterSpacing: 2, textTransform: 'uppercase' }}>
          训练方案
        </div>
        {hasPending && (
          <button
            onClick={onApplyAll}
            style={{
              background: 'linear-gradient(135deg,#0891b2,#06b6d4)',
              border: 'none',
              borderRadius: 6,
              padding: '5px 14px',
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Sync All ({pendingUpdates.size})
          </button>
        )}
      </div>

      {/* Text fields */}
      {TEXT_FIELDS.map((field) => (
        <FieldRow
          key={field}
          field={field}
          label={FIELD_LABELS[field]}
          value={plan[field] as string}
          pending={pendingUpdates.get(field)}
          onApply={onApplyField}
          onDiscard={onDiscardField}
          onChange={(value) => onUpdateField(field, value as RehabPlan[typeof field])}
          multiline={MULTILINE_FIELDS.includes(field)}
        />
      ))}

      {/* Exercises field (special: shows count instead of JSON) */}
      <div style={{ marginBottom: 12 }}>
        <div style={{
          fontSize: 10,
          color: '#3a5060',
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          marginBottom: 4,
        }}>
          {FIELD_LABELS.exercises}
          {pendingUpdates.get('exercises') && (
            <span style={{
              marginLeft: 8,
              background: '#22d3ee22',
              border: '1px solid #22d3ee44',
              borderRadius: 4,
              padding: '1px 6px',
              color: '#22d3ee',
              fontSize: 9,
            }}>
              AI 提议
            </span>
          )}
        </div>

        <div style={{
          background: '#0a1120',
          border: '1px solid #1a2a3c',
          borderRadius: 6,
          padding: '8px',
          minHeight: 40,
        }}>
          {plan.exercises.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {plan.exercises.map((ex: ExerciseRenderData, i) => (
                <div key={i} style={{
                  background: '#111d30',
                  border: '1px solid #22d3ee33',
                  borderRadius: 6,
                  padding: '4px 10px',
                  fontSize: 11,
                  color: '#b0c4d4',
                }}>
                  {ex.nameZh || ex.type} · {ex.sets}×{ex.reps}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: '#2a3a4a' }}>暂无动作（等待 AI 生成）</div>
          )}
        </div>

        {pendingUpdates.get('exercises') && (
          <SyncButton
            field="exercises"
            update={pendingUpdates.get('exercises')!}
            onApply={onApplyField}
            onDiscard={onDiscardField}
          />
        )}
      </div>
    </div>
  )
}
