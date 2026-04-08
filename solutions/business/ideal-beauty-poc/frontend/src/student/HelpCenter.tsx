import React, { useState, useEffect, useRef } from 'react';
import { SCENES } from '../data/content';
import { STARTERS, DUMMY } from '../data/help';
import { sendHelpMessage } from '../api/client';
import { FS } from '../ui/tokens';

interface ChatMsg {
  type: 'msg' | 'divider';
  role?: 'user' | 'assistant';
  content?: string;
  label?: string;
  trusted?: boolean; // true for DUMMY replies (static HTML)
}

/** Strip all HTML tags except safe inline formatting */
function sanitizeHtml(html: string): string {
  return html.replace(/<\/?(?!b|strong|em|i|br\s*\/?)[\w-]+[^>]*>/gi, '');
}

interface HelpCenterProps {
  sceneId: string;
  studentSessionId: string;
  mode: 'inline' | 'floating';
}

export default function HelpCenter({ sceneId, studentSessionId, mode }: HelpCenterProps) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastScene, setLastScene] = useState(sceneId);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs.length]);

  const addDivider = (id: string) => {
    const sc = SCENES.find((s) => s.id === id);
    setMsgs((prev) => [
      ...prev,
      { type: 'divider', label: `${sc?.id} ${sc?.label}` },
    ]);
    setLastScene(id);
  };

  const send = (text: string) => {
    if (!text.trim() || loading) return;
    if (sceneId !== lastScene) addDivider(sceneId);

    const userMsg: ChatMsg = {
      type: 'msg',
      role: 'user',
      content: text.trim(),
    };
    setMsgs((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Try dummy match first for instant reply
    const reply = DUMMY[text.trim()];
    if (reply) {
      setTimeout(() => {
        setMsgs((prev) => [
          ...prev,
          { type: 'msg', role: 'assistant', content: reply, trusted: true },
        ]);
        setLoading(false);
      }, 400);
      return;
    }

    // Fallback to API
    sendHelpMessage(studentSessionId, text.trim(), sceneId)
      .then((r) => {
        setMsgs((prev) => [
          ...prev,
          {
            type: 'msg',
            role: 'assistant',
            content: r.assistantMessage?.content || 'Sorry, please try again.',
          },
        ]);
      })
      .catch(() => {
        setMsgs((prev) => [
          ...prev,
          { type: 'msg', role: 'assistant', content: 'Sorry, please try again.' },
        ]);
      })
      .finally(() => setLoading(false));
  };

  const starters = STARTERS[sceneId] || [];

  /* ─── Starter pills ─── */
  const starterPills = (
    <div
      style={{
        display: 'flex',
        gap: 4,
        overflowX: 'auto',
        flexShrink: 0,
        flexWrap: 'wrap',
      }}
    >
      {starters.map((q) => (
        <button
          key={q}
          onClick={() => send(q)}
          style={{
            padding: '5px 10px',
            borderRadius: 12,
            border: mode === 'inline' ? '1px solid rgba(255,255,255,.1)' : '1px solid #ebe8e2',
            background: mode === 'inline' ? 'rgba(255,255,255,.04)' : '#fff',
            fontSize: FS.xs,
            color: mode === 'inline' ? '#c4c2bc' : '#3d3b36',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {q}
        </button>
      ))}
    </div>
  );

  /* ─── Messages list (shared between modes) ─── */
  const messagesContent = (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', minHeight: 0 }}>
      {msgs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '20px 8px' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: mode === 'inline' ? 'rgba(167,139,250,.12)' : '#EEEDFE',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: FS.base,
              color: mode === 'inline' ? '#a78bfa' : '#534AB7',
              fontWeight: 500,
              marginBottom: 8,
            }}
          >
            AI
          </div>
          <p
            style={{
              fontSize: FS.base,
              color: mode === 'inline' ? '#8a8780' : '#9e9c96',
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            <strong style={{ color: mode === 'inline' ? '#e8e5de' : '#1a1a18' }}>
              Hi! I&apos;m your AI tutor.
            </strong>
            <br />
            Ask me anything about this lesson.
          </p>
          {/* Starter pills directly under welcome when empty */}
          <div style={{ marginTop: 12 }}>{starterPills}</div>
        </div>
      )}

      {msgs.map((m, i) => {
        if (m.type === 'divider') {
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                margin: '12px 0 8px',
              }}
            >
              <div style={{ flex: 1, height: 1, background: mode === 'inline' ? 'rgba(255,255,255,.08)' : '#ebe8e2' }} />
              <span
                style={{
                  fontSize: FS.xs,
                  fontWeight: 500,
                  color: mode === 'inline' ? '#5c5a56' : '#9e9c96',
                  padding: '2px 8px',
                  background: mode === 'inline' ? 'rgba(255,255,255,.04)' : '#f5f3ee',
                  borderRadius: 4,
                  whiteSpace: 'nowrap',
                }}
              >
                {m.label}
              </span>
              <div style={{ flex: 1, height: 1, background: mode === 'inline' ? 'rgba(255,255,255,.08)' : '#ebe8e2' }} />
            </div>
          );
        }

        return (
          <div
            key={i}
            style={{
              marginBottom: 8,
              display: 'flex',
              flexDirection: 'column',
              alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '85%',
                padding: '9px 13px',
                borderRadius: 14,
                fontSize: FS.base,
                lineHeight: 1.7,
                background: m.role === 'user'
                  ? '#EEEDFE'
                  : (mode === 'inline' ? 'rgba(255,255,255,.06)' : '#f5f3ee'),
                color: m.role === 'user'
                  ? '#26215C'
                  : (mode === 'inline' ? '#e8e5de' : '#1a1a18'),
                borderBottomRightRadius: m.role === 'user' ? 4 : 14,
                borderBottomLeftRadius: m.role === 'user' ? 14 : 4,
              }}
            >
              {m.trusted
                ? <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(m.content || '') }} />
                : (m.content || '')}
            </div>
          </div>
        );
      })}

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: '70%' }}>
          <div className={mode === 'inline' ? 'skeleton-dark' : 'skeleton'} style={{ height: 12, width: '90%' }} />
          <div className={mode === 'inline' ? 'skeleton-dark' : 'skeleton'} style={{ height: 12, width: '60%' }} />
        </div>
      )}
      <div ref={endRef} />
    </div>
  );

  /* ─── Input bar (shared between modes) ─── */
  const inputBar = (
    <div
      style={{
        padding: '8px 12px',
        borderTop: mode === 'inline' ? '1px solid rgba(255,255,255,.08)' : '1px solid #ebe8e2',
        display: 'flex',
        gap: 6,
        flexShrink: 0,
      }}
    >
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && send(input)}
        placeholder="Type your question..."
        aria-label="Type your question"
        style={{
          flex: 1,
          padding: '8px 12px',
          borderRadius: 10,
          border: mode === 'inline' ? '1px solid rgba(255,255,255,.1)' : '1px solid #ebe8e2',
          background: mode === 'inline' ? 'rgba(255,255,255,.04)' : '#fff',
          fontSize: FS.base,
          color: mode === 'inline' ? '#e8e5de' : '#1a1a18',
        }}
      />
      <button
        onClick={() => send(input)}
        disabled={loading || !input.trim()}
        style={{
          padding: '8px 14px',
          borderRadius: 10,
          border: 'none',
          background: loading ? (mode === 'inline' ? '#333' : '#e8e5de') : '#7c3aed',
          color: '#fff',
          fontSize: FS.base,
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        Send
      </button>
    </div>
  );

  /* ═══════════════════════════════════════════
     INLINE MODE (Task view)
     ═══════════════════════════════════════════ */

  if (mode === 'inline') {
    /* Collapsed state */
    if (!open) {
      return (
        <button
          onClick={() => setOpen(true)}
          style={{
            padding: '10px 16px',
            borderTop: '1px solid rgba(255,255,255,.08)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'transparent',
            border: 'none',
            borderTopStyle: 'solid',
            borderTopWidth: 1,
            borderTopColor: 'rgba(255,255,255,.08)',
            cursor: 'pointer',
            width: '100%',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: FS.sm, fontWeight: 600, color: '#a78bfa' }}>
            Ask AI 问一问
          </span>
          <span style={{ fontSize: FS.xs, color: '#5c5a56' }}>▸</span>
        </button>
      );
    }

    /* Expanded state */
    return (
      <div
        className="help-panel-inline"
        role="dialog"
        aria-label="Help center"
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
      >
        {/* Header */}
        <div
          style={{
            padding: '8px 16px',
            borderBottom: '1px solid rgba(255,255,255,.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: FS.sm, fontWeight: 600, color: '#a78bfa' }}>
            Ask AI 问一问
          </span>
          <button
            onClick={() => setOpen(false)}
            aria-label="Collapse help center"
            style={{
              width: 22,
              height: 22,
              borderRadius: 4,
              border: '1px solid rgba(255,255,255,.1)',
              background: 'transparent',
              color: '#5c5a56',
              fontSize: FS.xs,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            ▾
          </button>
        </div>

        {/* Messages */}
        {messagesContent}

        {/* Starter pills above input (when there are messages) */}
        {msgs.length > 0 && starters.length > 0 && (
          <div style={{ padding: '4px 12px 2px', flexShrink: 0 }}>
            {starterPills}
          </div>
        )}

        {/* Input */}
        {inputBar}
      </div>
    );
  }

  /* ═══════════════════════════════════════════
     FLOATING MODE (Lecture view)
     ═══════════════════════════════════════════ */

  /* Closed state: capsule FAB */
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Open help center"
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          height: 48,
          borderRadius: 24,
          padding: '0 18px 0 14px',
          background: '#7c3aed',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          zIndex: 100,
          transition: 'transform .15s',
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLElement).style.transform = 'scale(1.04)')
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLElement).style.transform = 'scale(1)')
        }
      >
        <svg
          width="20"
          height="20"
          fill="none"
          stroke="#fff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          viewBox="0 0 24 24"
        >
          <path d="M18 9V3a1 1 0 0 0-2 0v6" />
          <path d="M14 4a1 1 0 0 0-2 0v7" />
          <path d="M10 4.5a1 1 0 0 0-2 0V12" />
          <path d="M7 9a1 1 0 0 0-2 0v5a8 8 0 0 0 16 0v-3a1 1 0 0 0-2 0" />
        </svg>
        <span style={{ color: '#fff', fontSize: FS.base, fontWeight: 500 }}>Ask AI</span>
      </button>
    );
  }

  /* Open state: floating chat panel */
  return (
    <div
      role="dialog"
      aria-label="Help center"
      className="help-panel"
      onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
      style={{
        borderRadius: 16,
        background: '#fff',
        border: '1px solid #ebe8e2',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #ebe8e2',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: FS.base, fontWeight: 500, color: '#1a1a18' }}>
          Ask a question
        </span>
        <button
          onClick={() => setOpen(false)}
          aria-label="Close help center"
          style={{
            width: 26,
            height: 26,
            borderRadius: 6,
            border: '1px solid #ebe8e2',
            background: '#fff',
            color: '#9e9c96',
            fontSize: FS.base,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          &times;
        </button>
      </div>

      {/* Messages */}
      {messagesContent}

      {/* Starter pills above input (when there are messages) */}
      {msgs.length > 0 && starters.length > 0 && (
        <div style={{ padding: '4px 12px 6px', borderTop: '1px solid #ebe8e2', flexShrink: 0 }}>
          {starterPills}
        </div>
      )}

      {/* Input */}
      {inputBar}
    </div>
  );
}
