/**
 * `scrubToken` — pure helper for redacting the ccaas API key from any
 * string before it lands in a log, a thrown Error message, or an HTTP
 * response body.
 *
 * Lives in its own module (not on `CcaasUpstream`) because it has no
 * state and no DI concerns. Consumers — both proxy controllers + the
 * upstream service itself — import the free function directly. This
 * avoids the slightly-weird shape of "import { CcaasUpstream,
 * scrubToken } from the same file" (the service was exporting both).
 *
 * Two leak vectors covered:
 *
 *   1. `?token=<value>` — used by the project-scoped SSE proxy because
 *      EventSource can't set headers, so the key is in the URL. A
 *      misconfigured intermediary echoing `req.url` back in an error
 *      body (e.g. "Cannot GET <full-url>") would surface the key.
 *
 *   2. `Authorization: Bearer <value>` — used by the chat-scoped
 *      proxy (fetch with auth header). If Node's fetch ever includes
 *      request headers in an error message (some runtimes do on
 *      connection failures), or if ccaas's error body ever echoes
 *      the Authorization header back, the key would leak. Defence
 *      in depth — no known path surfaces it today, but the cost is zero.
 *
 * Conservative on URL-encoded forms — if the surrounding text already
 * escaped or encoded the token, the regex won't match and we leave it
 * alone (the encoding is itself protection).
 */
export function scrubToken(s: string): string {
  return s
    .replace(/(token=)[^&\s"'<>]+/gi, '$1***')
    .replace(/(bearer\s+)[A-Za-z0-9._\-]+/gi, '$1***');
}
