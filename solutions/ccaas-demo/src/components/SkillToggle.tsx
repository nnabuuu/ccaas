/**
 * Skill Toggle Component
 *
 * Displays a single skill with enable/disable toggle and expandable header info.
 */

import { useState } from 'react'
import type { Skill } from '../types'

interface SkillToggleProps {
  skill: Skill
  onToggle: (skillId: string) => void
}

export function SkillToggle({ skill, onToggle }: SkillToggleProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={`rounded-lg border-2 transition-all ${
        skill.enabled
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      {/* Main toggle area */}
      <div
        className="p-4 cursor-pointer"
        onClick={() => onToggle(skill.id)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{skill.icon}</span>
            <div>
              <h3 className="font-medium text-gray-900">{skill.name}</h3>
              <p className="text-sm text-gray-500">{skill.description}</p>
            </div>
          </div>
          <div
            className={`w-12 h-6 rounded-full p-1 transition-colors ${
              skill.enabled ? 'bg-blue-500' : 'bg-gray-300'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform ${
                skill.enabled ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Expandable header info */}
      {skill.header && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(!expanded)
            }}
            className="w-full px-4 py-2 text-left text-sm text-gray-500 hover:text-gray-700 border-t border-gray-100 flex items-center gap-2"
          >
            <span className={`transition-transform ${expanded ? 'rotate-90' : ''}`}>
              ▶
            </span>
            <span>Skill Details</span>
          </button>

          {expanded && (
            <div className="px-4 pb-4 space-y-3 text-sm animate-slide-in">
              <div className="bg-white rounded-lg p-3 border border-gray-100">
                <div className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">🎯</span>
                  <div>
                    <p className="font-medium text-gray-700">When to Use</p>
                    <p className="text-gray-600">{skill.header.whenToUse}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-3 border border-gray-100">
                <div className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✅</span>
                  <div>
                    <p className="font-medium text-gray-700">Objective</p>
                    <p className="text-gray-600">{skill.header.objective}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-3 border border-gray-100">
                <div className="flex items-start gap-2">
                  <span className="text-purple-500 mt-0.5">🔑</span>
                  <div>
                    <p className="font-medium text-gray-700">Trigger Keywords</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {skill.header.triggers.map((trigger) => (
                        <span
                          key={trigger}
                          className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs"
                        >
                          {trigger}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
