/**
 * useProjectChanges — subscribe to ccaas agent-runtime change events
 * for a project. Surfaces agent-side edits (and `conflict_agent_wins`
 * markers) so the creator UI can show banners + offer reload.
 *
 * What it filters OUT (returned events array never contains these):
 *   - kind === 'subscribed'   — welcome event fired once per connection
 *   - kind === 'heartbeat'    — every 30s, used internally for liveness
 *   - source === 'gui'        — echoes of our OWN writes (we don't want to alert ourselves)
 *
 * What it surfaces:
 *   - source === 'agent' edits (`updated` / `deleted`)
 *   - actor === 'conflict-agent-wins' (a special agent-wins-on-dual-write marker)
 *
 * Reconnection: relies on the browser's built-in EventSource
 * reconnect (with exponential backoff). If the server is down, the
 * hook flips `isConnected=false` and `error` is populated; once the
 * server comes back, the browser auto-reconnects and `isConnected`
 * flips true via the next welcome event.
 *
 * **Auth status (Phase 2a)**: the ccaas SSE endpoint at
 * `/api/v1/projects/:projectId/changes` is currently unauthenticated.
 * `EventSource` cannot set HTTP headers, so when auth lands on that
 * endpoint (tracked in `docs/AGENT_RUNTIME_DESIGN.md` § Phase 2 security),
 * this hook will need to either (a) accept a query-param token, or
 * (b) switch to a fetch-based SSE reader (rewrite — EventSource just
 * doesn't support `Authorization` headers).
 *
 * Events array is capped at MAX_EVENTS (50) — older events drop off
 * the tail. The UI typically only renders the most recent few.
 */

import { useEffect, useState, useCallback, useRef } from 'react';

import { getChangesStreamUrl } from '../api/projects';

/**
 * Mirrors the backend's `ChangeEvent` shape from
 * `@kedge-agentic/agent-runtime/sync`. Defined inline here to avoid
 * a workspace dep on the runtime package (the creator app is a
 * standalone Vite app that doesn't currently consume agent-runtime).
 */
export interface ChangeEvent {
  projectId: string;
  path: string;
  source: 'agent' | 'gui' | 'system';
  kind: 'created' | 'updated' | 'deleted' | 'subscribed' | 'heartbeat';
  at: string;
  actor?: string;
}

export interface UseProjectChangesResult {
  /** Filtered events (no heartbeats, no own-writes); newest last. */
  readonly events: ChangeEvent[];
  /** True when the SSE connection is open (welcome event received). */
  readonly isConnected: boolean;
  /** Last connection error message, if any. */
  readonly error: string | null;
  /** Clear the events buffer (e.g. after the user dismisses all notices). */
  clear(): void;
}

const MAX_EVENTS = 50;

export function useProjectChanges(projectId: string | null): UseProjectChangesResult {
  const [events, setEvents] = useState<ChangeEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Keep latest events ref for use across renders without re-subscribing.
  const eventsRef = useRef<ChangeEvent[]>(events);
  eventsRef.current = events;

  const clear = useCallback(() => {
    setEvents([]);
  }, []);

  useEffect(() => {
    if (!projectId) {
      setIsConnected(false);
      return;
    }
    // Reset on projectId change so the consumer doesn't see stale
    // events from the previous project.
    setEvents([]);
    setError(null);

    const url = getChangesStreamUrl(projectId);
    const eventSource = new EventSource(url);

    eventSource.onmessage = (msg: MessageEvent<string>) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(msg.data);
      } catch {
        // malformed payload — log to console and ignore
        // eslint-disable-next-line no-console
        console.warn('[useProjectChanges] received non-JSON SSE data:', msg.data);
        return;
      }
      if (!isChangeEvent(parsed)) {
        return;
      }
      // `subscribed` is the connection-handshake welcome event.
      if (parsed.kind === 'subscribed') {
        setIsConnected(true);
        setError(null);
        return;
      }
      // `heartbeat` keeps proxies happy; doesn't represent a real change.
      if (parsed.kind === 'heartbeat') return;
      // Don't echo our own writes back as notices.
      if (parsed.source === 'gui') return;

      setEvents((prev) => {
        const next = [...prev, parsed];
        // Cap to MAX_EVENTS; oldest drops off the head.
        return next.length > MAX_EVENTS ? next.slice(next.length - MAX_EVENTS) : next;
      });
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      setError('SSE connection error; browser will retry automatically.');
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [projectId]);

  return { events, isConnected, error, clear };
}

/**
 * Runtime shape check on parsed SSE data. Defensive against a server
 * (or a proxy) sending an unexpected payload — accepts only events
 * with the documented `kind` enum + required string fields. Unknown
 * kinds are rejected outright rather than rendered as default "Agent
 * edited" banners with empty paths.
 */
const VALID_KINDS = new Set<ChangeEvent['kind']>([
  'created', 'updated', 'deleted', 'subscribed', 'heartbeat',
]);

function isChangeEvent(value: unknown): value is ChangeEvent {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v.kind !== 'string' || !VALID_KINDS.has(v.kind as ChangeEvent['kind'])) {
    return false;
  }
  // subscribed/heartbeat are connection-control events: only `kind` is required.
  if (v.kind === 'subscribed' || v.kind === 'heartbeat') return true;
  // Real ChangeEvents must carry path + source + at.
  return (
    typeof v.path === 'string' &&
    typeof v.at === 'string' &&
    (v.source === 'agent' || v.source === 'gui' || v.source === 'system')
  );
}
