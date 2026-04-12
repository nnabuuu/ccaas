import type { Block } from '../../../types/lesson-plan'

interface TextBlockProps {
  block: Block
  mode: 'lesson' | 'template'
  onChange: (content: Record<string, unknown>) => void
  readOnly?: boolean
}

export function TextBlock({ block, mode, onChange, readOnly }: TextBlockProps) {
  const text = String(block.content.text ?? '')
  const placeholder = block.placeholder ?? '在此输入内容...'

  if (mode === 'template') {
    return (
      <div
        style={{
          fontSize: '13px',
          lineHeight: 1.7,
          color: 'var(--t3)',
          fontStyle: 'italic',
          padding: '4px 0',
        }}
      >
        {placeholder}
      </div>
    )
  }

  return (
    <div
      contentEditable={!readOnly}
      suppressContentEditableWarning
      onBlur={(e) => {
        const newText = e.currentTarget.textContent ?? ''
        if (newText !== text) {
          onChange({ text: newText })
        }
      }}
      style={{
        fontSize: '13px',
        lineHeight: 1.7,
        color: 'var(--t1)',
        padding: '4px 0',
        outline: 'none',
        minHeight: '24px',
      }}
    >
      {text || (!readOnly ? '' : '(空)')}
    </div>
  )
}
