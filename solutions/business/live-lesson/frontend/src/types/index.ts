// Board state types (mirror of MCP server types)

export interface HighlightedNode {
  nodeId: string
  durationMs: number
  startedAt: number
  color: 'yellow' | 'red' | 'blue'
}

export interface ActiveProbe {
  id: string
  label: string
  confusionPointId: string
}

export interface BoardState {
  lessonId: string
  visibleNodeIds: string[]
  highlightedNodes: HighlightedNode[]
  activeProbes: ActiveProbe[]
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
  confusionPointId?: string
}

export interface LessonManifest {
  id: string
  title: string
  subject: string
  gradeLevel: string
  boardNodes: SkeletonNodeDef[]
  teachingPhases: Array<{
    id: string
    name: string
    description: string
    order: number
  }>
  confusionPoints: Array<{
    id: string
    triggerNodeId: string
    boardNodeToFlash: string
    secondaryProbes: Array<{
      id: string
      label: string
      remediation: string
    }>
  }>
}
