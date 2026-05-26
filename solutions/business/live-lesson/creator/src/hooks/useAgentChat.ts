/**
 * useAgentChat — drives the AiPanel chat experience.
 *
 * Responsibilities:
 *   - load message history from `GET /api/v1/sessions/:sid/messages` on
 *     session change
 *   - `send(text)` POSTs to `/api/v1/sessions/:sid/messages` and streams
 *     the SSE response into the local messages array
 *   - after first turn completes, fire-and-forget bind-project so the
 *     project's change stream picks up agent-side edits (existing
 *     `useProjectChanges` hook in the editor surfaces those)
 *
 * SSE parsing: uses native `fetch` + `ReadableStream` (works in modern
 * Chrome/Firefox/Edge; Safari 17+). Old browsers fall through to an
 * error state — see "Risk #1" in the plan file.
 *
 * The hook is **session-scoped**: switching to a different `sessionId`
 * resets messages and triggers a fresh history fetch. Concurrent sends
 * on the same session are not supported — the second `send()` no-ops
 * while `isThinking` is true.
 */

import { useCallback, useEffect, useState } from 'react';
import { ccaasBaseUrl, getApiKey } from '../api/ccaas';

// ── Types ────────────────────────────────────────────────────────────

export interface ToolEvent {
  toolName: string;
  toolId: string;
  phase: 'start' | 'end' | string;
  /** Free-form description for UI ("Editing execution/manifest.json", etc.) */
  summary?: string;
  /** Tool call input (e.g. `{ command: "bash ..." }` for Bash tool). Used by
   *  ChatBubble to detect special tool calls like validation. */
  toolInput?: unknown;
  /** Tool call output (e.g. command stdout). Used by ChatBubble to render
   *  structured results (validation JSON, etc.) as dedicated cards. */
  toolOutput?: unknown;
  /** Phase=end only: whether the tool returned a non-error result. */
  success?: boolean;
  at: string;
}

export type ChatMessage =
  | { id: string; role: 'user'; text: string; at: string }
  | { id: string; role: 'agent'; text: string; at: string; toolEvents: ToolEvent[] };

interface UseAgentChatOpts {
  sessionId: string;
  /** ccaas tenantId (from `useTenantId`). Required to send. */
  tenantId: string | null;
  /** Project to bind on first turn — enables agent-edit notifications. */
  projectId: string;
  /** Skill slugs to enable for this session. Defaults to ['manifest-editor']. */
  enabledSkills?: string[];
  /** Session template name (used on the first message). */
  templateName?: string;
}

interface UseAgentChatState {
  messages: ChatMessage[];
  isThinking: boolean;
  error: string | null;
  /** Whether the history fetch is still in flight (first mount only). */
  isLoadingHistory: boolean;
  /** Send a user message. No-ops if already streaming or sessionId is empty. */
  send(text: string): Promise<void>;
}

// ── Inline SSE envelope shape (subset we actually consume) ───────────
// Mirrors `packages/backend/src/sessions/services/stream-registry.service.ts`
// We keep the local definition narrow so the chat hook doesn't drag in
// the whole backend protocol module — only the fields we render.

interface SseEnvelope {
  seq: number;
  sessionId: string;
  timestamp: string;
  event: SseEvent;
}

type SseEvent =
  | { type: 'text_delta'; delta: string; sessionId: string; timestamp: string }
  | {
      type: 'agent_status';
      status: 'idle' | 'thinking' | 'exploring' | 'executing' | 'complete' | 'error';
      sessionId: string;
      timestamp: string;
      error?: string;
    }
  | {
      type: 'tool_activity';
      payload: {
        toolName: string;
        toolId: string;
        phase: 'start' | 'end' | string;
        // assorted other fields we don't use here
        [k: string]: unknown;
      };
      sessionId: string;
      timestamp: string;
    }
  | {
      type: 'error';
      code?: string;
      message: string;
      recoverable?: boolean;
      sessionId: string;
      timestamp: string;
    }
  | { type: 'done'; sessionId: string; timestamp: string }
  | { type: string; [k: string]: unknown }; // catch-all for events we ignore

// ── Helpers ──────────────────────────────────────────────────────────

