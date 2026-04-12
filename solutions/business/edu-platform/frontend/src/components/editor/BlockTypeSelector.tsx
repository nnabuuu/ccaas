import type { BlockType } from '../../types/lesson-plan'

interface BlockTypeSelectorProps {
  onSelect: (type: BlockType) => void
  onClose: () => void
}

const BLOCK_TYPES: { type: BlockType; label: string; icon: string }[] = [
  { type: 'section', label: '标题', icon: 'H' },
  { type: 'text', label: '文本', icon: 'T' },
  { type: 'list', label: '列表', icon: '≡' },
  { type: 'table', label: '表格', icon: '#' },
  { type: 'timeline', label: '时间线', icon: '⏐' },
  { type: 'callout', label: '提示', icon: 'i' },
  { type: 'image', label: '图片', icon: '▣' },
]

export function BlockTypeSelector({ onSelect, onClose }: BlockTypeSelectorProps) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 20,
        background: 'var(--bg1)',
        border: '1px solid var(--b1)',
        borderRadius: '8px',
        padding: '4px',
        display: 'flex',
        gap: '2px',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {BLOCK_TYPES.map(({ type, label, icon }) => (
        <button
          key={type}
          onClick={() => {
            onSelect(type)
            onClose()
          }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
            padding: '6px 8px',
            border: 'none',
            background: 'transparent',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '11px',
            color: 'var(--t2)',
            minWidth: '48px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg2)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <span
            style={{
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--bg2)',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--t2)',
            }}
          >
            {icon}
          </span>
          <span style={{ fontSize: '10px' }}>{label}</span>
        </button>
      ))}
    </div>
  )
}
