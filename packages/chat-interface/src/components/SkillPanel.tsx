import { useState, useMemo } from 'react'
import { useSkills } from '@kedge-agentic/react-sdk'
import type { Skill } from '@kedge-agentic/common'
import { toast } from 'sonner'

/** Backend returns more fields than the common Skill type */
type FullSkill = Skill & {
  enabled?: boolean
  currentVersion?: string
  config?: Record<string, unknown>
  createdBy?: string | null
}

export interface SkillPanelProps {
  serverUrl: string
  tenantId: string
  apiKey?: string
  open: boolean
  onClose: () => void
}

type TabKey = 'solution' | 'custom' | 'stats'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'solution', label: 'Solution Skills' },
  { key: 'custom', label: '自建 Skills' },
  { key: 'stats', label: '使用统计' },
]

export function SkillPanel({ serverUrl, tenantId, apiKey, open, onClose }: SkillPanelProps) {
  const { skills, loading, error, toggleSkill } = useSkills({ serverUrl, tenantId, apiKey })
  const [activeTab, setActiveTab] = useState<TabKey>('solution')

  const { solutionSkills, customSkills, fullSkills } = useMemo(() => {
    const full = skills as FullSkill[]
    return {
      fullSkills: full,
      solutionSkills: full.filter(s => !s.createdBy),
      customSkills: full.filter(s => !!s.createdBy),
    }
  }, [skills])

  if (!open) return null

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-ck-bg2 ck-scrollbar">
      <div className="max-w-[780px] mx-auto px-4 py-5">
        <div className="bg-ck-bg1 rounded-2xl p-[22px] border border-ck-b1 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <PanelHeader tenantId={tenantId} onClose={onClose} />
          <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

          {loading ? (
            <div className="text-center py-12 text-[13px] text-ck-t3">加载 Skills...</div>
          ) : error ? (
            <div className="text-center py-12 text-[13px] text-ck-danger-t">{error}</div>
          ) : (
            <>
              {activeTab === 'solution' && (
                <SolutionTab skills={solutionSkills} onToggle={toggleSkill} />
              )}
              {activeTab === 'custom' && (
                <CustomTab skills={customSkills} onSetTab={setActiveTab} />
              )}
              {activeTab === 'stats' && (
                <StatsTab totalSkills={fullSkills.length} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Header ─────────────────────────────────────────────────── */

function PanelHeader({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between mb-[18px]">
      <span className="text-[17px] font-semibold text-ck-t1">Skill 管理</span>
      <div className="flex items-center gap-2">
        <span className="text-[13px] text-ck-t2">{tenantId}</span>
        <span className="text-[10px] px-2.5 py-[3px] rounded-[10px] bg-ck-purple-bg text-ck-purple-t font-medium">
          Tenant
        </span>
        <button
          onClick={onClose}
          className="ml-1 p-1 text-ck-t3 hover:text-ck-t1 rounded transition-colors"
          aria-label="关闭技能面板"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>
    </div>
  )
}

/* ── Tabs ────────────────────────────────────────────────────── */

function TabBar({ activeTab, onTabChange }: { activeTab: TabKey; onTabChange: (t: TabKey) => void }) {
  return (
    <div role="tablist" className="flex gap-1 mb-[18px] border-b border-ck-b1">
      {TABS.map(tab => (
        <button
          key={tab.key}
          role="tab"
          aria-selected={activeTab === tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`px-[18px] py-[9px] text-[13px] border-b-[2.5px] -mb-px transition-all ${
            activeTab === tab.key
              ? 'text-ck-t1 font-semibold border-ck-t1'
              : 'text-ck-t2 border-transparent hover:text-ck-t1'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

/* ── Shared sub-components ───────────────────────────────────── */

function StatCards({ items }: { items: { label: string; value: string | number }[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-[10px] mb-[18px]">
      {items.map(item => (
        <div key={item.label} className="bg-ck-bg2 rounded-ck px-3.5 py-3">
          <div className="text-[12px] text-ck-t2">{item.label}</div>
          <div className="text-[22px] font-semibold text-ck-t1 mt-[3px]">{item.value}</div>
        </div>
      ))}
    </div>
  )
}

function SectionHead({ title, count, trailing }: { title: string; count?: number; trailing?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-[10px]">
      <div className="flex items-center gap-2">
        <span className="text-[14px] font-semibold text-ck-t2">{title}</span>
        {count !== undefined && <span className="text-[12px] text-ck-t3">{count} 个</span>}
      </div>
      {trailing}
    </div>
  )
}

function CardBtn({ children, primary, onClick }: { children: React.ReactNode; primary?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[12px] px-3 py-[5px] rounded-ck cursor-pointer border transition-all ${
        primary
          ? 'bg-ck-t1 text-ck-bg1 border-ck-t1 hover:opacity-90'
          : 'bg-ck-bg1 text-ck-t2 border-ck-b1 hover:bg-ck-bg2'
      }`}
    >
      {children}
    </button>
  )
}

function SkillCard({ skill, badgeClass, badgeLabel, actions, showParams }: {
  skill: FullSkill
  badgeClass: string
  badgeLabel: string
  actions: React.ReactNode
  showParams?: boolean
}) {
  const configEntries = Object.entries(skill.config ?? {})

  return (
    <div className="bg-ck-bg1 border border-ck-b1 rounded-ck-lg p-4 hover:shadow-[0_2px_8px_rgba(0,0,0,0.05)] transition-shadow">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[14px] font-semibold text-ck-t1 truncate mr-2">{skill.name}</span>
        <span className={`text-[11px] px-2.5 py-[3px] rounded-[10px] font-medium shrink-0 ${badgeClass}`}>
          {badgeLabel}
        </span>
      </div>

      {skill.description && (
        <div className="text-[12px] text-ck-t2 leading-[1.55] mb-2.5">{skill.description}</div>
      )}

      <div className="flex gap-2.5 text-[11px] text-ck-t3 mb-3 flex-wrap">
        {skill.currentVersion && <span>v{skill.currentVersion}</span>}
        <span>{skill.type}</span>
      </div>

      {showParams && (
        configEntries.length > 0 ? (
          <div className="mt-2 px-2.5 py-1 bg-ck-bg2 rounded-[6px]">
            {configEntries.map(([key, val]) => (
              <div key={key} className="flex items-center justify-between py-1.5 text-[12px] border-b border-ck-b2 last:border-b-0">
                <span className="text-ck-t2">{key}</span>
                <span className="font-medium text-ck-t1">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-2 px-2.5 py-2.5 bg-ck-bg2 rounded-[6px] text-[12px] text-ck-t3 text-center">
            暂无参数配置
          </div>
        )
      )}

      <div className="flex gap-1.5 mt-2.5">{actions}</div>
    </div>
  )
}

/* ── Solution Skills tab ─────────────────────────────────────── */

function SolutionTab({ skills, onToggle }: { skills: FullSkill[]; onToggle: (id: string) => void }) {
  const enabled = skills.filter(s => s.enabled !== false)
  const disabled = skills.filter(s => s.enabled === false)

  return (
    <>
      <StatCards items={[
        { label: 'Solution 内置', value: skills.length },
        { label: '已启用', value: enabled.length },
        { label: '未启用', value: disabled.length },
        { label: '本月总调用', value: '—' },
      ]} />

      {enabled.length > 0 && (
        <div className="mb-5">
          <SectionHead title="已启用" count={enabled.length} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {enabled.map(skill => (
              <SkillCard
                key={skill.id}
                skill={skill}
                badgeClass="bg-ck-success-bg text-ck-success-t"
                badgeLabel="已启用"
                showParams
                actions={
                  <>
                    <CardBtn primary onClick={() => toast.info('参数配置功能开发中')}>配置参数</CardBtn>
                    <CardBtn onClick={() => onToggle(skill.id)}>停用</CardBtn>
                  </>
                }
              />
            ))}
          </div>
        </div>
      )}

      {disabled.length > 0 && (
        <div className="mb-5">
          <SectionHead title="未启用" count={disabled.length} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {disabled.map(skill => (
              <SkillCard
                key={skill.id}
                skill={skill}
                badgeClass="bg-ck-bg2 text-ck-t3"
                badgeLabel="未启用"
                showParams
                actions={
                  <>
                    <CardBtn primary onClick={() => onToggle(skill.id)}>启用</CardBtn>
                    <CardBtn onClick={() => toast.info('预览功能开发中')}>预览</CardBtn>
                  </>
                }
              />
            ))}
          </div>
        </div>
      )}

      {skills.length === 0 && (
        <div className="text-center py-9 text-[13px] text-ck-t3">暂无 Solution Skills</div>
      )}
    </>
  )
}

/* ── Custom Skills tab ───────────────────────────────────────── */

function CustomTab({ skills, onSetTab }: { skills: FullSkill[]; onSetTab: (t: TabKey) => void }) {
  const published = skills.filter(s => s.status === 'published')
  const drafts = skills.filter(s => s.status !== 'published')

  return (
    <>
      <StatCards items={[
        { label: '自建 Skills', value: skills.length },
        { label: '已发布', value: published.length },
        { label: '草稿', value: drafts.length },
        { label: '本月调用', value: '—' },
      ]} />

      <div className="mb-5">
        <SectionHead
          title="Tenant 自建 Skills"
          trailing={
            <button
              onClick={() => toast.info('请在 Jijian 中通过 SKILL.md 创建新 Skill')}
              className="text-[12px] px-3.5 py-[5px] rounded-ck border border-ck-b1 bg-ck-bg1 text-ck-t1 font-medium hover:bg-ck-bg2 transition-colors"
            >
              + 新建 Skill
            </button>
          }
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {skills.map(skill => {
            const isPublished = skill.status === 'published'
            return (
              <SkillCard
                key={skill.id}
                skill={skill}
                badgeClass={isPublished ? 'bg-ck-coral-bg text-ck-coral-t' : 'bg-ck-bg2 text-ck-t2'}
                badgeLabel={isPublished ? '自建·已发布' : '草稿'}
                actions={
                  isPublished ? (
                    <>
                      <CardBtn primary onClick={() => toast.info('编辑功能开发中')}>编辑</CardBtn>
                      <CardBtn onClick={() => onSetTab('stats')}>查看统计</CardBtn>
                      <CardBtn onClick={() => toast.info('停用功能开发中')}>停用</CardBtn>
                    </>
                  ) : (
                    <>
                      <CardBtn primary onClick={() => toast.info('编辑功能开发中')}>继续编辑</CardBtn>
                      <CardBtn onClick={() => toast.info('发布功能开发中')}>发布</CardBtn>
                      <CardBtn onClick={() => toast.info('删除功能开发中')}>删除</CardBtn>
                    </>
                  )
                }
              />
            )
          })}
          {skills.length === 0 && (
            <div className="col-span-full text-center py-9 text-[13px] text-ck-t3">
              暂无自建 Skills
            </div>
          )}
        </div>
      </div>
    </>
  )
}

/* ── Stats tab (placeholder) ─────────────────────────────────── */

function StatsTab({ totalSkills }: { totalSkills: number }) {
  return (
    <>
      <StatCards items={[
        { label: '总 Skills', value: totalSkills },
        { label: '本月调用', value: '—' },
        { label: '活跃用户', value: '—' },
        { label: '平均评分', value: '—' },
      ]} />
      <div className="text-center py-9 text-[13px] text-ck-t3">
        使用统计功能即将上线
      </div>
    </>
  )
}
