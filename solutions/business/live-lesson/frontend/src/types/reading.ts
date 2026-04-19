// Reading lesson types — derived from manifest.json + board-data.js

// ── Article ──
export interface Paragraph {
  id: string
  text: string
  role?: 'key' | 'detail'
  highlights?: string[]
  signals?: string[]
}

export interface Article {
  title: string
  source: string
  paragraphs: Paragraph[]
}

// ── Reading Steps ──
export interface ReadingStep {
  id: string
  idx: number
  label: string
  labelEn: string
  strategy: string
  duration: number
  description: string
  focusParagraphs: string[]
}

// ── Board Data ──
export type BlockKind =
  | 'heading'
  | 'quote'
  | 'chip-row'
  | 'flow'
  | 'matrix'
  | 'mindmap'
  | 'compare'
  | 'annotation'
  | 'student-work'
  | 'formula'
  | 'image'
  | 'divider'

export type Tone = 'neutral' | 'accent' | 'warm' | 'cool' | 'muted' | 'success'

export interface RevealPointer {
  step: number
  sub: number
}

export interface BlockGeometry {
  col: number
  span: number
  row?: number
  rowSpan?: number
}

export interface BlockStyle {
  tone?: Tone
  emphasis?: 'strong'
  density?: 'tight'
}

// ── Block Data Types ──
export interface HeadingData {
  eyebrow?: string
  text: string
  accent?: string
}

export interface QuoteData {
  paragraph?: string
  text: string
  highlights?: string[]
}

export interface ChipItem {
  text: string
  note?: string
  tone?: Tone
}

export interface ChipRowData {
  items: ChipItem[]
}

export interface FlowStep {
  paragraph?: string
  label: string
  sub?: string
}

export interface FlowData {
  arrow: string
  steps: FlowStep[]
}

export interface MatrixCell {
  text?: string
  placeholder?: string
  note?: string
  mark?: 'sig' | 'warn' | 'err' | 'ok'
}

export interface MatrixRow {
  tone?: string
  cells: MatrixCell[]
}

export interface MatrixData {
  headers: string[]
  rows: MatrixRow[]
}

export interface MindmapBranch {
  label: string
  leaves?: string[]
}

export interface MindmapData {
  center: { label: string; note?: string }
  branches: MindmapBranch[]
}

export interface CompareSide {
  label: string
  tone?: Tone
  items: string[]
}

export interface CompareData {
  joiner?: string
  left: CompareSide
  right: CompareSide
}

export interface AnnotationData {
  kind: 'note' | 'warning' | 'aha'
  text: string
}

export interface StudentWorkData {
  author: string
  status: 'celebrate' | 'redo' | 'highlight'
  text: string
}

export interface FormulaData {
  expr: string
  caption?: string
}

export interface ImageData {
  src?: string
  alt?: string
  caption?: string
}

export interface DividerData {
  label?: string
}

export type BlockData =
  | HeadingData
  | QuoteData
  | ChipRowData
  | FlowData
  | MatrixData
  | MindmapData
  | CompareData
  | AnnotationData
  | StudentWorkData
  | FormulaData
  | ImageData
  | DividerData

// ── Board Block ──
export interface BoardBlock {
  id: string
  kind: BlockKind
  region?: 'L' | 'C' | 'R'
  geometry: BlockGeometry
  fullBleed?: boolean
  style?: BlockStyle
  reveal: RevealPointer
  data: BlockData
}

// ── Column ──
export interface Column {
  id: string
  title: string
  subtitle?: string
  tone?: Tone | string
  width?: number
}

// ── Board Step ──
export interface BoardStep {
  id: string
  idx: number
  label: string
  layout?: {
    columns: Column[]
  }
}

// ── Board Data ──
export interface BoardData {
  id: string
  lesson: {
    title: string
    subtitle?: string
    class?: string
  }
  steps: BoardStep[]
  blocks: BoardBlock[]
}

// ── Reading Manifest (top-level) ──
export interface ReadingManifest {
  id: string
  title: string
  subject: string
  gradeLevel: string
  teachingNotes?: string
  lessonType: string
  article: Article
  readingSteps: ReadingStep[]
  boardData: BoardData
  cumulativeMinutes: number[]
}
