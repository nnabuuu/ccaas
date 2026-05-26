import type { AuthProvider } from '@refinedev/core'
import { ADMIN_API_KEY_STORAGE as API_KEY_STORAGE } from '@kedge-agentic/common'
import { apiClient } from '@/lib/api-client'
import { useTenantContext } from '@/hooks/use-tenant-context'

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
    } catch (err: unknown) {
      localStorage.removeItem(API_KEY_STORAGE)
      const axiosError = err as { response?: { status?: number; data?: { message?: string } }; request?: unknown }
      let message = 'Invalid API key'
      if (axiosError.response) {
        const status = axiosError.response.status
        if (status === 401) {
          message = 'API Key 无效'
        } else if (status === 403) {
          message = '权限不足（需要 admin 或 builder scope）'
        } else if (status === 429) {
          message = '请求过于频繁，请稍后重试'
        } else {
          message = axiosError.response.data?.message || `请求失败 (${status})`
        }
      } else if (axiosError.request) {
        message = '网络连接失败，请检查后端是否运行'
      }
      return {
        success: false,
        error: { name: 'Login Error', message },
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
