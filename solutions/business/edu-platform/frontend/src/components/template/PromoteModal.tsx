import { useState } from 'react'
import type { TemplateScope } from '../../types/template'
import { EDU_API } from '../../config'

interface PromoteModalProps {
  templateId: string
  templateName: string
  lessonType?: string
  onClose: () => void
  onSuccess: () => void
}

export function PromoteModal({
  templateId,
  templateName,
  lessonType,
  onClose,
  onSuccess,
}: PromoteModalProps) {
  const [targetScope, setTargetScope] = useState<TemplateScope>('school')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!reason.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`${EDU_API}/templates/${templateId}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_scope: targetScope, reason }),
      })
      if (res.ok) {
        onSuccess()
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(28,28,26,0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg1)',
          border: '1px solid var(--b1)',
          borderRadius: '12px',
          width: '420px',
          padding: '24px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
          }}
        >
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--t1)', margin: 0 }}>
            提交推优
          </h3>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: '16px',
              color: 'var(--t3)',
              padding: '0 2px',
            }}
          >
            ×
          </button>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Target scope */}
          <div>
            <label
              style={{ display: 'block', fontSize: '11px', color: 'var(--t2)', marginBottom: '4px' }}
            >
              推优目标
            </label>
            <select
              value={targetScope}
              onChange={(e) => setTargetScope(e.target.value as TemplateScope)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--b1)',
                borderRadius: '6px',
                fontSize: '12px',
                fontFamily: 'inherit',
                background: 'var(--bg1)',
                color: 'var(--t1)',
              }}
            >
              <option value="school">提交到校级审核</option>
              <option value="district">提交到区级审核</option>
            </select>
          </div>

          {/* Template name (read-only) */}
          <div>
            <label
              style={{ display: 'block', fontSize: '11px', color: 'var(--t2)', marginBottom: '4px' }}
            >
              模板名称
            </label>
            <input
              type="text"
              value={templateName}
              readOnly
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--b1)',
                borderRadius: '6px',
                fontSize: '12px',
                fontFamily: 'inherit',
                background: 'var(--bg2)',
                color: 'var(--t2)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Lesson type (read-only) */}
          <div>
            <label
              style={{ display: 'block', fontSize: '11px', color: 'var(--t2)', marginBottom: '4px' }}
            >
              适用课型
            </label>
            <input
              type="text"
              value={lessonType ?? '通用'}
              readOnly
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--b1)',
                borderRadius: '6px',
                fontSize: '12px',
                fontFamily: 'inherit',
                background: 'var(--bg2)',
                color: 'var(--t2)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Reason */}
          <div>
            <label
              style={{ display: 'block', fontSize: '11px', color: 'var(--t2)', marginBottom: '4px' }}
            >
              推荐理由
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="说明这个模板的特点和推荐理由..."
              rows={3}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--b1)',
                borderRadius: '6px',
                fontSize: '12px',
                fontFamily: 'inherit',
                background: 'var(--bg1)',
                color: 'var(--t1)',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            marginTop: '20px',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              borderRadius: '8px',
              border: '0.5px solid var(--b1)',
              background: 'var(--bg1)',
              color: 'var(--t2)',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !reason.trim()}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              borderRadius: '8px',
              border: '0.5px solid var(--t1)',
              background: 'var(--t1)',
              color: 'var(--bg1)',
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting || !reason.trim() ? 0.5 : 1,
              fontFamily: 'inherit',
            }}
          >
            {submitting ? '提交中...' : '提交'}
          </button>
        </div>
      </div>
    </div>
  )
}
