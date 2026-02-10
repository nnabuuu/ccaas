/**
 * Application constants
 */

export const APP_CONFIG = {
  TENANT_ID: 'quiz-analyzer',
  SESSION_PREFIX: 'quiz',
  BACKEND_URL: import.meta.env.VITE_CCAAS_BACKEND_URL || 'http://localhost:3001',
} as const

export const UI_CONFIG = {
  CHAT_COLLAPSED_HEIGHT: 60,
  CHAT_EXPANDED_HEIGHT: 500,
  DEBOUNCE_DELAY_MS: 500,
} as const
