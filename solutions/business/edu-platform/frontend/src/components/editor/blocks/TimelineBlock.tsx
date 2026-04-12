import type { Block, TimelineRow } from '../../../types/lesson-plan'

interface TimelineBlockProps {
  block: Block
  mode: 'lesson' | 'template'
  onChange: (content: Record<string, unknown>) => void
  readOnly?: boolean
}

function parseRows(raw: unknown): TimelineRow[] {
  if (!Array.isArray(raw)) return []
  return (raw as unknown[]).map((item) => {
    const obj = item as Record<string, unknown>
    return {
      time: String(obj.time ?? ''),
      duration: String(obj.duration ?? ''),
      description: String(obj.description ?? ''),
    }
  })
}

export function TimelineBlock({ block, mode, onChange, readOnly }: TimelineBlockProps) {
  const rows = parseRows(block.content.rows)
  const isTemplate = mode === 'template'

  const handleRowChange = (index: number, field: keyof TimelineRow, value: string) => {
    const newRows = rows.map((row, i) =>
      i === index ? { ...row, [field]: value } : row
    )
    onChange({ rows: newRows })
  }

  const handleAddRow = () => {
    onChange({ rows: [...rows, { time: '', duration: '', description: '' }] })
  }

  const handleRemoveRow = (index: number) => {
    onChange({ rows: rows.filter((_, i) => i !== index) })
  }

  return (
    <div style={{ padding: '4px 0' }}>
      {rows.map((row, index) => (
        <div
          key={index}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            padding: '4px 0',
            borderBottom: index < rows.length - 1 ? '1px solid var(--b1)' : undefined,
          }}
        >
          {/* Time */}
          <div style={{ width: '50px', flexShrink: 0 }}>
            {readOnly || isTemplate ? (
              <span
                style={{
                  fontSize: '12px',
                  color: 'var(--t1)',
                  fontWeight: 500,
                }}
              >
                {row.time || '0\''}
              </span>
            ) : (
              <input
                type="text"
                value={row.time}
                onChange={(e) => handleRowChange(index, 'time', e.target.value)}
                placeholder="0-5'"
                style={{
                  width: '100%',
                  border: 'none',
                  background: 'transparent',
                  fontSize: '12px',
                  color: 'var(--t1)',
                  fontWeight: 500,
                  padding: 0,
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
            )}
          </div>

          {/* Duration */}
          <div style={{ width: '46px', flexShrink: 0 }}>
            {readOnly || isTemplate ? (
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--t3)',
                }}
              >
                {row.duration || ''}
              </span>
            ) : (
              <input
                type="text"
                value={row.duration}
                onChange={(e) => handleRowChange(index, 'duration', e.target.value)}
                placeholder="5min"
                style={{
                  width: '100%',
                  border: 'none',
                  background: 'transparent',
                  fontSize: '11px',
                  color: 'var(--t3)',
                  padding: 0,
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
            )}
          </div>

          {/* Description */}
          <div style={{ flex: 1 }}>
            {isTemplate ? (
              <span
                style={{
                  fontSize: '12px',
                  color: 'var(--t3)',
                  fontStyle: 'italic',
                }}
              >
                {block.placeholder ?? (row.description || '环节描述...')}
              </span>
            ) : readOnly ? (
              <span style={{ fontSize: '12px', color: 'var(--t1)' }}>
                {row.description}
              </span>
            ) : (
              <input
                type="text"
                value={row.description}
                onChange={(e) => handleRowChange(index, 'description', e.target.value)}
                placeholder="环节描述..."
                style={{
                  width: '100%',
                  border: 'none',
                  background: 'transparent',
                  fontSize: '12px',
                  color: 'var(--t1)',
                  padding: 0,
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
            )}
          </div>

          {/* Remove button */}
          {!readOnly && !isTemplate && rows.length > 1 && (
            <button
              onClick={() => handleRemoveRow(index)}
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
          )}
        </div>
      ))}
      {!readOnly && !isTemplate && (
        <button
          onClick={handleAddRow}
          style={{
            border: 'none',
            background: 'transparent',
            color: 'var(--t3)',
            cursor: 'pointer',
            fontSize: '11px',
            padding: '4px 0',
          }}
        >
          + 添加时间段
        </button>
      )}
    </div>
  )
}
