import HelpButton from '../HelpButton'

import type { TaskMatrixRow, ServerHintMap } from '../task-data'

interface Props {
  rows: TaskMatrixRow[]
  serverHints?: ServerHintMap
  ans?: Record<number, { what?: string; why?: string }>
  onAnsChange?: (rowIdx: number, field: 'what' | 'why', value: string) => void
  disabled?: boolean
}

export function MatrixExercise({ rows, serverHints, ans = {}, onAnsChange, disabled }: Props) {
  return (
    <div className="stu-mat-wrap">
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th className="stu-mat-th" style={{ width: '24%' }}>Where / When</th>
            <th className="stu-mat-th" style={{ width: '38%' }}>What they do</th>
            <th className="stu-mat-th" style={{ width: '38%' }}>Why</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => {
            const sh = serverHints?.[ri]
            return (
            <tr key={ri} style={r.demo ? { background: 'rgba(13,82,69,.03)' } : undefined}>
              <td className="stu-mat-td" style={{ fontWeight: 500, fontSize: 12 }}>{r.place}</td>
              <td className="stu-mat-td">
                {r.demo ? r.practice : (
                  <div>
                    <input className="stu-mat-in" placeholder="What?" value={ans[ri]?.what || ''} onChange={e => onAnsChange?.(ri, 'what', e.target.value)} disabled={disabled} />
                    <div style={{ marginTop: 2 }}><HelpButton hint={sh?.hint ?? r.hint} hintZh={sh?.hintZh ?? r.hintZh} /></div>
                  </div>
                )}
              </td>
              <td className="stu-mat-td">{r.demo ? r.reason : <input className="stu-mat-in" placeholder="Why?" value={ans[ri]?.why || ''} onChange={e => onAnsChange?.(ri, 'why', e.target.value)} disabled={disabled} />}</td>
            </tr>
          )})}

        </tbody>
      </table>
    </div>
  )
}
