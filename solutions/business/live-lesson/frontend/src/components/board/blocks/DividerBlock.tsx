import type { DividerData } from '../../../types/reading'

export default function DividerBlock({ data }: { data: DividerData }) {
  return (
    <div className="bk bk-divider">
      {data.label && <span className="bk-div-label">{data.label}</span>}
    </div>
  )
}
