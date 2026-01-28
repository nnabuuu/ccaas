/**
 * Auth Store
 *
 * Manages authentication state including login, logout, and user info.
 * Core cross-cutting store for authentication concerns.
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import request from '../../utils/request'
import type { User } from '@/types'

// Environment configuration
const DEFAULT_TENANT_ID = import.meta.env.VITE_TENANT_ID || '000000'
const CLIENT_ID = import.meta.env.VITE_CLIENT_ID || 'e5cd7e4891bf95d1d19206ce24a7b32e'

interface LoginResult {
  success: boolean
  message?: string
}

export const useAuthStore = defineStore('auth', () => {
  // State
  const token = ref<string>(localStorage.getItem('token') || '')
  const user = ref<User | null>(JSON.parse(localStorage.getItem('user') || 'null'))
  const tenantId = ref<string>(localStorage.getItem('tenantId') || DEFAULT_TENANT_ID)

  // Getters
  const isLoggedIn = computed(() => !!token.value)
  const userName = computed(() => user.value?.userName || '')
  const userId = computed(() => user.value?.userId || null)

  // Actions

  /**
   * Authenticate user with username and password
   */
  async function login(username: string, password: string): Promise<LoginResult> {
    try {
      const response = await request.post('/auth/login', {
        username,
        password,
        tenantId: tenantId.value,
        clientId: CLIENT_ID,
        grantType: 'password'
      })

      // Store token
      token.value = response.data.access_token
      localStorage.setItem('token', token.value)

      // Fetch user info
      await fetchUserInfo()

      return { success: true }
    } catch (error) {
      console.error('[AuthStore] Login failed:', error)
      return { success: false, message: (error as Error).message }
    }
  }

  /**
   * Fetch current user information
   */
  async function fetchUserInfo(): Promise<User> {
    try {
      const response = await request.get('/system/user/getInfo')
      user.value = response.data.user
      localStorage.setItem('user', JSON.stringify(user.value))
      return user.value!
    } catch (error) {
      console.error('[AuthStore] Failed to fetch user info:', error)
      throw error
    }
  }

  /**
   * Logout user and clear all auth state
   */
  function logout(): void {
    // Call logout API (fire and forget)
    request.post('/auth/logout').catch(() => {})

    // Clear local state
    token.value = ''
    user.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  /**
   * Set tenant ID for multi-tenant support
   */
  function setTenantId(id: string): void {
    tenantId.value = id
    localStorage.setItem('tenantId', id)
  }

  return {
    // State
    token,
    user,
    tenantId,
    // Getters
    isLoggedIn,
    userName,
    userId,
    // Actions
    login,
    logout,
    fetchUserInfo,
    setTenantId
  }
})
