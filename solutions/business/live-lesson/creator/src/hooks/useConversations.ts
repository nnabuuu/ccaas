/**
 * useConversations — per-project chat-session list, persisted in
 * localStorage. Each conversation has a stable `sessionId` so the
 * `useAgentChat` hook can fetch its history.
 *
 * Why localStorage instead of a backend list endpoint: MVP scope.
 * Sessions survive on the server (session_metadata rows persist past
 * session cleanup), so a future `GET /sessions?projectId=X` endpoint
 * can replace this hook without rewriting the AiPanel.
 *
 * Multi-tab sync: not implemented. Two tabs editing the same project
 * see independent lists. The next iteration should listen to the
 * `storage` event to mirror creates/deletes across tabs.
 */

import { useCallback, useEffect, useState } from 'react';

export interface Conversation {
  id: string; // logical id (used for switching); === sessionId for now
  sessionId: string;
  title: string;
  createdAt: string;
  lastMessageAt: string;
}

export interface ConversationsState {
  conversations: Conversation[];
  activeId: string | null;
  active: Conversation | null;
  create(): Conversation;
  switchTo(id: string): void;
  remove(id: string): void;
  rename(id: string, title: string): void;
}

const LIST_KEY_PREFIX = 'creator:conversations:';
const ACTIVE_KEY_PREFIX = 'creator:conversations:active:';

function uid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function readList(projectId: string): Conversation[] {
  try {
    const raw = localStorage.getItem(LIST_KEY_PREFIX + projectId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Conversation[]) : [];
  } catch {
    return [];
  }
}

function writeList(projectId: string, list: Conversation[]): void {
  try {
    localStorage.setItem(LIST_KEY_PREFIX + projectId, JSON.stringify(list));
  } catch {
    // ignore quota errors — chat continues to work in-memory
  }
}

function readActive(projectId: string): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY_PREFIX + projectId);
  } catch {
    return null;
  }
}

function writeActive(projectId: string, id: string | null): void {
  try {
    if (id === null) localStorage.removeItem(ACTIVE_KEY_PREFIX + projectId);
    else localStorage.setItem(ACTIVE_KEY_PREFIX + projectId, id);
  } catch {
    /* ignore */
  }
}

function newConversation(): Conversation {
  const id = uid();
  const now = new Date().toISOString();
  return {
    id,
    sessionId: id, // 1:1 mapping for MVP
    title: '新会话',
    createdAt: now,
    lastMessageAt: now,
  };
}

export function useConversations(projectId: string): ConversationsState {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Hydrate from localStorage when projectId changes, auto-creating
  // the first conversation if none exist. We use a single effect
  // (not a `useState` initializer) so the effect re-runs when the
  // user navigates between projects.
  useEffect(() => {
    if (!projectId) return;
    let list = readList(projectId);
    let active = readActive(projectId);

    if (list.length === 0) {
      const fresh = newConversation();
      list = [fresh];
      active = fresh.id;
      writeList(projectId, list);
      writeActive(projectId, active);
    } else if (!active || !list.find((c) => c.id === active)) {
      active = list[0].id;
      writeActive(projectId, active);
    }

    setConversations(list);
    setActiveId(active);
  }, [projectId]);

  const create = useCallback((): Conversation => {
    const fresh = newConversation();
    setConversations((prev) => {
      const next = [fresh, ...prev]; // newest first — matches typical UX
      writeList(projectId, next);
      return next;
    });
    setActiveId(fresh.id);
    writeActive(projectId, fresh.id);
    return fresh;
  }, [projectId]);

  const switchTo = useCallback(
    (id: string) => {
      setActiveId(id);
      writeActive(projectId, id);
    },
    [projectId],
  );

  const remove = useCallback(
    (id: string) => {
      setConversations((prev) => {
        const next = prev.filter((c) => c.id !== id);
        // If we removed the active one, switch to the first remaining
        // OR auto-create a fresh empty conversation (always > 0).
        let nextActive = activeId;
        if (id === activeId) {
          if (next.length > 0) {
            nextActive = next[0].id;
          } else {
            const fresh = newConversation();
            next.push(fresh);
            nextActive = fresh.id;
          }
          setActiveId(nextActive);
          writeActive(projectId, nextActive);
        }
        writeList(projectId, next);
        return next;
      });
    },
    [projectId, activeId],
  );

  const rename = useCallback(
    (id: string, title: string) => {
      setConversations((prev) => {
        const next = prev.map((c) => (c.id === id ? { ...c, title } : c));
        writeList(projectId, next);
        return next;
      });
    },
    [projectId],
  );

  const active = conversations.find((c) => c.id === activeId) ?? null;

  return {
    conversations,
    activeId,
    active,
    create,
    switchTo,
    remove,
    rename,
  };
}
