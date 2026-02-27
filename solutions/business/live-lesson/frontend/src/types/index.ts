// Board state types (mirror of MCP server types)

import type { ChalkboardAction } from './blackboard-actions'

export interface HighlightedNode {
  nodeId: string
  durationMs: number
  startedAt: number
  color: 'yellow' | 'red' | 'blue'
}

export interface BoardState {
  lessonId: string
  visibleNodeIds: string[]
  highlightedNodes: HighlightedNode[]
  currentPhase: string
}

// Lesson manifest types (for rendering the board)
export interface SkeletonNodeDef {
  id: string
  type: 'text' | 'formula' | 'diagram'
  content: string
  position: { x: number; y: number; w: number; h: number }
  phase: string
  initiallyHidden: boolean
  style?: Record<string, string>
}

export interface LessonManifest {
  id: string
  title: string
  subject: string
  gradeLevel: string
  teachingNotes?: string
  boardNodes: SkeletonNodeDef[]
  teachingPhases: Array<{
    id: string
    name: string
    description: string
    order: number
  }>
  globalBoardNodes?: GlobalBoardNode[]
  beats?: Beat[]
}

// Beat-driven architecture types

export interface GlobalBoardNode {
  id: string
  label: string
  x: number
  y: number
  w: number
  h: number
  linkedBeatIds: string[]
  style?: Record<string, string>
}

export interface Beat {
  id: string
  sectionId: string
  narratorText: string
  dynamicBoardActions: ChalkboardAction[]
  expectedQuestions?: string[]
  studentAck?: string
}

export interface BeatState {
  currentBeatId: string | null
  currentBeatIndex: number
  totalBeats: number
  sectionId: string | null
}

export interface GlobalBoardOp {
  nodeId: string
  op: 'reveal' | 'highlight'
}

export interface BeatSnapshot {
  beatId: string
  beatIndex: number
  sectionId: string
  svgSnapshot: string  // BlackboardPlayer SVG innerHTML
  narratorText: string
}
