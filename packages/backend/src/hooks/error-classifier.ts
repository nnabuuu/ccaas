/**
 * Error Classifier
 *
 * Classifies tool errors into categories for analytics and debugging.
 */

/**
 * Tool error type classification
 */
export type ToolErrorType =
  | 'file_not_found'      // ENOENT, "no such file"
  | 'permission_denied'   // EACCES, EPERM, "permission denied"
  | 'timeout'             // ETIMEDOUT, "timed out"
  | 'command_failed'      // exit code != 0, "command not found"
  | 'network_error'       // ECONNREFUSED, ENOTFOUND, socket errors
  | 'parse_error'         // JSON parse errors, syntax errors
  | 'validation_error'    // invalid arguments, missing fields
  | 'unknown';            // fallback

/**
 * Error classification patterns
 * Order matters - first match wins
 */
const ERROR_PATTERNS: Array<{ pattern: RegExp; type: ToolErrorType }> = [
  // File not found - check before command_failed since both have "not found"
  { pattern: /enoent|no such file|file not found/i, type: 'file_not_found' },

  // Permission denied
  { pattern: /eacces|eperm|permission denied|access denied/i, type: 'permission_denied' },

  // Timeout errors
  { pattern: /timeout|timed?.?out|etimedout/i, type: 'timeout' },

  // Network errors - check before command_failed
  { pattern: /econnrefused|econnreset|enotfound|socket|getaddrinfo|connection refused/i, type: 'network_error' },

  // Parse errors
  { pattern: /syntaxerror|json\.?parse|invalid json|unexpected token|yamlexception/i, type: 'parse_error' },

  // Validation errors
  { pattern: /validation|invalid argument|invalid parameter|required field|must be/i, type: 'validation_error' },

  // Command failed - check last since patterns like "not found" overlap
  { pattern: /exit code|command failed|command not found/i, type: 'command_failed' },
];

/**
 * Extract error string from various input formats
 */
function extractErrorString(content: unknown): string {
  if (content === null || content === undefined) {
    return '';
  }

  if (typeof content === 'string') {
    return content;
  }

  if (typeof content !== 'object') {
    return '';
  }

  const obj = content as Record<string, unknown>;

  // Check for code property (Node.js error codes)
  if (typeof obj.code === 'string') {
    return obj.code;
  }

  // Check for error property
  if (obj.error !== undefined) {
    if (typeof obj.error === 'string') {
      return obj.error;
    }
    if (typeof obj.error === 'object' && obj.error !== null) {
      const nested = obj.error as Record<string, unknown>;
      if (typeof nested.message === 'string') {
        return nested.message;
      }
    }
  }

  // Check for message property
  if (typeof obj.message === 'string') {
    return obj.message;
  }

  // Try JSON stringification as fallback
  try {
    return JSON.stringify(content);
  } catch {
    return '';
  }
}

/**
 * Classify a tool error into a category
 *
 * @param content - Error content (string, object with error/message property, etc.)
 * @returns The classified error type
 */
export function classifyToolError(content: unknown): ToolErrorType {
  const errorString = extractErrorString(content);

  if (!errorString) {
    return 'unknown';
  }

  for (const { pattern, type } of ERROR_PATTERNS) {
    if (pattern.test(errorString)) {
      return type;
    }
  }

  return 'unknown';
}
