import type { BoardBlock as BoardBlockType, BlockStyle } from '../../types/reading'
import HeadingBlock from './blocks/HeadingBlock'
import QuoteBlock from './blocks/QuoteBlock'
import ChipRowBlock from './blocks/ChipRowBlock'
import FlowBlock from './blocks/FlowBlock'
import MatrixBlock from './blocks/MatrixBlock'
import MindmapBlock from './blocks/MindmapBlock'
import CompareBlock from './blocks/CompareBlock'
import AnnotationBlock from './blocks/AnnotationBlock'
import StudentWorkBlock from './blocks/StudentWorkBlock'
import FormulaBlock from './blocks/FormulaBlock'
import ImageBlock from './blocks/ImageBlock'
import DividerBlock from './blocks/DividerBlock'

interface Props {
  block: BoardBlockType
  justRevealed?: boolean
}

export default function BoardBlock({ block, justRevealed }: Props) {
  const style = block.style as BlockStyle | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = block.data as any

  let content: JSX.Element
  switch (block.kind) {
    case 'heading':      content = <HeadingBlock data={data} style={style} />; break
    case 'quote':        content = <QuoteBlock data={data} style={style} />; break
    case 'chip-row':     content = <ChipRowBlock data={data} style={style} />; break
    case 'flow':         content = <FlowBlock data={data} style={style} />; break
    case 'matrix':       content = <MatrixBlock data={data} style={style} />; break
    case 'mindmap':      content = <MindmapBlock data={data} style={style} />; break
    case 'compare':      content = <CompareBlock data={data} />; break
    case 'annotation':   content = <AnnotationBlock data={data} style={style} />; break
    case 'student-work': content = <StudentWorkBlock data={data} style={style} />; break
    case 'formula':      content = <FormulaBlock data={data} style={style} />; break
    case 'image':        content = <ImageBlock data={data} />; break
    case 'divider':      content = <DividerBlock data={data} />; break
    default:             content = <div className="bk bk-unknown">?? {block.kind}</div>
  }

  const gridStyle: React.CSSProperties = {}
  if (block.geometry) {
    gridStyle.gridColumn = `${block.geometry.col} / span ${block.geometry.span}`
    if (block.geometry.row) {
      gridStyle.gridRow = `${block.geometry.row} / span ${block.geometry.rowSpan || 1}`
    }
  }

  return (
    <div
      className={`bk-cell${justRevealed ? ' just-revealed' : ''}`}
      style={gridStyle}
      data-block-id={block.id}
    >
      {content}
    </div>
  )
}
