import type { Block } from '../../../types/lesson-plan'

interface CalloutBlockProps {
  block: Block
  mode: 'lesson' | 'template'
  onChange: (content: Record<string, unknown>) => void
  readOnly?: boolean
}

export function CalloutBlock({ block, mode, onChange, readOnly }: CalloutBlockProps) {
  const text = String(block.content.text ?? '')
  const variant = String(block.content.variant ?? 'info')
  const placeholder = block.placeholder ?? '在此输入提示内容...'
  const isTemplate = mode === 'template'

  const isWarning = isTemplate || variant === 'warning'
  const bgColor = isWarning ? 'var(--warn-bg)' : 'var(--info-bg)'
  const borderColor = isWarning ? 'var(--warn-t)' : 'var(--info-t)'
  const textColor = isWarning ? 'var(--warn-t)' : 'var(--info-t)'

  if (isTemplate) {
    return (
      <div
        style={{
          borderLeft: `3px solid ${borderColor}`,
          background: bgColor,
          padding: '8px 12px',
          borderRadius: '0 6px 6px 0',
          fontSize: '12px',
          color: textColor,
          fontStyle: 'italic',
        }}
      >
        {placeholder}
      </div>
    )
  }

  return (
    <div
      style={{
        borderLeft: `3px solid ${borderColor}`,
        background: bgColor,
        padding: '8px 12px',
        borderRadius: '0 6px 6px 0',
      }}
    >
      {readOnly ? (
        <span style={{ fontSize: '12px', color: textColor }}>
          {text || '(空提示)'}
        </span>
      ) : (
        <div
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => {
            const newText = e.currentTarget.textContent ?? ''
            if (newText !== text) {
              onChange({ text: newText, variant })
            }
          }}
          style={{
            fontSize: '12px',
            color: textColor,
            outline: 'none',
            minHeight: '20px',
          }}
        >
          {text}
        </div>
      )}
    </div>
  )
}
