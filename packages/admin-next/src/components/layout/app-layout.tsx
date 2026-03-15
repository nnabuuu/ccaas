import { useState, useEffect, useRef } from 'react'
import { Outlet } from 'react-router-dom'
import { useCustom } from '@refinedev/core'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { CommandPalette } from './command-palette'
import { useTenantContext } from '@/hooks/use-tenant-context'

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const { setTenants, selectedTenantId, setSelectedTenantId } = useTenantContext()
  const selectedTenantRef = useRef(selectedTenantId)
  selectedTenantRef.current = selectedTenantId

  const { data } = useCustom({
    url: '/admin/tenants',
    method: 'get',
    queryOptions: {
      staleTime: 0,
      cacheTime: 0,
    },
  })

  useEffect(() => {
    if (data?.data) {
      const tenantList = Array.isArray(data.data) ? data.data : (data.data as { tenants?: unknown[] }).tenants ?? []
      const mapped = (tenantList as Array<{ id: string; name: string; slug: string }>).map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
      }))
      setTenants(mapped)
      // Auto-select if only one tenant (builder scenario)
      if (mapped.length === 1 && !selectedTenantRef.current) {
        setSelectedTenantId(mapped[0].id)
      }
    }
  }, [data, setTenants, setSelectedTenantId])

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
      <CommandPalette />
    </div>
  )
}
