/**
 * AiPanel — left sidebar that drives an agent-runtime chat session
 * scoped to the current project.
 *
 * Visual contract: `design/surfaces/creator-v7-ai-left.jsx`
 * Behaviour contract: see comments + `kind-exploring-mango.md`.
 *
 * Three-section layout (header / scrolling messages / sticky input)
 * uses inline styles + CSS vars to stay 1:1 with the design jsx. The
 * surrounding ProjectEditorPage mounts this in a flex container at
 * left=340px width.
 */

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { Project } from '../../types';
import { useConversations } from '../../hooks/useConversations';
import { useAgentChat } from '../../hooks/useAgentChat';
import ChatBubble, { ThinkingDots } from './ChatBubble';
import ConversationDropdown from './ConversationDropdown';

interface AiPanelProps {
  project: Project;
  /**
   * Externally-driven message injection. When non-null, AiPanel
   * auto-sends the text into the current conversation, then calls
   * `onPendingConsumed` to clear it. Used by the audit report's
   * "让 AI 修复" buttons via ChatBridgeContext.
   */
  pendingMessage?: string | null;
  onPendingConsumed?: () => void;
}

export default function AiPanel({
  project,
  pendingMessage,
  onPendingConsumed,
}: AiPanelProps) {
  const conv = useConversations(project.id);

  // No solutionId / API-key state in the browser. live-lesson's
  // CcaasChatProxyController holds the env CCAAS_API_KEY and resolves
  // solutionId server-side; same-origin /api/sessions/... calls just work.
  const chat = useAgentChat({
    sessionId: conv.active?.sessionId ?? '',
    projectId: project.id,
  });

  // Auto-scroll messages container to bottom on new message or delta.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chat.messages]);

  // Auto-rename runs inside `submit()` below, NOT as an effect.
  // Effect-based rename had a stale-closure race: switching
  // conversations briefly captures the OLD conversation's messages
  // before the new history loads, which then renames the freshly
  // created "新会话" to the previous chat's text. Doing it in submit
  // means we only rename when WE just sent the message.

  // ── Input handling ────────────────────────────────────────────────
  const [draft, setDraft] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea, capped at 96px. Re-measure on every keystroke.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 96) + 'px';
  }, [draft]);

  const submit = () => {
    const text = draft.trim();
    if (!text || chat.isThinking) return;
    setDraft('');
    sendNow(text);
  };

  /**
   * Common send path used by both manual submit + externally-injected
   * pendingMessage (chat-bridge). Skips the draft state to avoid a
   * transient flash of the injected text.
   */
  const sendNow = (text: string) => {
    if (!text.trim() || chat.isThinking) return;
    // Rename "新会话" to the first user message we send into it. Same
    // logic as manual submit — the rename is "what did we just say"
    // not "what did the user type".
    if (conv.active && conv.active.title === '新会话') {
      const snippet = text.replace(/\s+/g, ' ').slice(0, 24);
      conv.rename(conv.active.id, snippet || '会话');
    }
    void chat.send(text);
  };

  // Chat-bridge injection. When the parent supplies a pendingMessage,
  // send it once + signal consumed. Guards on `chat.isThinking` so we
  // don't trample an in-flight response.
  //
  // Semantics: last-writer-wins. If a second pendingMessage arrives
  // while we're still busy (`isThinking === true`), React replaces the
  // prop value before the effect re-runs — the prior unsent message
  // is dropped. That matches user intent: clicking "让 AI 修复" twice
  // in quick succession should NOT queue both messages; the second
  // click supersedes the first. Worth this comment so a future "fix"
  // doesn't add queueing assuming it was an oversight.
  useEffect(() => {
    if (!pendingMessage) return;
    if (chat.isThinking) return;
    sendNow(pendingMessage);
    onPendingConsumed?.();
    // sendNow uses up-to-date conv/chat via closure each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMessage, chat.isThinking]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  // ── Render ───────────────────────────────────────────────────────
  const lastMsg = chat.messages[chat.messages.length - 1];
  const lastIsAgentBubble = lastMsg?.role === 'agent';

  return (
    <div
      style={{
        width: 340,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        borderRight: '1px solid var(--border)',
        background: 'var(--surface)',
        fontFamily: 'inherit',
      }}
    >
      <ConversationDropdown
        conversations={conv.conversations}
        activeId={conv.activeId}
        onSwitch={conv.switchTo}
        onCreate={conv.create}
        onDelete={conv.remove}
      />

      {/* Project banner (small subtitle so the user knows which project the chat scopes to) */}
      <div
        style={{
          padding: '6px 14px',
          background: 'var(--surface2)',
          borderBottom: '1px solid var(--border)',
          fontSize: 10,
          color: 'var(--t3)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <span>项目</span>
        <span style={{ color: 'var(--t2)' }}>·</span>
        <span style={{ color: 'var(--t2)', fontWeight: 500 }}>{project.title}</span>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {chat.messages.length === 0 && !chat.isLoadingHistory && <EmptyState />}
        {chat.isLoadingHistory && <LoadingHistory />}

        {chat.messages.map((m) =>
          m.role === 'user' ? (
            <ChatBubble key={m.id} role="user" text={m.text} />
          ) : (
            <ChatBubble
              key={m.id}
              role="agent"
              text={m.text}
              toolEvents={m.toolEvents}
              // Show thinking dots only on the in-flight agent bubble
              // (last message, while we're still streaming).
              showThinking={chat.isThinking && m.id === lastMsg?.id}
            />
          ),
        )}

        {/* If thinking but no agent bubble exists yet (shouldn't happen
            because send() inserts one synchronously — but defensive),
            render a standalone thinking pill. */}
        {chat.isThinking && !lastIsAgentBubble && (
          <div
            style={{
              alignSelf: 'flex-start',
              padding: '8px 12px',
              borderRadius: '12px 12px 12px 2px',
              background: 'var(--purple-bg)',
              color: 'var(--purple)',
              fontSize: 11,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <ThinkingDots />
            <span>思考中</span>
          </div>
        )}

        {chat.error && (
          <div
            style={{
              alignSelf: 'flex-start',
              maxWidth: '88%',
              padding: '8px 12px',
              borderRadius: 8,
              background: '#fef2f2',
              color: '#991b1b',
              fontSize: 11,
              border: '1px solid #fecaca',
            }}
          >
            {chat.error}
          </div>
        )}
      </div>

      {/* Input */}
      <div
        style={{
          padding: '10px 18px 14px',
          borderTop: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'flex-end',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '4px 4px 4px 14px',
          }}
        >
          <textarea
            ref={taRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="描述你想让 AI 帮你做什么…"
            rows={1}
            style={{
              flex: 1,
              padding: '7px 0',
              fontSize: 12,
              fontFamily: 'inherit',
              border: 'none',
              background: 'transparent',
              outline: 'none',
              color: 'var(--t1)',
              resize: 'none',
              lineHeight: 1.5,
              maxHeight: 96,
              overflowY: 'auto',
            }}
          />
          <button
            onClick={submit}
            disabled={!draft.trim() || chat.isThinking}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: 'none',
              flexShrink: 0,
              background:
                draft.trim() && !chat.isThinking ? 'var(--purple)' : 'var(--surface2)',
              color: draft.trim() && !chat.isThinking ? '#fff' : 'var(--t3)',
              cursor: draft.trim() && !chat.isThinking ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              transition: 'all .15s',
              fontFamily: 'inherit',
            }}
          >
            ↑
          </button>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 6,
            marginTop: 5,
            fontSize: 9,
            color: 'var(--t3)',
          }}
        >
          <span>Enter 发送</span>
          <span>·</span>
          <span>Shift+Enter 换行</span>
        </div>
      </div>
    </div>
  );
}

// ── Small empty/loading/error sub-components ─────────────────────────

function EmptyState() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 8px',
        color: 'var(--t3)',
        fontSize: 12,
        textAlign: 'center',
        gap: 8,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: 'var(--purple-bg)',
          color: 'var(--purple)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
        }}
      >
        ✦
      </div>
      <div style={{ fontWeight: 500, color: 'var(--t2)' }}>开始一段对话</div>
      <div style={{ fontSize: 10, lineHeight: 1.6 }}>
        告诉 AI 你想要的教学计划<br />
        或让它帮你修改现有的 manifest
      </div>
    </div>
  );
}

function LoadingHistory() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--t3)',
        fontSize: 11,
      }}
    >
      加载历史消息…
    </div>
  );
}
