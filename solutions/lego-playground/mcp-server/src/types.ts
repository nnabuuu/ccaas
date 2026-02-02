// SYNC_FIELDS - Must match frontend and SKILL.md
export const SYNC_FIELDS = [
  'mosaicConfig',
  'placements',
  'billOfMaterials',
  'assessment',
  'iterationHistory',
  'generationStatus',
  'assemblyGuideUrl',
] as const;

export type SyncField = (typeof SYNC_FIELDS)[number];

// LEGO Domain Types
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

export interface RefinementInput {
  feedback: string;
  concernAreas?: Array<{
    description: string;
    type: 'color' | 'placement' | 'structure' | 'coverage';
    region?: { startX: number; startY: number; endX: number; endY: number };
  }>;
}

// Tool input types
export interface WriteOutputInput {
  field: SyncField;
  value: unknown;
  preview: string;
}

export interface AnalyzeImageInput {
  imagePath: string;
  targetWidth?: number;
}

export interface GenerateMosaicInput {
  imagePath: string;
  config: MosaicConfig;
  refinement?: RefinementInput;
}

export interface GenerateMosaicFromGridInput {
  colorGrid: number[][];
  config: MosaicConfig;
}

export interface GenerateMosaicFromCoarseGridInput {
  coarseGrid: number[][];
  targetWidth: number;
  targetHeight: number;
  config: MosaicConfig;
}

export interface RegionEdit {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  operation:
    | { type: 'recolor'; fromColorId: number; toColorId: number }
    | { type: 'fill'; colorId: number }
    | { type: 'fine_grid'; colorGrid: number[][] };
}

export interface RefineMosaicRegionsInput {
  currentGrid: number[][];
  edits: RegionEdit[];
  config: MosaicConfig;
}

export interface GenerateAssemblyPdfInput {
  placements: Placement[];
  bom: BillItem[];
  config: MosaicConfig;
  title?: string;
  outputDir: string;
}
