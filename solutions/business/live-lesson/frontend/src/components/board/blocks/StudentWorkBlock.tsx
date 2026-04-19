import type { StudentWorkData, BlockStyle } from '../../../types/reading'

const STATUS_LABELS: Record<string, string> = {
  highlight: '\u2B50 \u8BFE\u5802\u4EAE\u70B9',
  redo: '\u21BB \u5F85\u4FEE\u8BA2',
  celebrate: '\u2713 \u6EE1\u5206\u53C2\u8003',
}

export default function StudentWorkBlock({ data, style }: { data: StudentWorkData; style?: BlockStyle }) {
  const status = data.status || 'normal'
  return (
    <div className={`bk bk-stu tone-${style?.tone || 'neutral'} stu-${status}`}>
      <div className="bk-stu-hd">
        <span className="bk-stu-author">{data.author}</span>
        <span className="bk-stu-status">{STATUS_LABELS[status] || '\u00B7 \u5B66\u751F\u4F5C\u54C1'}</span>
      </div>
      <div className="bk-stu-text">&ldquo;{data.text}&rdquo;</div>
    </div>
  )
}
