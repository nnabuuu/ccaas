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
import { LogOut, Moon, Sun, User } from 'lucide-react'
import { useTenantContext } from '@/hooks/use-tenant-context'
import { useTheme } from '@/hooks/use-theme'

export function Header() {
  const { data: identity } = useGetIdentity<{ name: string }>()
  const { mutate: logout } = useLogout()
  const { selectedTenantId, setSelectedTenantId, tenants } = useTenantContext()
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-4">
        <Select
          value={selectedTenantId ?? 'all'}
          onValueChange={(v) => setSelectedTenantId(v === 'all' ? null : v)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Tenants" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tenants</SelectItem>
            {tenants.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
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
            <div className="px-2 py-1.5 text-sm font-medium">{identity?.name ?? 'Admin'}</div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => logout()}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
