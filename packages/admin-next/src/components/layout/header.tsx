import { useGetIdentity, useLogout } from '@refinedev/core'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogOut, Moon, Sun, User, Globe } from 'lucide-react'
import { useTenantContext } from '@/hooks/use-tenant-context'
import { useTheme } from '@/hooks/use-theme'
import { useLang } from '@/contexts/language-context'
import { T } from '@/components/shared/t'

export function Header() {
  const { data: identity } = useGetIdentity<{ name: string }>()
  const { mutate: logout } = useLogout()
  const { selectedTenantId, setSelectedTenantId, tenants } = useTenantContext()
  const { theme, toggleTheme } = useTheme()
  const { lang, toggleLang } = useLang()

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-4">
        <Select
          value={selectedTenantId ?? 'all'}
          onValueChange={(v) => setSelectedTenantId(v === 'all' ? null : v)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={<T zh="所有租户" en="All Tenants" />} />
          </SelectTrigger>
          <SelectContent>
            {tenants.length > 1 && (
              <SelectItem value="all"><T zh="所有租户" en="All Tenants" /></SelectItem>
            )}
            {tenants.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={toggleLang} className="text-xs font-medium gap-1.5">
          <Globe className="h-3.5 w-3.5" />
          {lang === 'zh' ? 'EN' : '中文'}
        </Button>

        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <User className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <div className="px-2 py-1.5 text-sm font-medium">{identity?.name ?? <T zh="管理员" en="Admin" />}</div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => logout()}>
              <LogOut className="mr-2 h-4 w-4" />
              <T zh="退出登录" en="Sign out" />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
