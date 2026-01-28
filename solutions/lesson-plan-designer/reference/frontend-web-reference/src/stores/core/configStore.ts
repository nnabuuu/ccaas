/**
 * Config Store
 *
 * Manages application configuration, feature flags, and constants.
 * Core cross-cutting store for application-wide settings.
 *
 * State:
 * - featureFlags: Feature flag settings
 * - constants: Application constants
 *
 * Mutation Patterns:
 * - All operations are optimistic (local state only)
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// Types
type ThemeMode = 'light' | 'dark' | 'system'

interface FeatureFlags {
  enableAiAssistant: boolean
  enableDarkMode: boolean
  enableDebugPanel: boolean
  enableNotifications: boolean
  [key: string]: boolean
}

interface AppConstants {
  maxFileSize: number
  defaultPageSize: number
  supportedImageTypes: string[]
  supportedDocTypes: string[]
}

interface ThemeSettings {
  mode: ThemeMode
  primaryColor: string
}

export const useConfigStore = defineStore('config', () => {
  // === State ===

  /**
   * Feature flags for controlling feature availability
   */
  const featureFlags = ref<FeatureFlags>({
    enableAiAssistant: true,
    enableDarkMode: false,
    enableDebugPanel: import.meta.env.DEV,
    enableNotifications: true
  })

  /**
   * Application constants
   */
  const constants = ref<AppConstants>({
    maxFileSize: 10 * 1024 * 1024, // 10MB
    defaultPageSize: 10,
    supportedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    supportedDocTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  })

  /**
   * Theme settings
   */
  const theme = ref<ThemeSettings>({
    mode: 'light',
    primaryColor: '#3b82f6'
  })

  // === Computed ===

  const isDarkMode = computed(() => {
    if (theme.value.mode === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return theme.value.mode === 'dark'
  })

  const isFeatureEnabled = computed(() => (featureName: string): boolean => {
    return featureFlags.value[featureName] ?? false
  })

  // === Actions ===

  /**
   * Toggle a feature flag
   * @pattern optimistic
   * @param flagName - Name of the feature flag
   * @param value - Optional explicit value, otherwise toggles
   */
  function toggleFeature(flagName: string, value?: boolean): void {
    if (flagName in featureFlags.value) {
      featureFlags.value[flagName] = value ?? !featureFlags.value[flagName]
    }
  }

  /**
   * Set theme mode
   * @pattern optimistic
   * @param mode - Theme mode to set
   */
  function setThemeMode(mode: ThemeMode): void {
    theme.value.mode = mode
    localStorage.setItem('themeMode', mode)
  }

  /**
   * Initialize config from localStorage
   * @pattern optimistic
   */
  function initialize(): void {
    const savedThemeMode = localStorage.getItem('themeMode') as ThemeMode | null
    if (savedThemeMode) {
      theme.value.mode = savedThemeMode
    }
  }

  /**
   * Reset all settings to defaults
   * @pattern optimistic
   */
  function reset(): void {
    featureFlags.value = {
      enableAiAssistant: true,
      enableDarkMode: false,
      enableDebugPanel: import.meta.env.DEV,
      enableNotifications: true
    }
    theme.value = {
      mode: 'light',
      primaryColor: '#3b82f6'
    }
    localStorage.removeItem('themeMode')
  }

  return {
    // State
    featureFlags,
    constants,
    theme,
    // Computed
    isDarkMode,
    isFeatureEnabled,
    // Actions
    toggleFeature,
    setThemeMode,
    initialize,
    reset
  }
})
