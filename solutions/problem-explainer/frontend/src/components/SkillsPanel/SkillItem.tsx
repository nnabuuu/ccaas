import type { Skill } from '../../types';

export interface SkillItemProps {
  skill: Skill;
  enabled: boolean;
  onToggle: () => void;
}

/**
 * SkillItem - A single skill item in the skills list.
 * Displays skill name, description, status, and toggle control.
 */
export function SkillItem({ skill, enabled, onToggle }: SkillItemProps) {
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
            transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            ${enabled ? 'bg-blue-600' : 'bg-gray-200'}
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
      </div>
    </div>
  );
}

export default SkillItem;
