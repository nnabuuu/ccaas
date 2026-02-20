// ═══════════════════════════════════════════════════════════
// ExercisePlan — Skill A output (user-facing)
// ═══════════════════════════════════════════════════════════

export interface ExercisePlan {
  meta: {
    title: string;
    subtitle?: string;
    locale: "zh-CN" | "en";
  };
  principles?: {
    do: string[];
    avoid: string[];
    frequency?: string;
  };
  exercises: ExerciseSpec[];
}

export interface ExerciseSpec {
  type: KnownExerciseType | "custom";
  customDescription?: string;
  sets: number;
  reps: number;
  restSec: number;
  tempo: string;
  howTo: string[];
  safety: string[];
  overrides?: {
    nameZh?: string;
    nameEn?: string;
    muscles?: string;
    phases?: string[];
    phaseDurations?: number[];
  };
}

export type KnownExerciseType =
  | "pelvic-tilt"
  | "dead-bug"
  | "cat-cow"
  | "seated-boxing"
  | "bridge"
  | "bird-dog"
  | "seated-march"
  | "wall-slide";

// ═══════════════════════════════════════════════════════════
// RenderConfig — Skill B output → Rendering Service input
// ═══════════════════════════════════════════════════════════

export interface RenderConfig {
  meta: {
    title: string;
    subtitle?: string;
    locale: "zh-CN" | "en";
    theme?: "dark" | "light";
  };
  principles?: {
    do: string[];
    avoid: string[];
    frequency?: string;
  };
  exercises: ExerciseRenderData[];
}

export interface ExerciseRenderData {
  id: string;
  name: string;
  nameZh: string;
  sets: number;
  reps: number;
  restSec: number;
  tempo: string;
  muscles: string;
  howTo: string[];
  safety: string[];
  phases: string[];
  phaseDurations: number[];
  figure: FigureType;
  keyframes: Keyframe[];
  visualHints?: VisualHint[];
}

export type FigureType = "lying" | "cat" | "seated" | "standing";

export type Keyframe = Record<string, number>;

// ═══════════════════════════════════════════════════════════
// Keyframe types per FigureType (for documentation / validation)
// ═══════════════════════════════════════════════════════════

export interface LyingKeyframe {
  rHip: number;    // Right hip angle (deg)
  rKnee: number;   // Right knee angle (deg), relative to thigh
  lHip: number;    // Left hip angle
  lKnee: number;   // Left knee angle
  rSh: number;     // Right shoulder angle
  lSh: number;     // Left shoulder angle
  tilt: number;    // Pelvic posterior tilt (0=natural, 1=full)
}

export interface CatKeyframe {
  spine: number;     // Spine curvature: -1=full cat, 0=neutral, +0.3=gentle cow
  headDrop: number;  // Head drop: positive=down, negative=up
}

export interface SeatedKeyframe {
  lArmX: number;    // Left arm horizontal extension (px)
  lArmY: number;    // Left arm vertical offset (px), negative=up
  rArmX: number;    // Right arm horizontal extension
  rArmY: number;    // Right arm vertical offset
}

// ═══════════════════════════════════════════════════════════
// Visual hints
// ═══════════════════════════════════════════════════════════

export interface VisualHint {
  type: "label" | "glow" | "arrow" | "indicator";
  trigger: {
    field: string;
    condition: "gt" | "lt" | "eq";
    value: number;
  };
  text?: string;
  color?: string;
  position?: "top" | "bottom" | "left" | "right" | "center";
}

// ═══════════════════════════════════════════════════════════
// Exercise Library entry (used by Skill B for table lookup)
// ═══════════════════════════════════════════════════════════

export interface ExerciseLibraryEntry {
  name: string;
  nameZh: string;
  muscles: string;
  figure: FigureType;
  phases: string[];
  phaseDurations: number[];
  keyframes: Keyframe[];
  visualHints?: VisualHint[];
}

export type ExerciseLibrary = Record<KnownExerciseType, ExerciseLibraryEntry>;
