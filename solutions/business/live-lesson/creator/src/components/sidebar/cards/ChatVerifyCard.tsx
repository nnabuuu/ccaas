import { useEffect, useId, useState } from 'react'
import { ChevronDown, Check, X, Sparkles } from 'lucide-react'
import type {
  VerifyData,
  VerifyCheck,
  VerifyCheckStatus,
} from '../../../types/chat-cards'

/**
 * ChatVerifyCard — renders a `kind: 'verify'` card payload as a
 * schema/check validation result panel in the chat.
 *
 * Visual contract: `design/surfaces/creator-v7-rich-chat.jsx:443-605`
 * + `creator-v7-rich-chat-doc.md` §3.
 *
 * Two render modes driven by `data.status`:
 *   - `'running'`: front-end simulates progressive reveal — every
 *     350ms one more check appears. Header shows ⋯ + progress
 *     count, blue tint, pulse animation. A "检查中..." footer with
 *     bouncing dots while progress < total.
 *   - `'done'`: all checks visible immediately; header tint is
 *     green (all pass) or red (any fail); footer shows the elapsed
 *     time + a one-line summary.
 *
 * Important: the backend sends a SINGLE card payload (POC). The
 * progressive reveal is purely a UX flourish — even when status is
 * 'running' on receipt, all `checks` are already in `data`; we just
 * unveil them on a timer. This matches the prototype + lets us
 * skip streaming complexity in the MCP path.
 */

interface Props {
  data: VerifyData
}

const REVEAL_INTERVAL_MS = 350

