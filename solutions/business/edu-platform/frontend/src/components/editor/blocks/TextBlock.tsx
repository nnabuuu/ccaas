import { useRef, useCallback } from 'react'
import type { Block } from '../../../types/lesson-plan'

interface TextBlockProps {
  block: Block
  mode: 'lesson' | 'template'
  onChange: (content: Record<string, unknown>) => void
  readOnly?: boolean
}

export function TextBlock({ block, mode, onChange, readOnly }: TextBlockProps) {
  const ref = useRef<HTMLDivElement>(null)
  const text = (block.content.text as string) || ''
  const placeholder = block.placeholder || '输入文本内容...'

  const handleInput = useCallback(() => {
    if (ref.current) {
      onChange({ ...block.content, text: ref.current.textContent || '' })
    }
  }, [block.content, onChange])

  if (mode === 'template') {
    return (
      <div style={{
        fontSize: '13px',
        lineHeight: 1.7,
        color: 'var(--t3)',
        fontStyle: 'italic',
        padding: '4px 0',
      }}>
        {placeholder}
      </div>
    )
  }

  if (readOnly) {
    return (
      <div style={{
        fontSize: '13px',
        lineHeight: 1.7,
        color: 'var(--t1)',
        padding: '4px 0',
      }}>
        {text || placeholder}
      </div>
    )
  }

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      data-placeholder={placeholder}
      style={{
        fontSize: '13px',
        lineHeight: 1.7,
        color: 'var(--t1)',
        padding: '4px 0',
        outline: 'none',
        minHeight: '24px',
      }}
    >
      {text}
    </div>
  )
}
