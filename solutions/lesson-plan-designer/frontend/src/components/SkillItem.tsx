import type { Skill } from '../types'

export interface SkillItemProps {
  skill: Skill
  enabled: boolean
  onToggle: () => void
  onEdit: () => void
}

/**
 * SkillItem - A single skill item in the skills list.
 * Displays skill name, description, status, and toggle/edit controls.
 */
export function SkillItem({ skill, enabled, onToggle, onEdit }: SkillItemProps) {
  return (
    <div className="flex items-start justify-between p-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors">
      <div className="flex-1 min-w-0 mr-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-gray-900 truncate">
            {skill.name}
          </span>
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
              skill.status === 'published'
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {skill.status === 'published' ? '已发布' : '草稿'}
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-500 line-clamp-2">
          {skill.description}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Toggle Switch */}
        <button
          role="switch"
          aria-checked={enabled}
          onClick={onToggle}
          className={`
            relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
            transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
            ${enabled ? 'bg-primary-600' : 'bg-gray-200'}
          `}
        >
          <span
            className={`
              pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0
              transition duration-200 ease-in-out
              ${enabled ? 'translate-x-4' : 'translate-x-0'}
            `}
          />
        </button>

        {/* Edit Button */}
        <button
          onClick={onEdit}
          title="编辑"
          className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default SkillItem
