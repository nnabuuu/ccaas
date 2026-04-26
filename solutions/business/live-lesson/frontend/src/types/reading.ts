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
  type?: 'task' | 'instruction'
  label: string
  labelEn: string
  strategy: string
  duration: number
  description: string
  focusParagraphs: string[]
  // Task metadata (manifest-driven)
  exerciseLabel?: string
  subtitle?: string
  summary?: string
  showRoles?: boolean
  studentView?: {
    title: string
    body: string
    keyPoints?: string[]
    confirmLabel?: string
  }
  discuss?: {
    probe: { q: string; translate?: string }
    targetInsight?: string
    commonMisconceptions?: string[]
    scaffoldStrategies?: string[]
    insight: string
    insightZh?: string
  }
  answerKey?: {
    type: string
    answers: Array<{
      questionIdx?: number
      pairIdx?: number
      rowIdx?: number
      correct?: number | string
      hint?: string
      hintZh?: string
      walkthrough?: string
      walkthroughZh?: string
      questionText?: string
      questionTranslate?: string
      options?: string[]
      // Matrix fields
      place?: string
      isDemo?: boolean
      practice?: string
      reason?: string
      [key: string]: any
    }>
    // Shared match options pool
    options?: string[]
    // Stance fields
    stanceQ?: string
    stanceQZh?: string
    stanceOpts?: string[]
    evidence?: string[]
    // Order fields
    items?: string[]
    correctOrder?: number[] | string[]
  }
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

// ── Observation System ──

export interface ObservationAnchor {
  id: string                    // "K1", "M1", etc.
  type: 'knowledge' | 'misconception'
  label: string
  description: string
  signals: string[]
}

export interface StudentEvent {
  id: string                    // "e1", "e2"
  timestamp: number
  updatedAt: number
  anchors: string[]             // anchor IDs
  gist: string
  quote: string | null
  source: 'llm' | 'system'
  systemType?: 'exercise_result' | 'idle_timeout' | 'step_complete' | 'join' | 'leave'
  data?: Record<string, unknown>
}

export interface StudentLog {
  studentId: string
  studentName: string
  events: StudentEvent[]
  systemMetrics: {
    messageCount: number
    lastActiveAt: number
    exerciseCorrectRate: number
    currentStep: string
  }
}

export type StudentObsStatus = 'active' | 'struggling' | 'stuck' | 'idle' | 'cruising'

export interface Alert {
  timestamp: number
  studentName: string
  studentId: string
  severity: 'info' | 'warn' | 'urgent'
  message: string
  anchorId: string | null
}

export interface AnchorStats {
  anchorId: string
  label: string
  type: 'knowledge' | 'misconception'
  studentCount: number
  latestGist: string
  updatedAt: number
}

// ── Phase Config ──
export interface PhaseConfig {
  id: string
  label: string
  unlockAfter: string | null
}

// ── Reading Manifest (top-level) ──
export interface ReadingManifest {
  id: string
  title: string
  subject: string
  gradeLevel: string
  teachingNotes?: string
  lessonType: string
  lessonIntro?: string
  lessonSummary?: string
  article: Article
  readingSteps: ReadingStep[]
  boardData: BoardData
  cumulativeMinutes: number[]
  observationAnchors?: ObservationAnchor[]
  phaseConfig?: PhaseConfig[]
}
