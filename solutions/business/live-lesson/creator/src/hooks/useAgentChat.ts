/**
 * useAgentChat — drives the AiPanel chat experience.
 *
 * Responsibilities:
 *   - load message history from `GET /api/v1/sessions/:sid/messages` on
 *     session change
 *   - `send(text)` POSTs to `/api/v1/sessions/:sid/messages` and streams
 *     the SSE response into the local messages array
 *   - on first turn, the live-lesson backend's chat proxy
 *     attaches the workspace source server-side so the project's
 *     change stream picks up agent-side edits (existing
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
import {
  CARD_TOOL_NAMES,
  tryParseCardPayload,
  type CardPayload,
} from '../types/chat-cards';

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
  | { id: string; role: 'agent'; text: string; at: string; toolEvents: ToolEvent[] }
  | { id: string; role: 'agent'; type: 'card'; card: CardPayload; at: string };

export { CARD_TOOL_NAMES, tryParseCardPayload } from '../types/chat-cards';
export type { CardPayload, TodoData, QuestionsData, VerifyData } from '../types/chat-cards';

interface UseAgentChatOpts {
  sessionId: string;
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
      // ccaas-core EventMapper emits this when a tool's result matches
      // a registered toolEventTriggers entry. With `field: 'card'`
      // configured (see solution.json), the parsed tool result is
      // wrapped as `payload.data = { field: 'card', value: <parsed> }`.
      // We only consume `field === 'card'` here; other fields (e.g.
      // 'parsedQuiz' from quiz-analyzer) are ignored.
      type: 'output_update';
      payload: {
        // Narrow to the only shape we consume. ccaas-core may emit
        // other shapes (e.g. quiz-analyzer's `{ field: 'parsedQuiz',
        // value: ... }`); we handle them in the catch-all
        // (default-no-op) branch.
        data?: { field?: string; value?: unknown };
        status?: string;
        progress?: number;
        timestamp?: string;
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
  toolEvents?: Array<{
    toolName: string;
    toolId: string;
    phase?: string;
    createdAt?: string;
    /** Tool call input (e.g. Bash command). Forwarded into the
     *  reconstructed ToolEvent so reload-mode renderers (esp. the
     *  Bash ValidationCard special-case in ChatBubble) match live
     *  behavior. */
    toolInput?: unknown;
    /** Persisted tool result. For emit_*_card tools this is the
     *  JSON-stringified (or already-parsed) card payload — used to
     *  reconstruct card-type chat messages on history reload. */
    toolOutput?: unknown;
    /** Phase=end only: backend-recorded success bit. */
    success?: boolean;
  }>;
}

/**
 * Expand one HistoryMessage into 1+ ChatMessages, hoisting any
 * emit_*_card toolOutput into separate card-type messages.
 *
 * Why hoist: cards have their own dedicated React renderer; leaving
 * them as a generic toolEvent under the parent agent message would
 * (a) double-render (once as the card, once as the "调用 emit_X_card"
 * label) and (b) misplace them visually (cards belong inline in the
 * message timeline, not buried in the agent bubble's toolEvent grid).
 *
 * Order: card messages come BEFORE the parent agent message — typical
 * conversation flow is "agent emits structured progress → optionally
 * adds wrap-up text". Interleaving by timestamp would be more
 * precise but the backend doesn't currently order toolEvents w.r.t.
 * text deltas at sub-message granularity, so any ordering is an
 * approximation.
 *
 * Exported for direct testing — pure function, no React.
 */
export function expandHistoryMessage(m: HistoryMessage): ChatMessage[] {
  if (m.role === 'user') {
    return [{ id: m.id, role: 'user', text: m.content, at: m.createdAt }];
  }
  if (m.role !== 'assistant') {
    return []; // skip system / unknown roles
  }

  const cards: ChatMessage[] = [];
  const remainingToolEvents: ToolEvent[] = [];

  for (const t of m.toolEvents ?? []) {
    // emit_*_card events are hoisted to their own card messages
    // (when toolOutput parses to a valid card). Other tool events
    // stay attached to the parent agent message as before.
    if (CARD_TOOL_NAMES.has(t.toolName)) {
      const card = tryParseCardPayload(t.toolOutput);
      if (card) {
        cards.push({
          id: t.toolId, // stable across reloads (backend-assigned)
          role: 'agent',
          type: 'card',
          card,
          at: t.createdAt ?? m.createdAt,
        });
        continue; // skip — don't double-render as a generic toolEvent
      }
      // toolOutput missing / corrupt → fall through + render the
      // generic "调用 emit_X_card" label so the user at least sees
      // something happened.
    }
    remainingToolEvents.push({
      toolName: t.toolName,
      toolId: t.toolId,
      phase: (t.phase ?? 'end') as ToolEvent['phase'],
      toolInput: t.toolInput,
      toolOutput: t.toolOutput,
      success: t.success,
      at: t.createdAt ?? m.createdAt,
    });
  }

  const agentMessage: ChatMessage = {
    id: m.id,
    role: 'agent',
    text: m.content,
    at: m.createdAt,
    toolEvents: remainingToolEvents,
  };
  return [...cards, agentMessage];
}

