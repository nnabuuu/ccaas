import type { Block } from '../../../types/lesson-plan'

interface ImageBlockProps {
  block: Block
  mode: 'lesson' | 'template'
  onChange: (content: Record<string, unknown>) => void
  readOnly?: boolean
}

export function ImageBlock({ block, mode }: ImageBlockProps) {
  const url = typeof block.content.url === 'string' ? block.content.url : ''
  const isTemplate = mode === 'template'

  if (url) {
    return (
      <div style={{ padding: '4px 0' }}>
        <img
          src={url}
          alt={String(block.content.alt ?? '图片')}
          style={{
            maxWidth: '100%',
            borderRadius: '6px',
            border: '1px solid var(--b1)',
          }}
        />
      </div>
    )
  }

  return (
    <div
      style={{
        background: 'var(--bg2)',
        borderRadius: '6px',
        padding: '24px',
        textAlign: 'center',
        color: 'var(--t3)',
        fontSize: '12px',
        border: '1px dashed var(--b1)',
      }}
    >
      {isTemplate ? '图片占位' : '点击上传图片'}
    </div>
  )
}
