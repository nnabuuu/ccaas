import { useSkills } from '@kedge-agentic/react-sdk'
import type { Skill } from '@kedge-agentic/common'

export interface SkillPanelProps {
  serverUrl: string
  tenantId: string
  apiKey?: string
  open: boolean
  onClose: () => void
}

export function SkillPanel({ serverUrl, tenantId, apiKey, open, onClose }: SkillPanelProps) {
  const {
    filteredSkills,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    isSkillEnabled,
  } = useSkills({ serverUrl, tenantId, apiKey })

  if (!open) return null

  return (
    <div className="border-t border-ck-b1 bg-ck-bg1 max-h-[280px] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-ck-b2">
        <span className="text-xs font-medium text-ck-t1">技能</span>
        <button
          onClick={onClose}
          className="text-xs text-ck-t3 hover:text-ck-t1 px-1"
          aria-label="关闭技能面板"
        >
          &times;
        </button>
      </div>

      {/* Search */}
      <div className="px-4 py-2">
        <input
          type="text"
          placeholder="搜索技能..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full text-xs px-2 py-1.5 border border-ck-b1 rounded-ck bg-ck-bg1 text-ck-t1 outline-none focus:border-ck-info-t"
        />
      </div>

      {/* List */}
      <div className="px-4 pb-3">
        {loading && (
          <div className="text-xs text-ck-t3 py-2">加载技能...</div>
        )}

        {error && (
          <div className="text-xs text-ck-danger-t py-2">{error}</div>
        )}

        {!loading && !error && filteredSkills.length === 0 && (
          <div className="text-xs text-ck-t3 py-2">未找到技能</div>
        )}

        {filteredSkills.map((skill: Skill) => (
          <SkillRow
            key={skill.id}
            skill={skill}
            enabled={isSkillEnabled(skill.id)}
          />
        ))}
      </div>
    </div>
  )
}

interface SkillRowProps {
  skill: Skill
  enabled: boolean
}

function SkillRow({ skill, enabled }: SkillRowProps) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-ck-t1 truncate">{skill.name}</div>
        {skill.description && (
          <div className="text-[10px] text-ck-t3 truncate">{skill.description}</div>
        )}
      </div>
      <span
        className={`w-2 h-2 rounded-full ml-2 shrink-0 ${
          enabled ? 'bg-ck-success-t' : 'bg-ck-bg3'
        }`}
        role="status"
        aria-label={enabled ? '已启用' : '未启用'}
      />
    </div>
  )
}
