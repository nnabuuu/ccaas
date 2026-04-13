import type { Block } from '../../../types/lesson-plan'

interface TableBlockProps {
  block: Block
  mode: 'lesson' | 'template'
  onChange: (content: Record<string, unknown>) => void
  readOnly?: boolean
}

export function TableBlock({ block, mode, onChange, readOnly }: TableBlockProps) {
  const headers = (block.content.headers as string[]) || ['列1', '列2']
  const rows = (block.content.rows as string[][]) || [['', '']]

  const handleHeaderChange = (index: number, value: string) => {
    const newHeaders = [...headers]
    newHeaders[index] = value
    onChange({ ...block.content, headers: newHeaders })
  }

  const handleCellChange = (rowIdx: number, colIdx: number, value: string) => {
    const newRows = rows.map((row, ri) =>
      ri === rowIdx ? row.map((cell, ci) => ci === colIdx ? value : cell) : [...row]
    )
    onChange({ ...block.content, rows: newRows })
  }

  const handleAddRow = () => {
    const newRow = headers.map(() => '')
    onChange({ ...block.content, rows: [...rows, newRow] })
  }

  const isEditable = mode === 'lesson' && !readOnly

  return (
    <div style={{ padding: '4px 0', overflowX: 'auto' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '12px',
      }}>
        <thead>
          <tr>
            {headers.map((header, i) => (
              <th key={i} style={{
                background: 'var(--surface2)',
                padding: '6px 10px',
                textAlign: 'left',
                fontWeight: 600,
                fontSize: '11px',
                color: 'var(--t2)',
                borderBottom: '1px solid var(--border)',
              }}>
                {isEditable ? (
                  <input
                    type="text"
                    value={header}
                    onChange={(e) => handleHeaderChange(i, e.target.value)}
                    style={{
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      fontSize: '11px',
                      fontWeight: 600,
                      fontFamily: 'inherit',
                      color: 'var(--t2)',
                      width: '100%',
                    }}
                  />
                ) : header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} style={{
                  padding: '6px 10px',
                  borderBottom: '1px solid var(--border)',
                  color: mode === 'template' ? 'var(--t3)' : 'var(--t1)',
                  fontStyle: mode === 'template' ? 'italic' : 'normal',
                }}>
                  {isEditable ? (
                    <input
                      type="text"
                      value={cell}
                      onChange={(e) => handleCellChange(ri, ci, e.target.value)}
                      style={{
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        fontSize: '12px',
                        fontFamily: 'inherit',
                        color: 'var(--t1)',
                        width: '100%',
                      }}
                    />
                  ) : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {isEditable && (
        <button
          onClick={handleAddRow}
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
          + 添加行
        </button>
      )}
    </div>
  )
}
