import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  MessageSquare,
  Building2,
  ScrollText,
  BarChart3,
  Calendar,
  Key,
  ChevronLeft,
  ChevronRight,
  ListOrdered,
  Sparkles,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTenantContext } from '@/hooks/use-tenant-context'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { T } from '@/components/shared/t'

const navigation = [
  { zh: '仪表板', en: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { zh: '会话', en: 'Sessions', href: '/sessions', icon: MessageSquare },
  { zh: '技能', en: 'Skills', href: '/skills', icon: Sparkles },
  { zh: '队列监控', en: 'Queue Monitor', href: '/queue', icon: ListOrdered, adminOnly: true },
  { zh: '租户', en: 'Tenants', href: '/tenants', icon: Building2 },
  { zh: 'API 密钥', en: 'API Keys', href: '/api-keys', icon: Key },
  { zh: '用户', en: 'Users', href: '/users', icon: Users },
  { zh: '审计日志', en: 'Audit Log', href: '/audit', icon: ScrollText, adminOnly: true },
  { zh: '数据分析', en: 'Analytics', href: '/analytics', icon: BarChart3 },
  { zh: '调度器', en: 'Scheduler', href: '/scheduler', icon: Calendar, adminOnly: true },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation()
  const { callerScope } = useTenantContext()
  const filteredNav = navigation.filter(item =>
    !item.adminOnly || callerScope === 'admin'
  )

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={cn(
          'relative flex flex-col border-r bg-sidebar transition-all duration-300',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center border-b px-4">
          {!collapsed && (
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
                C
              </div>
              <span className="font-semibold text-sidebar-foreground">CCaaS Admin</span>
            </Link>
          )}
          {collapsed && (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold mx-auto">
              C
            </div>
          )}
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 px-2 py-4">
          <nav className="flex flex-col gap-1">
            {filteredNav.map((item) => {
              const isActive =
                location.pathname === item.href || location.pathname.startsWith(item.href + '/')
              const link = (
                <Link
                  key={item.en}
                  to={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    collapsed && 'justify-center px-2',
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span><T zh={item.zh} en={item.en} /></span>}
                </Link>
              )

              if (collapsed) {
                return (
                  <Tooltip key={item.en}>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right"><T zh={item.zh} en={item.en} /></TooltipContent>
                  </Tooltip>
                )
              }

              return link
            })}
          </nav>
        </ScrollArea>

        <Separator />

        {/* Collapse toggle */}
        <div className="p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className={cn('w-full', collapsed ? 'justify-center' : 'justify-start')}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            {!collapsed && <span className="ml-2"><T zh="收起" en="Collapse" /></span>}
          </Button>
        </div>
      </div>
    </TooltipProvider>
  )
}
