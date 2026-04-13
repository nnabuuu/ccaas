import type { Block } from '../../../types/lesson-plan'

interface ListBlockProps {
  block: Block
  mode: 'lesson' | 'template'
  onChange: (content: Record<string, unknown>) => void
  readOnly?: boolean
}

export function ListBlock({ block, mode, onChange, readOnly }: ListBlockProps) {
  const items = (block.content.items as string[]) || ['']
  const ordered = (block.content.ordered as boolean) || false
  const placeholder = block.placeholder || '输入列表项...'

  if (mode === 'template') {
    return (
      <div style={{
        fontSize: '13px',
        lineHeight: 1.7,
        color: 'var(--t3)',
        fontStyle: 'italic',
        padding: '4px 0',
        paddingLeft: '18px',
      }}>
        {placeholder}
      </div>
    )
  }

  const handleItemChange = (index: number, value: string) => {
    const newItems = [...items]
    newItems[index] = value
    onChange({ ...block.content, items: newItems })
  }

  const handleAddItem = () => {
    onChange({ ...block.content, items: [...items, ''] })
  }

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return
    const newItems = items.filter((_, i) => i !== index)
    onChange({ ...block.content, items: newItems })
  }

  const Tag = ordered ? 'ol' : 'ul'

  return (
    <div style={{ padding: '4px 0' }}>
      <Tag style={{
        paddingLeft: '18px',
        margin: 0,
        fontSize: '13px',
        lineHeight: 1.7,
        color: 'var(--t1)',
      }}>
        {items.map((item, i) => (
          <li key={i} style={{ marginBottom: '2px' }}>
            {readOnly ? (
              <span>{item}</span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="text"
                  value={item}
                  onChange={(e) => handleItemChange(i, e.target.value)}
                  placeholder="输入列表项..."
                  style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                    color: 'var(--t1)',
                  }}
                />
                {items.length > 1 && (
                  <button
                    onClick={() => handleRemoveItem(i)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--t3)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      padding: '0 2px',
                      fontFamily: 'inherit',
                    }}
                  >
                    ×
                  </button>
                )}
              </span>
            )}
          </li>
        ))}
      </Tag>
      {!readOnly && (
        <button
          onClick={handleAddItem}
          style={{
            border: 'none',
            background: 'transparent',
            color: 'var(--t3)',
            fontSize: '11px',
            cursor: 'pointer',
            padding: '4px 0 4px 18px',
            fontFamily: 'inherit',
          }}
        >
          + 添加项
        </button>
      )}
    </div>
  )
}