function uid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface HistoryMessage {
  id: string;
  role: 'user' | 'assistant' | string;
  content: string;
  createdAt: string;
  toolEvents?: Array<{ toolName: string; toolId: string; phase?: string; createdAt?: string }>;
}

function toChatMessage(m: HistoryMessage): ChatMessage | null {
  if (m.role === 'user') {
    return { id: m.id, role: 'user', text: m.content, at: m.createdAt };
  }
  if (m.role === 'assistant') {
    const toolEvents: ToolEvent[] = (m.toolEvents ?? []).map((t) => ({
      toolName: t.toolName,
      toolId: t.toolId,
      phase: (t.phase ?? 'end') as ToolEvent['phase'],
      at: t.createdAt ?? m.createdAt,
    }));
    return { id: m.id, role: 'agent', text: m.content, at: m.createdAt, toolEvents };
  }
  // skip system messages, etc.
  return null;
}

// ── Hook ─────────────────────────────────────────────────────────────

export function useAgentChat(opts: UseAgentChatOpts): UseAgentChatState {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  // (G4 fix: previously held a `hasBoundRef` to skip duplicate
  // frontend-side bind-project calls. Bind is now backend-side in
  // MessageWorker, which itself dedupes via getBoundProjectId; no
  // frontend tracking needed.)

  const { sessionId, tenantId, projectId, enabledSkills, templateName } = opts;

  // ── History load on session change ────────────────────────────────
  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      setIsLoadingHistory(false);
      return;
    }
    let alive = true;
    setIsLoadingHistory(true);
    setMessages([]);
    setError(null);

    const key = getApiKey();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (key) headers['Authorization'] = `Bearer ${key}`;

    fetch(`${ccaasBaseUrl()}/api/v1/sessions/${encodeURIComponent(sessionId)}/messages?limit=200`, {
      headers,
    })
      .then(async (res) => {
        if (!res.ok) {
          // 404 = session never existed (fresh conversation) — treat as
          // empty history, not an error.
          if (res.status === 404) return { messages: [] as HistoryMessage[] };
          throw new Error(`history fetch ${res.status}`);
        }
        return res.json() as Promise<{ messages: HistoryMessage[] }>;
      })
      .then((body) => {
        if (!alive) return;
        const next = body.messages.map(toChatMessage).filter((m): m is ChatMessage => m !== null);
        setMessages(next);
        setIsLoadingHistory(false);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : String(err));
        setIsLoadingHistory(false);
      });

    return () => {
      alive = false;
    };
  }, [sessionId]);

  // ── Send + stream ─────────────────────────────────────────────────
  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (!sessionId) {
        setError('No active conversation');
        return;
      }
      if (!tenantId) {
        setError('Missing tenantId — set ccaas:apiKey in localStorage and refresh');
        return;
      }
      if (isThinking) return; // single-flight per session

      const userMsg: ChatMessage = {
        id: uid(),
        role: 'user',
        text: trimmed,
        at: new Date().toISOString(),
      };
      const agentBubbleId = uid();
      const agentMsg: ChatMessage = {
        id: agentBubbleId,
        role: 'agent',
        text: '',
        at: new Date().toISOString(),
        toolEvents: [],
      };

      setMessages((prev) => [...prev, userMsg, agentMsg]);
      setIsThinking(true);
      setError(null);

      const key = getApiKey();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (key) headers['Authorization'] = `Bearer ${key}`;

      let networkError: Error | null = null;
      try {
        const res = await fetch(
          `${ccaasBaseUrl()}/api/v1/sessions/${encodeURIComponent(sessionId)}/messages`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({
              message: trimmed,
              tenantId,
              // Every send carries projectId. The ccaas backend's
              // MessageWorker bind-and-bootstraps BEFORE spawning the
              // engine when present, so the agent's first turn sees a
              // populated artifacts/ directory instead of an empty
              // workspace. Subsequent sends are idempotent (worker
              // checks `getBoundProjectId` and skips if unchanged).
              projectId,
              enabledSkills: enabledSkills ?? ['manifest-editor'],
              templateName: templateName ?? 'edit-lesson',
            }),
          },
        );

        if (!res.ok || !res.body) {
          throw new Error(`POST messages failed: ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        let aborted = false;

        // SSE frames are blank-line-separated; within a frame we only
        // care about `data: <json>` lines.
        while (!aborted) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });

          let frameEnd = buf.indexOf('\n\n');
          while (frameEnd !== -1) {
            const frame = buf.slice(0, frameEnd);
            buf = buf.slice(frameEnd + 2);
            const dataLine = frame.split('\n').find((l) => l.startsWith('data:'));
            if (dataLine) {
              const json = dataLine.slice(5).trim();
              if (json) {
                try {
                  const env = JSON.parse(json) as SseEnvelope;
                  applyEvent(env, agentBubbleId);
                  if (env.event.type === 'done') {
                    aborted = true;
                    break;
                  }
                  if (env.event.type === 'agent_status') {
                    const status = (env.event as { status: string }).status;
                    if (status === 'complete' || status === 'error') {
                      // Don't break here — `done` still fires after.
                    }
                  }
                } catch {
                  // Bad frame — skip silently. Logging would spam.
                }
              }
            }
            frameEnd = buf.indexOf('\n\n');
          }
        }
      } catch (err) {
        networkError = err instanceof Error ? err : new Error(String(err));
        setError(networkError.message);
      } finally {
        setIsThinking(false);
      }

      // Bind happens BACKEND-side now: the ccaas MessageWorker awaits
      // bindToProject + SessionAssetSyncer.sync BEFORE spawning the
      // engine when the message payload carries `projectId`. The body
      // above includes it on every send. So nothing more to do here —
      // bind is deterministic + complete by the time the first SSE
      // event arrives. (G4 fix; before this commit there was a
      // fire-and-forget bindSessionToProject call here that raced the
      // engine spawn and left the first turn looking at an empty
      // workspace.)
    },
    [sessionId, tenantId, projectId, enabledSkills, templateName, isThinking],
  );

  // Apply one SSE event to the in-flight agent bubble. Pulled out of
  // `send()` so the inner loop stays readable.
  function applyEvent(env: SseEnvelope, agentBubbleId: string): void {
    const e = env.event;
    switch (e.type) {
      case 'text_delta': {
        const delta = (e as { delta: string }).delta;
        if (!delta) return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === agentBubbleId && m.role === 'agent'
              ? { ...m, text: m.text + delta }
              : m,
          ),
        );
        return;
      }
      case 'tool_activity': {
        const p = (e as {
          payload: {
            toolName: string;
            toolId: string;
            phase: string;
            toolInput?: unknown;
            toolOutput?: unknown;
            success?: boolean;
          };
        }).payload;
        if (!p) return;
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== agentBubbleId || m.role !== 'agent') return m;
            // For Bash tools we get one `start` event (with input) and
            // later one `end` event (with output). Coalesce by toolId
            // so each tool call shows up as ONE row that grows from
            // "调用..." to "完成 + result". Without this the UI would
            // double-list bash calls.
            const idx = m.toolEvents.findIndex((t) => t.toolId === p.toolId);
            const next: ToolEvent = {
              toolName: p.toolName,
              toolId: p.toolId,
              phase: p.phase,
              toolInput: p.toolInput ?? (idx >= 0 ? m.toolEvents[idx].toolInput : undefined),
              toolOutput: p.toolOutput ?? (idx >= 0 ? m.toolEvents[idx].toolOutput : undefined),
              success: p.success ?? (idx >= 0 ? m.toolEvents[idx].success : undefined),
              at: env.timestamp,
            };
            const merged = idx >= 0
              ? [...m.toolEvents.slice(0, idx), next, ...m.toolEvents.slice(idx + 1)]
              : [...m.toolEvents, next];
            return { ...m, toolEvents: merged };
          }),
        );
        return;
      }
      case 'error': {
        const msg = (e as { message: string }).message;
        setError(msg || 'Agent error');
        return;
      }
      case 'agent_status': {
        const status = (e as { status: string }).status;
        if (status === 'error') {
          const errMsg = (e as { error?: string }).error;
          if (errMsg) setError(errMsg);
        }
        return;
      }
      // 'done', 'agent_thinking', 'output_update', 'token_usage', etc. — ignored for MVP.
      default:
        return;
    }
  }

  return { messages, isThinking, error, isLoadingHistory, send };
}
