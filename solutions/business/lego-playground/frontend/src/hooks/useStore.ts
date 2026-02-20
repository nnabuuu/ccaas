import { create } from 'zustand';
import type {
  MosaicState,
  MosaicConfig,
  Placement,
  BillItem,
  LLMAssessment,
  IterationSummary,
  GenerationStatus,
  ImageAnalysis,
  LegoColor,
  BrickPart,
  ChatMessage,
} from '../types';

const DEFAULT_CONFIG: MosaicConfig = {
  widthStuds: 48,
  heightStuds: 48,
  layerCount: 2,
  colorPalette: [],
  brickPool: [],
  resampling: 'lanczos',
  backgroundColor: '#FFFFFF',
};

const DEFAULT_STATUS: GenerationStatus = {
  phase: 'idle',
  progress: 0,
  message: '',
};

interface MosaicActions {
  // Image
  setSourceImage: (file: File | null) => void;
  setSourceImageUrl: (url: string | null) => void;
  setImageAnalysis: (analysis: ImageAnalysis | null) => void;

  // Config
  setConfig: (config: Partial<MosaicConfig>) => void;
  resetConfig: () => void;
  toggleColor: (colorId: number) => void;
  toggleBrick: (brickId: string) => void;

  // Catalog
  setCatalog: (colors: LegoColor[], bricks: BrickPart[]) => void;

  // Results (sync from AI)
  setPlacements: (placements: Placement[]) => void;
  setBillOfMaterials: (bom: BillItem[]) => void;
  setAssessment: (assessment: LLMAssessment | null) => void;
  setIterationHistory: (history: IterationSummary[]) => void;
  setGenerationStatus: (status: GenerationStatus) => void;
  setAssemblyGuideUrl: (url: string | null) => void;

  // Sync field handler (from write_output events)
  handleSyncField: (field: string, value: unknown) => void;

  // Session
  setSessionId: (id: string | null) => void;
  incrementIteration: () => void;

  // Chat
  addMessage: (message: ChatMessage) => void;
  clearMessages: () => void;

  // UI
  setSelectedLayer: (layer: number | null) => void;
  toggleLayerVisibility: (layer: number) => void;
  setShowOriginalOverlay: (show: boolean) => void;
  setCanvasZoom: (zoom: number) => void;
  setBomExpanded: (expanded: boolean) => void;

  // Reset
  resetAll: () => void;
}

export const useMosaicStore = create<MosaicState & MosaicActions>((set, get) => ({
  // Initial state
  sourceImage: null,
  sourceImageUrl: null,
  imageAnalysis: null,
  config: { ...DEFAULT_CONFIG },
  colors: [],
  bricks: [],
  catalogLoaded: false,
  placements: [],
  billOfMaterials: [],
  assessment: null,
  iterationHistory: [],
  generationStatus: { ...DEFAULT_STATUS },
  assemblyGuideUrl: null,
  sessionId: null,
  currentIteration: 0,
  maxIterations: 5,
  messages: [],
  selectedLayer: null,
  visibleLayers: [true, true, true],
  showOriginalOverlay: false,
  canvasZoom: 1,
  bomExpanded: false,

  // Actions
  setSourceImage: (file) => {
    const url = file ? URL.createObjectURL(file) : null;
    const prev = get().sourceImageUrl;
    if (prev) URL.revokeObjectURL(prev);
    set({ sourceImage: file, sourceImageUrl: url });
  },
  setSourceImageUrl: (url) => set({ sourceImageUrl: url }),
  setImageAnalysis: (analysis) => set({ imageAnalysis: analysis }),

  setConfig: (partial) =>
    set((state) => ({ config: { ...state.config, ...partial } })),
  resetConfig: () => set({ config: { ...DEFAULT_CONFIG } }),
  toggleColor: (colorId) =>
    set((state) => {
      const palette = state.config.colorPalette;
      const newPalette = palette.includes(colorId)
        ? palette.filter((id) => id !== colorId)
        : [...palette, colorId];
      return { config: { ...state.config, colorPalette: newPalette } };
    }),
  toggleBrick: (brickId) =>
    set((state) => {
      const pool = state.config.brickPool;
      const newPool = pool.includes(brickId)
        ? pool.filter((id) => id !== brickId)
        : [...pool, brickId];
      return { config: { ...state.config, brickPool: newPool } };
    }),

  setCatalog: (colors, bricks) => set({ colors, bricks, catalogLoaded: true }),

  setPlacements: (placements) => set({ placements }),
  setBillOfMaterials: (bom) => set({ billOfMaterials: bom }),
  setAssessment: (assessment) => set({ assessment }),
  setIterationHistory: (history) => set({ iterationHistory: history }),
  setGenerationStatus: (status) => set({ generationStatus: status }),
  setAssemblyGuideUrl: (url) => set({ assemblyGuideUrl: url }),

  handleSyncField: (field, value) => {
    switch (field) {
      case 'mosaicConfig':
        set((state) => ({ config: { ...state.config, ...(value as Partial<MosaicConfig>) } }));
        break;
      case 'placements':
        set({ placements: value as Placement[] });
        break;
      case 'billOfMaterials':
        set({ billOfMaterials: value as BillItem[] });
        break;
      case 'assessment':
        set({ assessment: value as LLMAssessment });
        break;
      case 'iterationHistory':
        set({ iterationHistory: value as IterationSummary[] });
        break;
      case 'generationStatus':
        set({ generationStatus: value as GenerationStatus });
        break;
      case 'assemblyGuideUrl':
        set({ assemblyGuideUrl: value as string });
        break;
    }
  },

  setSessionId: (id) => set({ sessionId: id }),
  incrementIteration: () =>
    set((state) => ({ currentIteration: state.currentIteration + 1 })),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  clearMessages: () => set({ messages: [] }),

  setSelectedLayer: (layer) => set({ selectedLayer: layer }),
  toggleLayerVisibility: (layer) =>
    set((state) => {
      const vis = [...state.visibleLayers];
      vis[layer] = !vis[layer];
      return { visibleLayers: vis };
    }),
  setShowOriginalOverlay: (show) => set({ showOriginalOverlay: show }),
  setCanvasZoom: (zoom) => set({ canvasZoom: Math.max(0.1, Math.min(5, zoom)) }),
  setBomExpanded: (expanded) => set({ bomExpanded: expanded }),

  resetAll: () =>
    set({
      sourceImage: null,
      sourceImageUrl: null,
      imageAnalysis: null,
      config: { ...DEFAULT_CONFIG },
      placements: [],
      billOfMaterials: [],
      assessment: null,
      iterationHistory: [],
      generationStatus: { ...DEFAULT_STATUS },
      assemblyGuideUrl: null,
      sessionId: null,
      currentIteration: 0,
      messages: [],
      selectedLayer: null,
      visibleLayers: [true, true, true],
      showOriginalOverlay: false,
      canvasZoom: 1,
      bomExpanded: false,
    }),
}));
