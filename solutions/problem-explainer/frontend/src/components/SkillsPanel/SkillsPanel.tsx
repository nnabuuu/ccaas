import { useState } from 'react';
import type { Skill } from '../../types';
import SkillItem from './SkillItem';

export interface SkillsPanelProps {
  skills: Skill[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  enabledSkillIds: Set<string>;
  onSearchChange: (query: string) => void;
  onToggleSkill: (skillId: string) => void;
}

/**
 * SkillsPanel - A collapsible panel for managing skills.
 * Displays a searchable list of skills with toggle controls.
 */
export function SkillsPanel({
  skills,
  loading,
  error,
  searchQuery,
  enabledSkillIds,
  onSearchChange,
  onToggleSkill,
}: SkillsPanelProps) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className="bg-white border-t border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700">
          技能管理
          {enabledSkillIds.size > 0 && (
            <span className="ml-2 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
              {enabledSkillIds.size} 已启用
            </span>
          )}
        </h3>
        <button
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? '展开' : '收起'}
          className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
        >
          <svg
            className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Collapsible Content */}
      {!collapsed && (
        <>
          {/* Search Input */}
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="搜索技能..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Skills List */}
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-gray-500 text-sm">
                <svg className="w-5 h-5 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                加载中...
              </div>
            ) : error ? (
              <div className="px-4 py-8 text-center text-sm text-red-600">
                {error}
              </div>
            ) : skills.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                暂无技能
              </div>
            ) : (
              skills.map((skill) => (
                <SkillItem
                  key={skill.id}
                  skill={skill}
                  enabled={enabledSkillIds.has(skill.id)}
                  onToggle={() => onToggleSkill(skill.id)}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default SkillsPanel;
