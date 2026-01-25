/**
 * Skills Sidebar Component
 *
 * Displays the list of available skills with toggles.
 */

import type { Skill } from '../types'
import { SkillToggle } from './SkillToggle'
import { RestartBanner } from './RestartBanner'

interface SkillsSidebarProps {
  skills: Skill[]
  needsRestart: boolean
  onToggle: (skillId: string) => void
  onRestart: () => void
}

export function SkillsSidebar({
  skills,
  needsRestart,
  onToggle,
  onRestart,
}: SkillsSidebarProps) {
  const enabledCount = skills.filter(s => s.enabled).length

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Skills</h2>
        <p className="text-sm text-gray-500 mt-1">
          {enabledCount} of {skills.length} enabled
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {skills.map(skill => (
            <SkillToggle
              key={skill.id}
              skill={skill}
              onToggle={onToggle}
            />
          ))}
        </div>
      </div>

      {needsRestart && (
        <div className="p-4 border-t border-gray-200">
          <RestartBanner onRestart={onRestart} />
        </div>
      )}
    </div>
  )
}
