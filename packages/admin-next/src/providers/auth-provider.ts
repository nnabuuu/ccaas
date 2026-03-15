import type { AuthProvider } from '@refinedev/core'
import { apiClient } from '@/lib/api-client'
import { useTenantContext } from '@/hooks/use-tenant-context'

const API_KEY_STORAGE = 'admin_api_key'

export const authProvider: AuthProvider = {
  login: async ({ apiKey }: { apiKey: string }) => {
    try {
      localStorage.setItem(API_KEY_STORAGE, apiKey)
      // Validate the key by hitting the dashboard endpoint
      const response = await apiClient.get('/admin/dashboard/summary')
      const callerScope = response.data?.callerScope
      if (callerScope) {
        useTenantContext.getState().setCallerScope(callerScope)
      }
      return { success: true, redirectTo: '/dashboard' }
    } catch {
      localStorage.removeItem(API_KEY_STORAGE)
      return {
        success: false,
        error: { name: 'Login Error', message: 'Invalid API key' },
      }
    }
  },

  logout: async () => {
    localStorage.removeItem(API_KEY_STORAGE)
    useTenantContext.getState().clear()
    return { success: true, redirectTo: '/login' }
  },

  check: async () => {
    const apiKey = localStorage.getItem(API_KEY_STORAGE)
    if (!apiKey) {
      return { authenticated: false }
    }
    return { authenticated: true }
  },

  getIdentity: async () => {
    const apiKey = localStorage.getItem(API_KEY_STORAGE)
    if (!apiKey) return null
    const scope = useTenantContext.getState().callerScope
    return {
      id: scope === 'builder' ? 'builder' : 'admin',
      name: scope === 'builder' ? 'Builder' : 'Admin',
      avatar: undefined,
    }
  },

  onError: async (error) => {
    if (error?.statusCode === 401) {
      return { logout: true, redirectTo: '/login' }
    }
    return { error }
  },
}
