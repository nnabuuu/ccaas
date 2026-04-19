import type { Column } from '../../types/reading'

export default function ColumnHeader({ column }: { column: Column }) {
  return (
    <div className="col-hd">
      {column.title && <div className="col-title">{column.title}</div>}
      {column.subtitle && <div className="col-subtitle">{column.subtitle}</div>}
    </div>
  )
}
