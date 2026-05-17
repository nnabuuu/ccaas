import type { ComponentType } from 'react'
import {
  ListChecks,
  ArrowLeftRight,
  Layers,
  Shield,
  SortAsc,
  Search,
  Map,
  ImageUp,
  PenLine,
  MessageSquare,
  FileText,
} from 'lucide-react'
import type { AnswerKey } from './index'

type LucideIcon = typeof ListChecks

// ── Exercise editor props contract ──
// Each editor receives the broad AnswerKey union; it narrows internally.

export interface EditorProps {
  answerKey: AnswerKey
  onChange: (ak: AnswerKey) => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEditorModule = { default: ComponentType<any> }

// ── Exercise metadata ──

export interface ExerciseMeta {
  label: string
  icon: LucideIcon
  badgeClass: string
  createDefault: () => AnswerKey
  editor?: () => Promise<AnyEditorModule>
}

// ── Registry: single source of truth for all exercise types ──

export const EXERCISE_REGISTRY = {
  quiz: {
    label: '选择题',
    icon: ListChecks,
    badgeClass: 'bg-blue-50 text-blue-600',
    createDefault: () => ({ type: 'quiz' as const, answers: [] }),
    editor: () => import('../components/execution/editors/ChoiceEditor'),
  },
  match: {
    label: '匹配题',
    icon: ArrowLeftRight,
    badgeClass: 'bg-indigo-50 text-indigo-600',
    createDefault: () => ({ type: 'match' as const, answers: [] }),
  },
  matrix: {
    label: '矩阵分析',
    icon: Layers,
    badgeClass: 'bg-purple-50 text-purple-600',
    createDefault: () => ({ type: 'matrix' as const, answers: [] }),
  },
  stance: {
    label: '立场论证',
    icon: Shield,
    badgeClass: 'bg-violet-50 text-violet-600',
    createDefault: () => ({
      type: 'stance' as const,
      validPositions: [],
      minEvidence: 1,
      stanceOpts: [],
      evidence: [],
    }),
  },
  order: {
    label: '排序题',
    icon: SortAsc,
    badgeClass: 'bg-orange-50 text-orange-600',
    createDefault: () => ({ type: 'order' as const, items: [], correctOrder: [] }),
  },
  'select-evidence': {
    label: '证据选择',
    icon: Search,
    badgeClass: 'bg-emerald-50 text-emerald-600',
    createDefault: () => ({
      type: 'select-evidence' as const,
      functionOptions: [],
      sections: [],
    }),
  },
  map: {
    label: '概念图',
    icon: Map,
    badgeClass: 'bg-rose-50 text-rose-600',
    createDefault: () => ({
      type: 'map' as const,
      prompt: '',
      axes: {
        x: { neg: '', pos: '', label: '' },
        y: { neg: '', pos: '', label: '' },
      },
      items: [],
    }),
  },
  'image-upload': {
    label: '图片上传',
    icon: ImageUp,
    badgeClass: 'bg-amber-50 text-amber-600',
    createDefault: () => ({ type: 'image-upload' as const, prompt: '', rubric: [] }),
  },
  'fill-blank': {
    label: '填空题',
    icon: PenLine,
    badgeClass: 'bg-cyan-50 text-cyan-600',
    createDefault: () => ({ type: 'fill-blank' as const, sentences: [] }),
  },
} satisfies Record<AnswerKey['type'], ExerciseMeta>

// ── Structural (non-exercise) block metadata ──

export interface BlockMeta {
  label: string
  icon: LucideIcon
  badgeClass: string
}

const STRUCTURAL_BLOCKS: Record<string, BlockMeta> = {
  discuss: { label: '讨论', icon: MessageSquare, badgeClass: 'bg-teal-50 text-teal-600' },
  instruction: { label: '说明', icon: FileText, badgeClass: 'bg-gray-50 text-gray-600' },
}

// ── Merged lookup table ──

export const BLOCK_META: Record<string, BlockMeta> = {
  ...Object.fromEntries(
    Object.entries(EXERCISE_REGISTRY).map(([k, v]) => [k, { label: v.label, icon: v.icon, badgeClass: v.badgeClass }]),
  ),
  ...STRUCTURAL_BLOCKS,
}

// ── Derived utilities ──

export const EXERCISE_TYPES = Object.keys(EXERCISE_REGISTRY) as AnswerKey['type'][]

export function getBlockLabel(type: string): string {
  return BLOCK_META[type]?.label ?? type
}

export function getBlockIcon(type: string): LucideIcon {
  return BLOCK_META[type]?.icon ?? ListChecks
}

export function getBlockBadgeClass(type: string): string {
  return BLOCK_META[type]?.badgeClass ?? 'bg-gray-50 text-gray-500'
}

export function createDefaultAnswerKey(type: string): AnswerKey {
  const meta = EXERCISE_REGISTRY[type as AnswerKey['type']]
  if (meta) return meta.createDefault()
  return EXERCISE_REGISTRY.quiz.createDefault()
}
