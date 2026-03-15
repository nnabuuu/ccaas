import { create } from 'zustand'

interface TenantState {
  selectedTenantId: string | null
  tenants: Array<{ id: string; name: string; slug: string }>
  callerScope: 'admin' | 'builder' | null
  setSelectedTenantId: (id: string | null) => void
  setTenants: (tenants: Array<{ id: string; name: string; slug: string }>) => void
  setCallerScope: (scope: 'admin' | 'builder') => void
  clear: () => void
}

export const useTenantContext = create<TenantState>((set) => ({
  selectedTenantId: null,
  tenants: [],
  callerScope: null,
  setSelectedTenantId: (id) => set({ selectedTenantId: id }),
  setTenants: (tenants) => set({ tenants }),
  setCallerScope: (scope) => set({ callerScope: scope }),
  clear: () => set({ selectedTenantId: null, tenants: [], callerScope: null }),
}))
