import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Command } from 'cmdk'
import {
  LayoutDashboard,
  MessageSquare,
  Zap,
  Building2,
  ScrollText,
  BarChart3,
  Calendar,
  Search,
} from 'lucide-react'
import { useLang } from '@/contexts/language-context'

const pages = [
  { zh: '仪表板', en: 'Dashboard', href: '/', icon: LayoutDashboard, keywords: ['home', 'overview', '首页'] },
  { zh: '会话', en: 'Sessions', href: '/sessions', icon: MessageSquare, keywords: ['chat', 'conversation', '对话'] },
  { zh: '技能', en: 'Skills', href: '/skills', icon: Zap, keywords: ['prompt', 'ability', '提示词'] },
  { zh: '租户', en: 'Tenants', href: '/tenants', icon: Building2, keywords: ['organization', 'company', '组织'] },
  { zh: '审计日志', en: 'Audit Log', href: '/audit', icon: ScrollText, keywords: ['log', 'history', 'event', '日志'] },
  { zh: '数据分析', en: 'Analytics', href: '/analytics', icon: BarChart3, keywords: ['metrics', 'usage', 'chart', '统计'] },
  { zh: '技能分析', en: 'Skill Analytics', href: '/analytics/skills', icon: BarChart3, keywords: ['skill', 'usage', 'performance'] },
  { zh: '调度器', en: 'Scheduler', href: '/scheduler', icon: Calendar, keywords: ['job', 'cron', 'task', '任务'] },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { lang } = useLang()

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      setOpen((prev) => !prev)
    }
  }, [])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const handleSelect = (href: string) => {
    setOpen(false)
    navigate(href)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={() => setOpen(false)}
      />

      {/* Dialog */}
      <div className="fixed left-1/2 top-[20%] -translate-x-1/2 w-full max-w-lg">
        <Command
          className="rounded-xl border bg-popover shadow-2xl overflow-hidden"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false)
          }}
        >
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <Command.Input
              placeholder={lang === 'zh' ? '搜索页面...' : 'Search pages...'}
              className="flex h-12 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
          </div>
          <Command.List className="max-h-[300px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              {lang === 'zh' ? '未找到结果' : 'No results found.'}
            </Command.Empty>
            <Command.Group heading={lang === 'zh' ? '页面' : 'Pages'} className="text-xs text-muted-foreground px-2 py-1.5">
              {pages.map((page) => (
                <Command.Item
                  key={page.href}
                  value={[page.zh, page.en, ...page.keywords].join(' ')}
                  onSelect={() => handleSelect(page.href)}
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground"
                >
                  <page.icon className="h-4 w-4 text-muted-foreground" />
                  <span>{lang === 'zh' ? page.zh : page.en}</span>
                  <span className="ml-auto text-xs text-muted-foreground font-mono">{page.href}</span>
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
          <div className="border-t px-3 py-2 text-xs text-muted-foreground flex items-center gap-4">
            <span>
              <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px] font-mono">ESC</kbd> {lang === 'zh' ? '关闭' : 'to close'}
            </span>
            <span>
              <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px] font-mono">Enter</kbd> {lang === 'zh' ? '导航' : 'to navigate'}
            </span>
          </div>
        </Command>
      </div>
    </div>
  )
}
