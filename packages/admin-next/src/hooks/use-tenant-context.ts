import { create } from 'zustand'

interface TenantState {
  selectedTenantId: string | null
  tenants: Array<{ id: string; name: string; slug: string }>
  setSelectedTenantId: (id: string | null) => void
  setTenants: (tenants: Array<{ id: string; name: string; slug: string }>) => void
}

export const useTenantContext = create<TenantState>((set) => ({
  selectedTenantId: null,
  tenants: [],
  setSelectedTenantId: (id) => set({ selectedTenantId: id }),
  setTenants: (tenants) => set({ tenants }),
}))
