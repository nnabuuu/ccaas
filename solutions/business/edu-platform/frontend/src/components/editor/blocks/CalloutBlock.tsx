import { useRef, useCallback } from 'react'
import type { Block } from '../../../types/lesson-plan'

interface CalloutBlockProps {
  block: Block
  mode: 'lesson' | 'template'
  onChange: (content: Record<string, unknown>) => void
  readOnly?: boolean
}

export function CalloutBlock({ block, mode, onChange, readOnly }: CalloutBlockProps) {
  const ref = useRef<HTMLDivElement>(null)
  const text = (block.content.text as string) || ''
  const placeholder = block.placeholder || '输入备注内容...'

  const isTemplate = mode === 'template'
  const borderColor = isTemplate ? 'var(--amber)' : 'var(--blue)'
  const bgColor = isTemplate ? 'var(--amber-bg)' : 'var(--blue-bg)'

  const handleInput = useCallback(() => {
    if (ref.current) {
      onChange({ ...block.content, text: ref.current.textContent || '' })
    }
  }, [block.content, onChange])

  return (
    <div style={{
      borderLeft: `3px solid ${borderColor}`,
      background: bgColor,
      padding: '8px 12px',
      borderRadius: '0 6px 6px 0',
      fontSize: '12px',
      lineHeight: 1.6,
    }}>
      {isTemplate ? (
        <div style={{
          color: 'var(--t3)',
          fontStyle: 'italic',
        }}>
          {placeholder}
        </div>
      ) : readOnly ? (
        <div style={{ color: 'var(--t1)' }}>{text || placeholder}</div>
      ) : (
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          data-placeholder={placeholder}
          style={{
            color: 'var(--t1)',
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
