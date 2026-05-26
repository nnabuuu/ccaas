/**
 * Shared constants for ccaas clients.
 *
 * Keep this file dependency-free — `@kedge-agentic/common` is the bottom
 * of the dep graph (admin-next, SDKs, solutions all pull from it). Adding
 * a runtime dep here would cascade everywhere.
 */

/**
 * localStorage key under which `@kedge-agentic/admin-next` stores the
 * operator's admin API key after login.
 *
 * **Admin-app convention only.** Solution clients (creator apps, student
 * frontends, integration scripts) MUST NOT use this key. End users
 * belong to the solution, not to ccaas; their browser never holds a
 * ccaas key. Solution backends hold one `CCAAS_API_KEY` per tenant in
 * a server-side env var and proxy ccaas calls on the browser's behalf.
 *
 * Why a named constant: the literal `'admin_api_key'` was previously
 * hardcoded in three places inside admin-next (auth-provider, api-client,
 * a hook). Centralizing here lets the auth provider, the axios
 * interceptor, and any future admin-only consumer reference one source
 * of truth.
 */
export const ADMIN_API_KEY_STORAGE = 'admin_api_key';
