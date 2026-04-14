/** Recipe-book backend URL (port 3002) */
export const RECIPE_BACKEND_URL = import.meta.env.VITE_RECIPE_URL || 'http://localhost:3002'

/** CCAAS core URL (port 3001) — for ChatInterface */
export const CCAAS_URL = import.meta.env.VITE_CCAAS_URL || 'http://localhost:3001'

/** CCAAS tenant ID */
export const TENANT_ID = 'recipe-book'

/** Session template for cooking assistant */
export const SESSION_TEMPLATE = 'cooking'

/** API key */
export const API_KEY = 'sk-default-testd84f5b7a1dbdbc4c424417be6c009f01'
