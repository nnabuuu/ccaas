// SYNC_FIELDS Definition
export const SYNC_FIELDS = ['boardState', 'teacherMessage'] as const;

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
  confusionPointId?: string;
}

// Confusion point types
export interface SecondaryProbe {
  id: string;
  label: string;
  remediation: string;
}

export interface ConfusionPoint {
  id: string;
  triggerNodeId: string;
  boardNodeToFlash: string;
  secondaryProbes: SecondaryProbe[];
}

// Teaching phase
export interface TeachingPhase {
  id: string;
  name: string;
  description: string;
  order: number;
}

// Lesson manifest (loaded from data/lessons/{id}/manifest.json)
export interface LessonManifest {
  id: string;
  title: string;
  subject: string;
  gradeLevel: string;
  boardNodes: SkeletonNode[];
  teachingPhases: TeachingPhase[];
  confusionPoints: ConfusionPoint[];
}

// Highlighted node
export interface HighlightedNode {
  nodeId: string;
  durationMs: number;
  startedAt: number;
  color: 'yellow' | 'red' | 'blue';
}

// Active probe button
export interface ActiveProbe {
  id: string;
  label: string;
  confusionPointId: string;
}

// Board state (synced to frontend via write_output)
export interface BoardState {
  lessonId: string;
  visibleNodeIds: string[];
  highlightedNodes: HighlightedNode[];
  activeProbes: ActiveProbe[];
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
