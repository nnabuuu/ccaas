import type { FormulaData, BlockStyle } from '../../../types/reading'

export default function FormulaBlock({ data, style }: { data: FormulaData; style?: BlockStyle }) {
  return (
    <div className={`bk bk-formula tone-${style?.tone || 'neutral'}`}>
      <div className="bk-fm-expr">{data.expr}</div>
      {data.caption && <div className="bk-fm-cap">{data.caption}</div>}
    </div>
  )
}
