import type { Block } from '../../../types/lesson-plan'

interface ImageBlockProps {
  block: Block
  mode: 'lesson' | 'template'
  onChange: (content: Record<string, unknown>) => void
  readOnly?: boolean
}

export function ImageBlock({ block, mode }: ImageBlockProps) {
  const src = block.content.src as string | undefined
  const isTemplate = mode === 'template'

  if (src) {
    return (
      <div style={{ padding: '4px 0' }}>
        <img
          src={src}
          alt=""
          style={{
            maxWidth: '100%',
            borderRadius: '6px',
            border: '1px solid var(--border)',
          }}
        />
      </div>
    )
  }

  return (
    <div style={{
      background: 'var(--surface2)',
      border: '1px solid var(--border)',
      borderRadius: '6px',
      padding: '24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '80px',
      cursor: isTemplate ? 'default' : 'pointer',
    }}>
      <span style={{
        fontSize: '12px',
        color: 'var(--t3)',
        fontStyle: isTemplate ? 'italic' : 'normal',
      }}>
        {isTemplate ? '图片占位' : '点击上传图片'}
      </span>
    </div>
  )
}
