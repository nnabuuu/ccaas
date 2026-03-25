/**
 * Build auth headers for API requests.
 * When apiKey is provided, includes X-API-Key header for ApiKeyGuard authentication.
 */
export function buildAuthHeaders(apiKey?: string): Record<string, string> {
  return apiKey ? { 'X-API-Key': apiKey } : {}
}
