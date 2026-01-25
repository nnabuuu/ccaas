import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Tenant } from '@/types/admin'

const API_KEY_STORAGE_KEY = 'admin_api_key'
const SELECTED_TENANT_KEY = 'admin_selected_tenant'

// Demo API key from environment variable (for easy demo access)
const DEMO_API_KEY = import.meta.env.VITE_DEMO_API_KEY as string | undefined

export const useAuthStore = defineStore('auth', () => {
  const apiKey = ref<string | null>(null)

  // Tenant context
  const tenantList = ref<Tenant[]>([])
  const selectedTenantId = ref<string | null>(null)

  const isAuthenticated = computed(() => !!apiKey.value)

  // Check if a demo key is configured in the environment
  const hasDemoKey = computed(() => !!DEMO_API_KEY && DEMO_API_KEY.trim().length > 0)

  // Get the currently selected tenant object
  const selectedTenant = computed(() =>
    tenantList.value.find(t => t.id === selectedTenantId.value) || null
  )

  function loadApiKey() {
    const stored = localStorage.getItem(API_KEY_STORAGE_KEY)
    if (stored) {
      apiKey.value = stored
    }
  }

  function setApiKey(key: string) {
    apiKey.value = key
    localStorage.setItem(API_KEY_STORAGE_KEY, key)
  }

  function clearApiKey() {
    apiKey.value = null
    localStorage.removeItem(API_KEY_STORAGE_KEY)
  }

  /**
   * Use the demo API key from environment variable.
   * Returns true if successful, false if no demo key is configured.
   */
  function useDemoKey(): boolean {
    if (!DEMO_API_KEY || !DEMO_API_KEY.trim()) {
      return false
    }
    setApiKey(DEMO_API_KEY.trim())
    return true
  }

  function getAuthHeaders(): Record<string, string> {
    if (!apiKey.value) return {}
    return {
      'Authorization': `Bearer ${apiKey.value}`
    }
  }

  // Tenant management functions
  function setTenantList(tenants: Tenant[]) {
    tenantList.value = tenants

    // If no tenant is selected, try to restore from localStorage or select first
    if (!selectedTenantId.value && tenants.length > 0) {
      const storedTenantId = localStorage.getItem(SELECTED_TENANT_KEY)
      if (storedTenantId && tenants.some(t => t.id === storedTenantId)) {
        selectedTenantId.value = storedTenantId
      }
      // Don't auto-select first tenant - allow "All Tenants" view by default
    }
  }

  function selectTenant(tenantId: string | null) {
    selectedTenantId.value = tenantId
    if (tenantId) {
      localStorage.setItem(SELECTED_TENANT_KEY, tenantId)
    } else {
      localStorage.removeItem(SELECTED_TENANT_KEY)
    }
  }

  function loadSelectedTenant() {
    const stored = localStorage.getItem(SELECTED_TENANT_KEY)
    if (stored) {
      selectedTenantId.value = stored
    }
  }

  function clearTenantSelection() {
    selectedTenantId.value = null
    localStorage.removeItem(SELECTED_TENANT_KEY)
  }

  return {
    // Auth
    apiKey,
    isAuthenticated,
    hasDemoKey,
    loadApiKey,
    setApiKey,
    clearApiKey,
    useDemoKey,
    getAuthHeaders,

    // Tenant context
    tenantList,
    selectedTenantId,
    selectedTenant,
    setTenantList,
    selectTenant,
    loadSelectedTenant,
    clearTenantSelection
  }
})
