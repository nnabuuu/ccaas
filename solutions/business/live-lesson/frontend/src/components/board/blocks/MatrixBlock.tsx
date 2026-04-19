import type { MatrixData, BlockStyle } from '../../../types/reading'

export default function MatrixBlock({ data, style }: { data: MatrixData; style?: BlockStyle }) {
  return (
    <div className={`bk bk-matrix tone-${style?.tone || 'neutral'}`}>
      <table className="bk-mx">
        <thead>
          <tr>
            {data.headers.map((h, i) => <th key={i}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, ri) => (
            <tr key={ri} className={`bk-mx-row ${row.tone ? `mx-${row.tone}` : ''}`}>
              {row.cells.map((cell, ci) => (
                <td key={ci} className={`bk-mx-cell ${cell.mark ? `mark-${cell.mark}` : ''}`}>
                  {cell.text != null
                    ? <span className="bk-mx-val">{cell.text}</span>
                    : <span className="bk-mx-empty">{cell.placeholder || '\u2014\u2014'}</span>
                  }
                  {cell.note && <span className="bk-mx-note">{cell.note}</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