export default function ChatVerifyCard({ data }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [expandedCheckId, setExpandedCheckId] = useState<string | null>(null)
  const checksId = useId()

  const passCount = data.checks.filter((c) => c.status === 'pass').length
  const warnCount = data.checks.filter((c) => c.status === 'warn').length
  const failCount = data.checks.filter((c) => c.status === 'fail').length
  const total = data.checks.length
  const isDone = data.status === 'done'
  const isRunning = data.status === 'running'
  const hasFail = failCount > 0
  const overallPass = isDone && !hasFail

  // Progressive-reveal animation for the 'running' state. When the
  // card lands as `done` from the backend, we skip straight to the
  // full reveal (progress = total). The cleanup cancels the timer
  // if the component unmounts (e.g. tab switch) so we don't leak
  // setInterval calls.
  const [progress, setProgress] = useState(isDone ? total : 0)
  // Reset progress when the card flips back to 'running' (e.g. a
  // retry that re-uses the same React instance). Without this,
  // progress would stay at `total` from a prior `done` and the
  // reveal would not animate. POC backend doesn't do this today,
  // but the cost is one effect and it makes the component robust
  // for any future status transitions.
  useEffect(() => {
    if (isRunning) setProgress(0)
  }, [isRunning])
  useEffect(() => {
    if (!isRunning) return
    const iv = setInterval(() => {
      setProgress((p) => {
        if (p >= total) {
          clearInterval(iv)
          return total
        }
        return p + 1
      })
    }, REVEAL_INTERVAL_MS)
    return () => clearInterval(iv)
  }, [isRunning, total])

  const visibleChecks = isDone ? data.checks : data.checks.slice(0, progress)

  // Header color + status-icon variant. Priority: fail > overallPass
  // (done w/ no fails) > running > idle (running not started).
  const headerVariant = hasFail
    ? 'fail'
    : overallPass
      ? 'pass'
      : isRunning
        ? 'running'
        : 'idle'
  const headerStyles = {
    fail: {
      bg: 'bg-red-50',
      iconBg: 'bg-red-600 text-white',
      border: 'border-red-200',
    },
    pass: {
      bg: 'bg-green-50',
      iconBg: 'bg-green-600 text-white',
      border: 'border-gray-200',
    },
    running: {
      bg: 'bg-blue-50',
      iconBg: 'bg-blue-600 text-white animate-aiBlink',
      border: 'border-gray-200',
    },
    idle: {
      bg: 'bg-gray-50',
      iconBg: 'bg-gray-400 text-white',
      border: 'border-gray-200',
    },
  } as const
  const hs = headerStyles[headerVariant]

  return (
    <div
      className="self-start w-full max-w-[95%]"
      data-card-kind="verify"
      data-testid="chat-verify-card"
    >
      {/* Above-card label (always purple ✦ — mirrors chat-doc §3.4) */}
      <div className="flex items-center gap-1 mb-1">
        <span className="w-3.5 h-3.5 rounded bg-purple-600 text-white flex items-center justify-center">
          <Sparkles size={8} strokeWidth={3} />
        </span>
        <span className="text-[9px] font-semibold text-purple-700">
          AI 助手 · 校验
        </span>
      </div>

      <div className={`rounded-[10px] overflow-hidden border ${hs.border} bg-white`}>
        {/* Header (click to collapse) */}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className={`w-full flex items-center gap-2 px-3.5 py-2.5 cursor-pointer text-left transition-colors ${hs.bg} ${!collapsed ? 'border-b border-gray-200' : ''}`}
          aria-expanded={!collapsed}
          aria-controls={checksId}
        >
          <span
            className={`w-[18px] h-[18px] rounded-[5px] flex-shrink-0 flex items-center justify-center text-[9px] font-bold ${hs.iconBg}`}
          >
            {hasFail ? (
              <X size={10} strokeWidth={3} />
            ) : overallPass ? (
              <Check size={10} strokeWidth={3} />
            ) : isRunning ? (
              '⋯'
            ) : (
              '◇'
            )}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-gray-900 truncate">
              {data.title}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5 truncate">
              {data.target} → {data.schema}
            </div>
          </div>
          {/* Status badges */}
          <div className="flex gap-1 flex-shrink-0">
            {isDone && (
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-600 text-white"
                aria-label={`${passCount} pass`}
              >
                ✓ {passCount}
              </span>
            )}
            {warnCount > 0 && (
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-600 text-white"
                aria-label={`${warnCount} warn`}
              >
                ⚠ {warnCount}
              </span>
            )}
            {failCount > 0 && (
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-600 text-white"
                aria-label={`${failCount} fail`}
              >
                ✗ {failCount}
              </span>
            )}
            {isRunning && (
              <span
                className="text-[9px] font-semibold text-blue-600 px-1.5 py-0.5"
                aria-label={`${progress} of ${total} checked`}
              >
                {progress}/{total}
              </span>
            )}
          </div>
          <ChevronDown
            size={12}
            className={`text-gray-400 flex-shrink-0 transition-transform ${collapsed ? '-rotate-90' : 'rotate-0'}`}
          />
        </button>

        {/* Progress bar (running only) */}
        {isRunning && !collapsed && (
          <div className="h-0.5 bg-gray-100" aria-label="校验进度">
            <div
              className="h-0.5 bg-blue-600 transition-[width] duration-300 ease-out"
              style={{ width: total > 0 ? `${(progress / total) * 100}%` : '0%' }}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={total}
              aria-label="校验进度"
            />
          </div>
        )}

        {/* Checks list */}
        {!collapsed && (
          <div className="py-1.5 px-2.5" id={checksId}>
            {visibleChecks.map((check) => (
              <VerifyCheckRow
                key={check.id}
                check={check}
                expanded={expandedCheckId === check.id}
                onToggle={() =>
                  setExpandedCheckId(
                    expandedCheckId === check.id ? null : check.id,
                  )
                }
              />
            ))}
            {isRunning && progress < total && (
              <div
                className="flex items-center gap-1.5 px-2 py-1.5"
                data-testid="verify-checking-indicator"
              >
                <span className="flex gap-0.5">
                  {[0, 0.15, 0.3].map((d, i) => (
                    <span
                      key={i}
                      className="w-[3px] h-[3px] rounded-full bg-blue-600"
                      style={{
                        animation: `aiDot 1.2s infinite`,
                        animationDelay: `${d}s`,
                      }}
                    />
                  ))}
                </span>
                <span className="text-[9px] text-blue-600">检查中...</span>
              </div>
            )}
          </div>
        )}

        {/* Done footer */}
        {isDone && !collapsed && (
          <div className="px-3 py-1.5 border-t border-gray-200 flex items-center gap-2 text-[9px] text-gray-400">
            <span>
              {data.startedAt} → {data.completedAt}
            </span>
            <span>·</span>
            <span>
              {overallPass
                ? '校验通过'
                : hasFail
                  ? '校验失败'
                  : '校验完成'}
              {warnCount > 0 ? `, ${warnCount} 个警告` : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Single check row (private) ───────────────────────────────────────

interface CheckRowProps {
  check: VerifyCheck
  expanded: boolean
  onToggle: () => void
}

const CHECK_STYLES: Record<
  VerifyCheckStatus,
  { icon: string; iconBg: string; iconText: string; detailBg: string; detailText: string }
> = {
  pass: {
    icon: '✓',
    iconBg: 'bg-green-50',
    iconText: 'text-green-600',
    detailBg: 'bg-green-50',
    detailText: 'text-green-700',
  },
  warn: {
    icon: '⚠',
    iconBg: 'bg-amber-50',
    iconText: 'text-amber-600',
    detailBg: 'bg-amber-50',
    detailText: 'text-amber-700',
  },
  fail: {
    icon: '✗',
    iconBg: 'bg-red-50',
    iconText: 'text-red-600',
    detailBg: 'bg-red-50',
    detailText: 'text-red-700',
  },
}

function VerifyCheckRow({ check, expanded, onToggle }: CheckRowProps) {
  const s = CHECK_STYLES[check.status]
  const hasDetail = !!check.detail

  return (
    <div data-testid={`verify-check-${check.id}`} data-status={check.status}>
      <button
        type="button"
        onClick={hasDetail ? onToggle : undefined}
        disabled={!hasDetail}
        className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-left ${hasDetail ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default'}`}
        aria-expanded={hasDetail ? expanded : undefined}
      >
        <span
          className={`w-3.5 h-3.5 rounded-[3px] flex-shrink-0 flex items-center justify-center text-[8px] font-bold ${s.iconBg} ${s.iconText}`}
          aria-label={`status: ${check.status}`}
        >
          {s.icon}
        </span>
        <span
          className={`text-[10px] flex-1 line-clamp-2 ${check.status === 'pass' ? 'text-gray-600 font-normal' : 'text-gray-900 font-medium'}`}
        >
          {check.label}
        </span>
        <span className="text-[9px] text-gray-400 flex-shrink-0 truncate max-w-[40%]">
          {check.desc}
        </span>
        {hasDetail && (
          <ChevronDown
            size={10}
            className={`text-gray-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-0' : '-rotate-90'}`}
          />
        )}
      </button>
      {expanded && hasDetail && (
        <div
          className={`mx-2 mb-1 ml-[30px] px-2.5 py-1.5 rounded-md text-[10px] leading-relaxed font-medium ${s.detailBg} ${s.detailText}`}
          data-testid={`verify-check-${check.id}-detail`}
        >
          {check.detail}
        </div>
      )}
    </div>
  )
}
