export interface Project {
  id: string;
  title: string;
  description: string;
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface ProjectFile {
  id: string;
  path: string;
  fileType: string;
  updatedAt: string;
}

// ── Manifest types (mirrors backend schema) ──

export interface Manifest {
  id: string;
  title: string;
  subject: string;
  gradeLevel: string;
  lessonType: string;
  description?: string;
  teachingNotes?: string;
  lessonIntro?: string;
  lessonSummary?: string;
  article?: Article;
  readingSteps: ReadingStep[];
  phaseConfig?: PhaseConfig[];
  aiReferenceQA?: { q: string; a: string; category: string }[];
  observations?: Record<string, ObservationDef>;
}

export interface Article {
  title: string;
  source: string;
  paragraphs: Paragraph[];
}

export interface Paragraph {
  id: string;
  text: string;
  content?: Segment[];
  role?: 'key' | 'detail';
  highlights?: string[];
  signals?: string[];
}

export type Segment =
  | string
  | { type: 'math'; value: string }
  | { type: 'heading'; value: string }
  | { type: 'image'; src: string; alt?: string; width?: number }
  | { type: 'figure'; src: string; alt?: string; width?: number; caption?: string; math?: string };

export interface PhaseConfig {
  id: string;
  label: string;
  unlockAfter: string | null;
}

export interface ReadingStep {
  id: string;
  idx: number;
  type?: 'task' | 'instruction';
  label?: string;
  labelEn?: string;
  strategy?: string;
  duration?: number;
  description?: string;
  focusParagraphs?: string[];
  showRoles?: boolean;
  advanceOn?: 'submit' | 'confirm';
  exerciseLabel?: string;
  subtitle?: string;
  summary?: string;
  answerKey?: AnswerKey;
  studentView?: StudentView;
  aiHints?: { q: string; label: string }[];
  discuss?: Discuss;
  teacherView?: TeacherView;
  observe?: ObservationDef[] | ObservationDef | string[];
}

export interface StudentView {
  title: string;
  body: string;
  keyPoints?: string[];
  confirmLabel?: string;
  ttsText?: string;
}

export interface TeacherView {
  speechLine: string;
  [key: string]: unknown;
}

export interface ObservationDef {
  [key: string]: unknown;
}

// ── Discuss ──

export interface Discuss {
  openingQ: string;
  openingQZh?: string;
  goal?: string;
  systemPrompt: string;
  scaffolds?: string[];
  maxRounds?: number;
  maxTimeSeconds?: number;
  fallbackMC: FallbackMC;
  insight: string;
  insightZh?: string;
  clusters?: DiscussCluster[];
  targetPoints?: TargetPoint[];
}

export interface FallbackMC {
  question: string;
  questionZh?: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  explanationZh?: string;
}

export interface DiscussCluster {
  id: string;
  label: string;
  description: string;
}

export interface TargetPoint {
  id: string;
  label: string;
  description: string;
}

// ── Answer Key types ──

export type AnswerKey =
  | QuizAnswerKey
  | MatchAnswerKey
  | MatrixAnswerKey
  | StanceAnswerKey
  | OrderAnswerKey
  | SelectEvidenceAnswerKey
  | MapAnswerKey
  | ImageUploadAnswerKey
  | FillBlankAnswerKey;

export interface QuizAnswerKey {
  type: 'quiz';
  answers: QuizAnswer[];
}

export interface QuizAnswer {
  questionIdx: number;
  questionText: string;
  questionTranslate?: string;
  options: string[];
  correct: number;
  label?: string;
  hint?: string;
  hintZh?: string;
  walkthrough?: string;
  walkthroughZh?: string;
  paraRef?: number[];
}

export interface MatchAnswerKey {
  type: 'match';
  answers: MatchAnswer[];
  options?: string[];
}

export interface MatchAnswer {
  pairIdx: number;
  left: string;
  correct: string;
  options?: string[];
  hint?: string;
  hintZh?: string;
}

export interface MatrixAnswerKey {
  type: 'matrix';
  answers: MatrixAnswer[];
  practiceCount?: number;
}

export interface MatrixAnswer {
  rowIdx: number;
  place: string;
  isDemo?: boolean;
  practice?: string;
  reason?: string;
  hint?: string;
  hintZh?: string;
}

export interface StanceAnswerKey {
  type: 'stance';
  validPositions: string[];
  minEvidence: number;
  stanceQ?: string;
  stanceQZh?: string;
  stanceOpts: string[];
  evidence: string[];
}

export interface OrderAnswerKey {
  type: 'order';
  items: string[];
  correctOrder: number[];
}

export interface SelectEvidenceAnswerKey {
  type: 'select-evidence';
  functionOptions: string[];
  sections: EvidenceSection[];
  paragraphTokens?: Record<string, { t: string; kind?: string; why?: string }[]>;
}

export interface EvidenceSection {
  id: string;
  label: string;
  range: number[];
  correctFunction: string;
  hint?: string;
  hintZh?: string;
}

export interface MapAnswerKey {
  type: 'map';
  prompt: string;
  axes: { x: MapAxis; y: MapAxis };
  items: MapItem[];
  expected?: Record<string, [number, number]>;
  minReasonLength?: number;
}

export interface MapAxis {
  neg: string;
  pos: string;
  label: string;
}

export interface MapItem {
  id: string;
  label: string;
  hint?: string;
  refs?: number[];
}

export interface ImageUploadAnswerKey {
  type: 'image-upload';
  prompt: string;
  rubric: { id: string; label: string; weight: number; criteria: string }[];
  sampleSolution?: string;
  aiSystemPrompt?: string;
  maxImages?: number;
}

export interface FillBlankAnswerKey {
  type: 'fill-blank';
  sentences: {
    id: string;
    template: string;
    blanks: Record<string, { accepts: string[]; hint?: string }>;
  }[];
}

// ── Block type labels ──

export const BLOCK_TYPE_LABELS: Record<string, string> = {
  quiz: '选择题',
  match: '匹配题',
  matrix: '矩阵分析',
  stance: '立场论证',
  order: '排序题',
  'select-evidence': '证据选择',
  map: '概念图',
  'image-upload': '图片上传',
  'fill-blank': '填空题',
};

export const STEP_COLORS = ['teal', 'blue', 'purple', 'amber', 'green'] as const;
export type StepColor = (typeof STEP_COLORS)[number];

export function getStepColor(idx: number): StepColor {
  return STEP_COLORS[idx % STEP_COLORS.length];
}

/** Create a properly shaped default AnswerKey for a given exercise type */
export function createDefaultAnswerKey(type: string): AnswerKey {
  switch (type) {
    case 'quiz':
      return { type: 'quiz', answers: [] };
    case 'match':
      return { type: 'match', answers: [] };
    case 'matrix':
      return { type: 'matrix', answers: [] };
    case 'stance':
      return { type: 'stance', validPositions: [], minEvidence: 1, stanceOpts: [], evidence: [] };
    case 'order':
      return { type: 'order', items: [], correctOrder: [] };
    case 'select-evidence':
      return { type: 'select-evidence', functionOptions: [], sections: [] };
    case 'map':
      return { type: 'map', prompt: '', axes: { x: { neg: '', pos: '', label: '' }, y: { neg: '', pos: '', label: '' } }, items: [] };
    case 'image-upload':
      return { type: 'image-upload', prompt: '', rubric: [] };
    case 'fill-blank':
      return { type: 'fill-blank', sentences: [] };
    default:
      return { type: 'quiz', answers: [] };
  }
}
