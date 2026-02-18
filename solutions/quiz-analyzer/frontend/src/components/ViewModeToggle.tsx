/**
 * View Mode Toggle Component
 *
 * Switches between teacher view (full analysis) and student view (guided tutoring)
 */

import type { ViewMode } from '../types'

interface ViewModeToggleProps {
  value: ViewMode
  onChange: (mode: ViewMode) => void
}

export default function ViewModeToggle({ value, onChange }: ViewModeToggleProps) {
  return (
    <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-1">
      <button
        onClick={() => onChange('teacher')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
          value === 'teacher'
            ? 'bg-white text-blue-700 shadow-sm'
            : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        <span>👨‍🏫</span>
        教师视图
      </button>
      <button
        onClick={() => onChange('student')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
          value === 'student'
            ? 'bg-white text-green-700 shadow-sm'
            : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        <span>👨‍🎓</span>
        学生视图
      </button>
    </div>
  )
}
