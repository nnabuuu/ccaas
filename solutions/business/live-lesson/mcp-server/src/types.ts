// SYNC_FIELDS Definition
export const SYNC_FIELDS = ['boardState', 'teacherMessage', 'beatState', 'dynamicBoardActions', 'globalBoardOps'] as const;

export type SyncField = typeof SYNC_FIELDS[number];

// Board node types
export interface SkeletonNode {
  id: string;
  type: 'text' | 'formula' | 'diagram';
  content: string;
  position: { x: number; y: number; w: number; h: number };
  phase: string;
  initiallyHidden: boolean;
  style?: Record<string, string>;
}

// Teaching phase
export interface TeachingPhase {
  id: string;
  name: string;
  description: string;
  order: number;
}

// Chalkboard drawing actions for dynamic board
export type ChalkboardAction =
  | { type: 'write'; text: string; x: number; y: number; fontSize?: number; color?: string; duration?: number }
  | { type: 'draw_line'; x1: number; y1: number; x2: number; y2: number; color?: string; width?: number; duration?: number }
  | { type: 'draw_arc'; cx: number; cy: number; rx: number; ry: number; color?: string; duration?: number }
  | { type: 'draw_path'; points: [number, number][]; closed?: boolean; color?: string; duration?: number }
  | { type: 'highlight_box'; x: number; y: number; w: number; h: number; color?: string; duration?: number }
  | { type: 'transform_region'; regionId: string; scale: number; targetX: number; targetY: number; duration?: number }
  | { type: 'erase'; x: number; y: number; w: number; h: number; duration?: number }
  | { type: 'pause'; duration: number }
  | { type: 'clear'; duration?: number };

// Global board node (persistent left-panel node linked to beats)
export interface GlobalBoardNode {
  id: string;
  label: string;
  x: number; y: number; w: number; h: number;
  linkedBeatIds: string[];
  style?: Record<string, string>;
}

// Beat - atomic teaching unit
export interface Beat {
  id: string;
  sectionId: string;
  narratorText: string;
  dynamicBoardActions: ChalkboardAction[];
  expectedQuestions?: string[];
  studentAck?: string;
}

// Beat progress state
export interface BeatState {
  currentBeatId: string | null;
  currentBeatIndex: number;
  totalBeats: number;
  sectionId: string | null;
}

// Global board operation
export interface GlobalBoardOp {
  nodeId: string;
  op: 'reveal' | 'highlight';
}

// Lesson manifest (loaded from data/lessons/{id}/manifest.json)
export interface LessonManifest {
  id: string;
  title: string;
  subject: string;
  gradeLevel: string;
  teachingNotes?: string;
  boardNodes: SkeletonNode[];
  teachingPhases: TeachingPhase[];
  globalBoardNodes?: GlobalBoardNode[];
  beats?: Beat[];
}

// Highlighted node
export interface HighlightedNode {
  nodeId: string;
  durationMs: number;
  startedAt: number;
  color: 'yellow' | 'red' | 'blue';
}

// Board state (synced to frontend via write_output)
export interface BoardState {
  lessonId: string;
  visibleNodeIds: string[];
  highlightedNodes: HighlightedNode[];
  currentPhase: string;
}

// write_output input/output
export interface WriteOutputInput {
  field: SyncField;
  value: unknown;
  preview: string;
}

export interface WriteOutputResult {
  status: 'success' | 'error';
  data?: {
    field: SyncField;
    value: unknown;
    preview: string;
  };
  error?: string;
}
