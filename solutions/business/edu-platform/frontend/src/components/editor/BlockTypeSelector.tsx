import type { BlockType } from '../../types/lesson-plan'

interface BlockTypeSelectorProps {
  onSelect: (type: BlockType) => void
  onClose: () => void
}

const BLOCK_TYPES: { type: BlockType; label: string; icon: string }[] = [
  { type: 'section', label: '章节标题', icon: 'H' },
  { type: 'text', label: '文本', icon: 'T' },
  { type: 'list', label: '列表', icon: '≡' },
  { type: 'table', label: '表格', icon: '⊞' },
  { type: 'timeline', label: '时间线', icon: '◷' },
  { type: 'callout', label: '备注', icon: '!' },
  { type: 'image', label: '图片', icon: '▣' },
]

export function BlockTypeSelector({ onSelect, onClose }: BlockTypeSelectorProps) {
  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99,
        }}
        onClick={onClose}
      />
      <div style={{
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        top: '100%',
        marginTop: '4px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '6px',
        display: 'flex',
        gap: '2px',
        zIndex: 100,
      }}>
        {BLOCK_TYPES.map(({ type, label, icon }) => (
          <button
            key={type}
            onClick={() => {
              onSelect(type)
              onClose()
            }}
            title={label}
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
              fontFamily: 'inherit',
              transition: 'background .15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--surface2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <span style={{
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--surface2)',
              borderRadius: '6px',
              fontSize: '14px',
              color: 'var(--t2)',
              fontWeight: 500,
            }}>
              {icon}
            </span>
            <span style={{
              fontSize: '9px',
              color: 'var(--t3)',
              whiteSpace: 'nowrap',
            }}>
              {label}
            </span>
          </button>
        ))}
      </div>
    </>
  )
}
