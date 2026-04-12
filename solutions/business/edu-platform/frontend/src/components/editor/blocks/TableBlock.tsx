import type { Block } from '../../../types/lesson-plan'

interface TableBlockProps {
  block: Block
  mode: 'lesson' | 'template'
  onChange: (content: Record<string, unknown>) => void
  readOnly?: boolean
}

export function TableBlock({ block, mode, onChange, readOnly }: TableBlockProps) {
  const rawHeaders = block.content.headers
  const headers: string[] = Array.isArray(rawHeaders)
    ? (rawHeaders as unknown[]).map((h) => String(h))
    : ['列1', '列2']
  const rawRows = block.content.rows
  const rows: string[][] = Array.isArray(rawRows)
    ? (rawRows as unknown[]).map((row) =>
        Array.isArray(row) ? (row as unknown[]).map((cell) => String(cell)) : []
      )
    : []

  const handleCellChange = (rowIdx: number, colIdx: number, value: string) => {
    const newRows = rows.map((row, ri) =>
      ri === rowIdx ? row.map((cell, ci) => (ci === colIdx ? value : cell)) : [...row]
    )
    onChange({ headers, rows: newRows })
  }

  const handleHeaderChange = (colIdx: number, value: string) => {
    const newHeaders = headers.map((h, i) => (i === colIdx ? value : h))
    onChange({ headers: newHeaders, rows })
  }

  const handleAddRow = () => {
    const newRow = headers.map(() => '')
    onChange({ headers, rows: [...rows, newRow] })
  }

  const isTemplate = mode === 'template'

  return (
    <div style={{ padding: '4px 0', overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '12px',
        }}
      >
        <thead>
          <tr>
            {headers.map((header, colIdx) => (
              <th
                key={colIdx}
                style={{
                  background: 'var(--bg2)',
                  padding: '6px 10px',
                  textAlign: 'left',
                  fontWeight: 500,
                  fontSize: '11px',
                  color: 'var(--t2)',
                  borderBottom: '1px solid var(--b1)',
                }}
              >
                {readOnly || isTemplate ? (
                  header
                ) : (
                  <input
                    type="text"
                    value={header}
                    onChange={(e) => handleHeaderChange(colIdx, e.target.value)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      fontWeight: 500,
                      fontSize: '11px',
                      color: 'var(--t2)',
                      width: '100%',
                      padding: 0,
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr key={rowIdx}>
              {row.map((cell, colIdx) => (
                <td
                  key={colIdx}
                  style={{
                    padding: '6px 10px',
                    borderBottom: '1px solid var(--b1)',
                    fontSize: '12px',
                    color: isTemplate ? 'var(--t3)' : 'var(--t1)',
                    fontStyle: isTemplate ? 'italic' : 'normal',
                  }}
                >
                  {readOnly || isTemplate ? (
                    cell || (isTemplate ? '...' : '')
                  ) : (
                    <input
                      type="text"
                      value={cell}
                      onChange={(e) => handleCellChange(rowIdx, colIdx, e.target.value)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        fontSize: '12px',
                        color: 'var(--t1)',
                        width: '100%',
                        padding: 0,
                        outline: 'none',
                        fontFamily: 'inherit',
                      }}
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
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
            marginTop: '4px',
          }}
        >
          + 添加行
        </button>
      )}
    </div>
  )
}
