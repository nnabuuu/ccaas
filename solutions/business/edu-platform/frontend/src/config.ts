/** CCAAS backend URL — MUST be absolute URL, never empty string */
export const SERVER_URL = import.meta.env.VITE_CCAAS_BACKEND_URL || 'http://localhost:3001'

/** Tenant identifier for this solution */
export const TENANT_ID = 'edu-platform'

/** Edu platform backend API base URL (Harness A backend, port 3011) */
export const EDU_API = import.meta.env.VITE_EDU_API_URL || 'http://localhost:3011/api'
