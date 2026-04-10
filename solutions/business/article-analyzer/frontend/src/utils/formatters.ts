/**
 * Format a token count into a human-readable short form.
 * e.g. 12345 → "12.3k", 500 → "500", 1234567 → "1.2M"
 */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/**
 * Format duration in milliseconds to a human-readable string.
 * e.g. 83000 → "1m 23s", 5200 → "5.2s", 0 → "-"
 */
export function formatDuration(ms: number): string {
  if (ms <= 0) return '-';
  if (ms < 1000) return `${ms}ms`;
  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) return `${totalSeconds.toFixed(1)}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}m ${seconds}s`;
}

/**
 * Format an ISO date string to a relative time like "3 min ago", "2h ago", "5d ago".
 */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * Format a score number to one decimal place.
 * e.g. 85.5 → "85.5", null → "-"
 */
export function formatScore(n: number | null): string {
  if (n == null) return '-';
  return n.toFixed(1);
}