// ── Hook ─────────────────────────────────────────────────────────────

export function useAgentChat(opts: UseAgentChatOpts): UseAgentChatState {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  // (G4 fix: workspace attach is backend-side in MessageWorker, which
  // dedupes via getAttachedWorkspaceSource; no frontend tracking needed.)

  const { sessionId, projectId, enabledSkills, templateName } = opts;

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

    // Same-origin via Vite proxy → live-lesson backend
    // (CcaasChatProxyController) which injects auth server-side. Browser
    // never holds the ccaas key.
    fetch(`/api/sessions/${encodeURIComponent(sessionId)}/messages?limit=200`, {
      headers: { 'Content-Type': 'application/json' },
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
        // expandHistoryMessage may return 0 (skipped), 1 (normal), or
        // N (agent with hoisted card-emit toolEvents) messages per
        // input. flatMap collapses to the final ordered ChatMessage[].
        const next = body.messages.flatMap(expandHistoryMessage);
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

      let networkError: Error | null = null;
      try {
        // Same-origin via Vite proxy → live-lesson backend's
        // CcaasChatProxyController. The proxy adds Authorization +
        // solutionId server-side; browser body carries only the user's
        // intent. projectId still flows through so the ccaas worker
        // can bind-before-spawn (G4 fix) before the first turn.
        const res = await fetch(
          `/api/sessions/${encodeURIComponent(sessionId)}/messages`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: trimmed,
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

      // No attach work here: ccaas's MessageWorker awaits
      // attachWorkspaceSource + bootstrap sync server-side before
      // spawning the engine, gated on payload.projectId — which the
      // body above includes on every send. Attach is deterministic and
      // complete by the time the first SSE event arrives.
    },
    [sessionId, projectId, enabledSkills, templateName, isThinking],
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
          prev.map((m) => {
            // Only append deltas to the live text agent bubble. Card
            // variants don't carry `text`; the discriminant `'text'
            // in m` proves we're on a text-bearing variant.
            if (m.id !== agentBubbleId || m.role !== 'agent' || !('text' in m)) return m;
            return { ...m, text: m.text + delta };
          }),
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
        // Skip emit_*_card tools — the card itself shows up via the
        // subsequent `output_update` event as a dedicated card
        // message. Showing a generic "调用 emit_X_card" label here
        // would be redundant clutter (and visually misleading since
        // the card is the answer, not the call).
        if (CARD_TOOL_NAMES.has(p.toolName)) return;
        setMessages((prev) =>
          prev.map((m) => {
            // Only attach to a text-bearing agent bubble (the one
            // created on send). Card-type messages have no
            // toolEvents slot.
            if (m.id !== agentBubbleId || m.role !== 'agent' || !('toolEvents' in m)) return m;
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
      case 'output_update': {
        // ccaas-core wraps the tool result as `{ field, value }` when
        // a toolEventTriggers entry has `field` configured. The
        // creator-mcp-server uses `field: 'card'` for all 3 emit
        // tools — that's the only shape we care about here. Other
        // solutions / triggers using different field names just no-op.
        const payload = (e as { payload?: { data?: { field?: string; value?: unknown } } }).payload;
        const data = payload?.data;
        if (!data || data.field !== 'card') return;
        const card = tryParseCardPayload(data.value);
        if (!card) return; // forward-compat: unknown kind silently ignored
        const cardId = uid();
        const at = env.timestamp;
        // Insert the card BEFORE the in-flight agent bubble (created
        // on send()) so the order matches what history reload
        // produces (`expandHistoryMessage` hoists cards before the
        // parent agent message). Without this, a refresh mid-turn
        // would visually re-sort the same conversation.
        setMessages((prev) => {
          const cardMsg: ChatMessage = {
            id: cardId,
            role: 'agent',
            type: 'card',
            card,
            at,
          };
          const idx = prev.findIndex((m) => m.id === agentBubbleId);
          if (idx < 0) return [...prev, cardMsg];
          return [...prev.slice(0, idx), cardMsg, ...prev.slice(idx)];
        });
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
      // 'done', 'agent_thinking', 'token_usage', etc. — ignored for MVP.
      default:
        return;
    }
  }

  return { messages, isThinking, error, isLoadingHistory, send };
}
