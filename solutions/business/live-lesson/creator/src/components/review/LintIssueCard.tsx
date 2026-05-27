import {
  AlertCircle,
  AlertTriangle,
  Info,
  Target,
  Compass,
  Anchor,
  GraduationCap,
  MapPin,
} from 'lucide-react'
import type {
  LintCategory,
  LintIssue,
  LintSeverity,
} from '../../api/lint'

/**
 * One lint finding rendered as a card. Severity drives the left-border
 * color + icon; category gets a small badge so the teacher can scan by
 * dimension. The location chip (if present) becomes a deep-link target
 * for the v2 "jump to source" UX — MVP just shows it.
 */

const SEVERITY_STYLES: Record<
  LintSeverity,
  { border: string; bg: string; iconColor: string; label: string }
> = {
  error: {
    border: 'border-l-red-500',
    bg: 'bg-red-50',
    iconColor: 'text-red-600',
    label: '错误',
  },
  warning: {
    border: 'border-l-amber-500',
    bg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    label: '警告',
  },
  info: {
    border: 'border-l-blue-400',
    bg: 'bg-blue-50',
    iconColor: 'text-blue-500',
    label: '提示',
  },
}

const SEVERITY_ICONS: Record<LintSeverity, typeof AlertCircle> = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

const CATEGORY_META: Record<
  LintCategory,
  { label: string; Icon: typeof Target }
> = {
  'req-coverage': { label: '要求覆盖', Icon: Target },
  'goal-alignment': { label: '目标对齐', Icon: Compass },
  'step-grounding': { label: '步骤依据', Icon: Anchor },
  'subject-grade-fit': { label: '学段适配', Icon: GraduationCap },
}

interface Props {
  issue: LintIssue
}

// Defensive fallbacks for unknown severity / category — protects the UI
// if the backend ships a new enum value before the frontend ships its
// matching style map. Without these, a missing entry would crash the
// card with "cannot read .Icon of undefined".
const FALLBACK_SEV = SEVERITY_STYLES.info
const FALLBACK_CAT: { label: string; Icon: typeof Target } = {
  label: 'Other',
  Icon: Info,
}

export default function LintIssueCard({ issue }: Props) {
  const sev = SEVERITY_STYLES[issue.severity] ?? FALLBACK_SEV
  const SevIcon = SEVERITY_ICONS[issue.severity] ?? Info
  const cat = CATEGORY_META[issue.category] ?? {
    ...FALLBACK_CAT,
    label: issue.category,
  }
  const CatIcon = cat.Icon

  return (
    <div
      className={`border border-gray-200 border-l-4 ${sev.border} ${sev.bg} rounded-lg p-3.5`}
    >
      <div className="flex items-start gap-3">
        <SevIcon size={18} className={`${sev.iconColor} shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${sev.iconColor}`}>
              {sev.label}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 bg-white px-1.5 py-0.5 rounded border border-gray-200">
              <CatIcon size={10} />
              {cat.label}
            </span>
            {issue.location && <LocationBadge location={issue.location} />}
          </div>
          <p className="text-sm text-gray-800 leading-snug">{issue.message}</p>
          {issue.suggestion && (
            <p className="mt-2 text-xs text-gray-600 leading-snug border-t border-gray-200/60 pt-2">
              <span className="font-medium text-gray-700">建议: </span>
              {issue.suggestion}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function LocationBadge({ location }: { location: NonNullable<LintIssue['location']> }) {
  // Location format: "plan · r-1.2.3" or "manifest · step #N" — gives
  // the teacher a hint where to look without navigating away.
  const fileLabel = location.file === 'plan' ? '教案' : '执行手册'
  const detail =
    location.refId !== undefined
      ? `· ${location.refId}`
      : location.stepIdx !== undefined
      ? `· step #${location.stepIdx + 1}`
      : ''
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 bg-white px-1.5 py-0.5 rounded border border-gray-200">
      <MapPin size={10} />
      {fileLabel} {detail}
    </span>
  )
}
