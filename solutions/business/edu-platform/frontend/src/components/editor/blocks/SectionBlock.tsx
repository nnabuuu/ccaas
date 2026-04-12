import type { Block } from '../../../types/lesson-plan'

interface SectionBlockProps {
  block: Block
  mode: 'lesson' | 'template'
  onChange: (content: Record<string, unknown>) => void
  readOnly?: boolean
}

export function SectionBlock({ block, onChange, readOnly }: SectionBlockProps) {
  const title = String(block.content.title ?? '')

  return (
    <div
      style={{
        background: 'var(--bg2)',
        borderRadius: '8px',
        padding: '8px 12px',
      }}
    >
      {readOnly ? (
        <span
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--t1)',
          }}
        >
          {title || '未命名标题'}
        </span>
      ) : (
        <input
          type="text"
          value={title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="输入标题..."
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--t1)',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            width: '100%',
            padding: 0,
            fontFamily: 'inherit',
          }}
        />
      )}
    </div>
  )
}
