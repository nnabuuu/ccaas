import { useState } from 'react'
import type { TemplateScope } from '../../types/template'

interface PromoteModalProps {
  templateName: string
  lessonType: string
  subject: string
  onSubmit: (targetScope: TemplateScope, reason: string) => void
  onClose: () => void
}

export function PromoteModal({
  templateName,
  lessonType,
  subject,
  onSubmit,
  onClose,
}: PromoteModalProps) {
  const [targetScope, setTargetScope] = useState<TemplateScope>('school')
  const [reason, setReason] = useState('')

  const handleSubmit = () => {
    if (!reason.trim()) return
    onSubmit(targetScope, reason.trim())
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '11px',
    color: 'var(--t2)',
    marginBottom: '4px',
    display: 'block',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    fontSize: '12px',
    background: 'var(--surface)',
    color: 'var(--t1)',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const readOnlyInputStyle: React.CSSProperties = {
    ...inputStyle,
    background: 'var(--surface2)',
    color: 'var(--t2)',
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'var(--overlay)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        width: '420px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '24px',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
        }}>
          <h3 style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--t1)',
            margin: 0,
          }}>
            提交推优
          </h3>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: 'var(--t3)',
              fontSize: '16px',
              fontFamily: 'inherit',
              padding: '0 2px',
            }}
          >
            ×
          </button>
        </div>

        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={labelStyle}>推优目标</label>
            <select
              value={targetScope}
              onChange={(e) => setTargetScope(e.target.value as TemplateScope)}
              style={{
                ...inputStyle,
                cursor: 'pointer',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--focus-border)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)'
              }}
            >
              <option value="school">提交到校级审核</option>
              <option value="district">提交到区级审核</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>模板名称</label>
            <input
              type="text"
              value={templateName}
              readOnly
              style={readOnlyInputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>适用课型</label>
            <input
              type="text"
              value={`${lessonType} · ${subject}`}
              readOnly
              style={readOnlyInputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>推荐理由</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="说明这个模板的特点..."
              rows={3}
              style={{
                ...inputStyle,
                resize: 'vertical',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--focus-border)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)'
              }}
            />
          </div>
        </div>

        {/* Actions */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '8px',
          marginTop: '20px',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--t2)',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            style={{
              padding: '6px 16px',
              border: 'none',
              background: 'var(--t1)',
              color: 'var(--surface)',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: 500,
            }}
          >
            提交
          </button>
        </div>
      </div>
    </div>
  )
}
