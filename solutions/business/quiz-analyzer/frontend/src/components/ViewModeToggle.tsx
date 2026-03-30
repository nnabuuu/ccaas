/**
 * View Mode Toggle Component
 *
 * Three modes:
 * - prep (备课): Full analysis for lesson preparation
 * - classroom (课堂): Brief view for in-class quick reference
 * - student (学生): Guided tutoring view
 */

import type { ViewMode } from '../types'

interface ViewModeToggleProps {
  value: ViewMode
  onChange: (mode: ViewMode) => void
}

const modes: { key: ViewMode; icon: string; label: string }[] = [
  { key: 'prep', icon: '📋', label: '备课' },
  { key: 'classroom', icon: '🏫', label: '课堂' },
  { key: 'student', icon: '👨‍🎓', label: '学生' },
]

export default function ViewModeToggle({ value, onChange }: ViewModeToggleProps) {
  return (
    <div className="flex items-center bg-ck-bg2 rounded-lg p-1 gap-1">
      {modes.map(mode => (
        <button
          key={mode.key}
          onClick={() => onChange(mode.key)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ease-claude ${
            value === mode.key
              ? 'bg-ck-bg1 text-ck-t1 shadow-composer'
              : 'text-ck-t2 hover:text-ck-t1'
          }`}
        >
          <span className="text-xs">{mode.icon}</span>
          {mode.label}
        </button>
      ))}
    </div>
  )
}
