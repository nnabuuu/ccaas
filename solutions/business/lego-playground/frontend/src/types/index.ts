// LEGO Domain Types — must match mcp-server/src/types.ts

export interface LegoColor {
  bricklinkId: number;
  name: string;
  nameZh: string;
  hex: string;
  rgb: [number, number, number];
  isTransparent: boolean;
  isMetallic: boolean;
}

export interface BrickPart {
  bricklinkId: string;
  name: string;
  nameZh: string;
  partType: 'plate' | 'tile' | 'round_plate' | 'round_tile';
  widthStuds: number;
  heightStuds: number;
  coveragePattern: Array<{ x: number; y: number }>;
  isDefault: boolean;
}

export interface Placement {
  brickId: string;
  colorId: number;
  x: number;
  y: number;
  layer: number;
  rotation: 0 | 90 | 180 | 270;
}

export interface BillItem {
  brickId: string;
  colorId: number;
  quantity: number;
}

export interface MosaicConfig {
  widthStuds: number;
  heightStuds: number;
  layerCount: 2 | 3;
  colorPalette: number[];
  brickPool: string[];
  resampling: 'lanczos' | 'mitchell';
  backgroundColor: string;
}

export interface MosaicResult {
  placements: Placement[];
  billOfMaterials: BillItem[];
  metadata: {
    generationTimestamp: string;
    totalBrickCount: number;
    uniqueColorsUsed: number;
    coveragePercent: number;
    algorithm: string;
  };
}

export interface ImageAnalysis {
  dominantColors: Array<{
    hex: string;
    rgb: [number, number, number];
    percentage: number;
    nearestLegoColor: { id: number; name: string; hex: string };
  }>;
  composition: 'portrait' | 'landscape' | 'symmetric' | 'complex';
  complexity: 'low' | 'medium' | 'high';
  recommendedSize: { width: number; height: number };
  suggestedPalette: number[];
  imageWidth: number;
  imageHeight: number;
}

export interface LLMAssessment {
  overallScore: number;
  colorAccuracy: number;
  structuralIntegrity: number;
  visualAppeal: number;
  summary: string;
  issues: string[];
  suggestions: Array<{
    type: 'color' | 'placement' | 'structure' | 'coverage';
    priority: number;
    description: string;
  }>;
}

export interface IterationSummary {
  iterationNumber: number;
  overallScore: number;
  decision: 'approve' | 'reject' | 'refine' | 'pending';
  feedback?: string;
  timestamp: string;
}

export interface GenerationStatus {
  phase: 'idle' | 'analyzing' | 'generating' | 'assessing' | 'complete' | 'error';
  progress: number;
  message: string;
}

export type SyncField =
  | 'mosaicConfig'
  | 'placements'
  | 'billOfMaterials'
  | 'assessment'
  | 'iterationHistory'
  | 'generationStatus'
  | 'assemblyGuideUrl';

// Chat message type
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  attachments?: Array<{
    type: 'assessment' | 'image' | 'file';
    data: unknown;
  }>;
}

// App state
export interface MosaicState {
  // Image
  sourceImage: File | null;
  sourceImageUrl: string | null;
  imageAnalysis: ImageAnalysis | null;

  // Config
  config: MosaicConfig;

  // Catalog
  colors: LegoColor[];
  bricks: BrickPart[];
  catalogLoaded: boolean;

  // Results
  placements: Placement[];
  billOfMaterials: BillItem[];
  assessment: LLMAssessment | null;
  iterationHistory: IterationSummary[];
  generationStatus: GenerationStatus;
  assemblyGuideUrl: string | null;

  // Session
  sessionId: string | null;
  currentIteration: number;
  maxIterations: number;

  // Chat
  messages: ChatMessage[];

  // UI
  selectedLayer: number | null;
  visibleLayers: boolean[];
  showOriginalOverlay: boolean;
  canvasZoom: number;
  bomExpanded: boolean;
}
