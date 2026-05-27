import type { ReactNode } from 'react'
import {
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  AlertCircle,
} from 'lucide-react'
import type { AuditSeverity } from '../../api/audit'

/**
 * Callout block — renders one finding from the audit report. Severity
 * drives the left-border + tinted bg + icon. Title is bolded at the
 * top when present; children is the (already-rendered) inner markdown.
 *
 * The four severity classes follow design §2.5:
 *   pass  — check passed (green)
 *   warn  — needs attention / soft violation (amber)
 *   guess — AI guess, weak evidence (purple-pink to distinguish from error)
 *   error — schema / config violation (red)
 */

const SEVERITY_STYLES: Record<
  AuditSeverity,
  {
    border: string
    bg: string
    iconColor: string
    Icon: typeof CheckCircle2
    /** Chinese severity word — used in aria-label so screen-reader
     * users get the same urgency signal as sighted users do via color. */
    label: string
  }
> = {
  pass: {
    border: 'border-l-green-500',
    bg: 'bg-green-50',
    iconColor: 'text-green-600',
    Icon: CheckCircle2,
    label: '通过',
  },
  warn: {
    border: 'border-l-amber-500',
    bg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    Icon: AlertTriangle,
    label: '注意',
  },
  guess: {
    // Purple-pink: distinct from `error` red so the teacher can scan
    // "AI uncertain" vs "configuration wrong" by color alone.
    border: 'border-l-fuchsia-500',
    bg: 'bg-fuchsia-50',
    iconColor: 'text-fuchsia-600',
    Icon: HelpCircle,
    label: 'AI 猜测',
  },
  error: {
    border: 'border-l-red-500',
    bg: 'bg-red-50',
    iconColor: 'text-red-600',
    Icon: AlertCircle,
    label: '错误',
  },
}

interface Props {
  severity: AuditSeverity
  title?: string
  children?: ReactNode
}

export default function Callout({ severity, title, children }: Props) {
  // Defensive fallback: unknown severity → render as `warn` so the
  // teacher still sees something useful (and so a future backend
  // adding a 5th severity class doesn't crash the UI).
  const style = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.warn
  const Icon = style.Icon
  // role+aria-label gives screen-reader users the severity word that
  // sighted users get from the icon + tint.
  const ariaLabel = title ? `${style.label}: ${title}` : style.label
  return (
    <div
      role="note"
      aria-label={ariaLabel}
      className={`border border-gray-200 border-l-4 ${style.border} ${style.bg} rounded-lg p-3.5 my-3`}
    >
      <div className="flex items-start gap-2.5">
        <Icon size={18} className={`${style.iconColor} shrink-0 mt-0.5`} aria-hidden="true" />
        <div className="flex-1 min-w-0 text-sm text-gray-800 leading-relaxed">
          {title && (
            <div className="font-semibold text-gray-900 mb-1">{title}</div>
          )}
          {children}
        </div>
      </div>
    </div>
  )
}
