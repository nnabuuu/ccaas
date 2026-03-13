import type { AuthProvider } from '@refinedev/core'
import { useTenantContext } from '@/hooks/use-tenant-context'

const API_KEY_STORAGE = 'admin_api_key'
const DEV_API_KEY = import.meta.env.VITE_DEV_API_KEY

/**
 * Development-only auth provider that auto-logs in with a dev API key.
 * DO NOT USE IN PRODUCTION.
 *
 * Usage:
 * 1. Generate a dev admin key: cd packages/backend && npm run create-dev-key
 * 2. Set VITE_DEV_API_KEY in .env.local
 * 3. The provider will automatically log you in with this key
 */
export const devAuthProvider: AuthProvider = {
  login: async () => {
    // Auto-store the dev API key
    if (DEV_API_KEY) {
      localStorage.setItem(API_KEY_STORAGE, DEV_API_KEY)
    }
    return { success: true, redirectTo: '/dashboard' }
  },

  logout: async () => {
    localStorage.removeItem(API_KEY_STORAGE)
    useTenantContext.getState().clear()
    return { success: true, redirectTo: '/login' }
  },

  check: async () => {
    // Auto-login with dev key if available
    if (DEV_API_KEY) {
      localStorage.setItem(API_KEY_STORAGE, DEV_API_KEY)
      return { authenticated: true }
    }

    // Check if key exists in storage
    const apiKey = localStorage.getItem(API_KEY_STORAGE)
    if (!apiKey) {
      return { authenticated: false }
    }
    return { authenticated: true }
  },

  getIdentity: async () => {
    return {
      id: 'dev-admin',
      name: DEV_API_KEY ? 'Dev Admin (Auto-Key)' : 'Dev Admin',
      avatar: undefined,
    }
  },

  onError: async (error) => {
    return { error }
  },
}
