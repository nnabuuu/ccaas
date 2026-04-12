import type { Block } from '../../../types/lesson-plan'

interface ListBlockProps {
  block: Block
  mode: 'lesson' | 'template'
  onChange: (content: Record<string, unknown>) => void
  readOnly?: boolean
}

export function ListBlock({ block, mode, onChange, readOnly }: ListBlockProps) {
  const rawItems = block.content.items
  const items: string[] = Array.isArray(rawItems)
    ? (rawItems as unknown[]).map((item) => String(item))
    : []
  const ordered = Boolean(block.content.ordered)
  const placeholder = block.placeholder ?? '在此添加列表项...'

  if (mode === 'template') {
    return (
      <div
        style={{
          fontSize: '13px',
          lineHeight: 1.7,
          color: 'var(--t3)',
          fontStyle: 'italic',
          padding: '4px 0',
          paddingLeft: '18px',
        }}
      >
        {placeholder}
      </div>
    )
  }

  const ListTag = ordered ? 'ol' : 'ul'

  const handleItemChange = (index: number, value: string) => {
    const newItems = [...items]
    newItems[index] = value
    onChange({ items: newItems, ordered })
  }

  const handleAddItem = () => {
    onChange({ items: [...items, ''], ordered })
  }

  const handleRemoveItem = (index: number) => {
    onChange({ items: items.filter((_, i) => i !== index), ordered })
  }

  return (
    <div style={{ padding: '4px 0' }}>
      <ListTag
        style={{
          paddingLeft: '18px',
          margin: 0,
          fontSize: '13px',
          lineHeight: 1.7,
          color: 'var(--t1)',
        }}
      >
        {items.map((item, index) => (
          <li key={index} style={{ marginBottom: '2px' }}>
            {readOnly ? (
              <span>{item}</span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleItemChange(index, e.currentTarget.textContent ?? '')}
                  style={{
                    flex: 1,
                    outline: 'none',
                    minWidth: '40px',
                  }}
                >
                  {item}
                </span>
                <button
                  onClick={() => handleRemoveItem(index)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--t3)',
                    cursor: 'pointer',
                    fontSize: '11px',
                    padding: '0 2px',
                    flexShrink: 0,
                  }}
                >
                  ×
                </button>
              </span>
            )}
          </li>
        ))}
      </ListTag>
      {!readOnly && (
        <button
          onClick={handleAddItem}
          style={{
            border: 'none',
            background: 'transparent',
            color: 'var(--t3)',
            cursor: 'pointer',
            fontSize: '11px',
            padding: '4px 0',
            marginLeft: '18px',
          }}
        >
          + 添加项
        </button>
      )}
    </div>
  )
}
