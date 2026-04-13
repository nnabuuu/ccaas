import type { Block } from '../../../types/lesson-plan'

interface TimelineEntry {
  time: string
  duration: string
  description: string
}

interface TimelineBlockProps {
  block: Block
  mode: 'lesson' | 'template'
  onChange: (content: Record<string, unknown>) => void
  readOnly?: boolean
}

export function TimelineBlock({ block, mode, onChange, readOnly }: TimelineBlockProps) {
  const entries = (block.content.entries as TimelineEntry[]) || [
    { time: '0-5\'', duration: '5min', description: '' },
  ]
  const placeholder = block.placeholder || '描述该环节的教学活动...'

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

  const handleEntryChange = (index: number, field: keyof TimelineEntry, value: string) => {
    const newEntries = entries.map((entry, i) =>
      i === index ? { ...entry, [field]: value } : entry
    )
    onChange({ ...block.content, entries: newEntries })
  }

  const handleAddEntry = () => {
    onChange({
      ...block.content,
      entries: [...entries, { time: '', duration: '', description: '' }],
    })
  }

  const handleRemoveEntry = (index: number) => {
    if (entries.length <= 1) return
    const newEntries = entries.filter((_, i) => i !== index)
    onChange({ ...block.content, entries: newEntries })
  }

  return (
    <div style={{ padding: '4px 0' }}>
      {entries.map((entry, i) => (
        <div key={i} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '4px',
          fontSize: '12px',
        }}>
          {readOnly ? (
            <>
              <span style={{ width: '50px', flexShrink: 0, color: 'var(--t2)', fontSize: '10px' }}>
                {entry.time}
              </span>
              <span style={{ width: '46px', flexShrink: 0, color: 'var(--t3)', fontSize: '10px' }}>
                {entry.duration}
              </span>
              <span style={{ flex: 1, color: 'var(--t1)' }}>{entry.description}</span>
            </>
          ) : (
            <>
              <input
                type="text"
                value={entry.time}
                onChange={(e) => handleEntryChange(i, 'time', e.target.value)}
                placeholder="0-5'"
                style={{
                  width: '50px',
                  flexShrink: 0,
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  padding: '3px 6px',
                  fontSize: '10px',
                  fontFamily: 'inherit',
                  background: 'var(--surface)',
                  color: 'var(--t2)',
                  outline: 'none',
                }}
              />
              <input
                type="text"
                value={entry.duration}
                onChange={(e) => handleEntryChange(i, 'duration', e.target.value)}
                placeholder="5min"
                style={{
                  width: '46px',
                  flexShrink: 0,
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  padding: '3px 6px',
                  fontSize: '10px',
                  fontFamily: 'inherit',
                  background: 'var(--surface)',
                  color: 'var(--t3)',
                  outline: 'none',
                }}
              />
              <input
                type="text"
                value={entry.description}
                onChange={(e) => handleEntryChange(i, 'description', e.target.value)}
                placeholder="描述教学活动..."
                style={{
                  flex: 1,
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  padding: '3px 6px',
                  fontSize: '12px',
                  fontFamily: 'inherit',
                  background: 'var(--surface)',
                  color: 'var(--t1)',
                  outline: 'none',
                }}
              />
              {entries.length > 1 && (
                <button
                  onClick={() => handleRemoveEntry(i)}
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
            </>
          )}
        </div>
      ))}
      {!readOnly && (
        <button
          onClick={handleAddEntry}
          style={{
            border: 'none',
            background: 'transparent',
            color: 'var(--t3)',
            fontSize: '11px',
            cursor: 'pointer',
            padding: '4px 0',
            fontFamily: 'inherit',
          }}
        >
          + 添加时间段
        </button>
      )}
    </div>
  )
}
