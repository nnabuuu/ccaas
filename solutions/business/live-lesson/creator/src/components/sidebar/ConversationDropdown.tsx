/**
 * ConversationDropdown — header for the AiPanel showing the active
 * conversation name + a dropdown of all per-project conversations,
 * plus a "+" new-conversation button.
 *
 * Visual spec mirrors `design/surfaces/creator-v7-ai-left.jsx:113-134`.
 */

import { useEffect, useRef, useState } from 'react';
import type { Conversation } from '../../hooks/useConversations';

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSwitch: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}

export default function ConversationDropdown({
  conversations,
  activeId,
  onSwitch,
  onCreate,
  onDelete,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Click-outside to close.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (ev: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(ev.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '10px 14px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
        }}
      >
        <span style={{ color: 'var(--purple)', fontSize: 12 }}>✦</span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--t1)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {active?.title ?? '无会话'}
        </span>
        <span
          style={{
            fontSize: 10,
            color: 'var(--t3)',
            transition: 'transform .15s',
            transform: open ? 'rotate(180deg)' : 'rotate(0)',
          }}
        >
          ↾
        </span>
      </button>

      <button
        onClick={() => {
          onCreate();
          setOpen(false);
        }}
        title="新会话"
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          color: 'var(--t2)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'inherit',
          fontSize: 13,
        }}
      >
        +
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 14,
            right: 38,
            zIndex: 20,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,.08)',
            maxHeight: 240,
            overflowY: 'auto',
          }}
        >
          {conversations.length === 0 && (
            <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--t3)' }}>无会话</div>
          )}
          {conversations.map((c) => {
            const isActive = c.id === activeId;
            return (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  background: isActive ? 'var(--purple-bg)' : 'transparent',
                  cursor: 'pointer',
                  fontSize: 11,
                  color: 'var(--t1)',
                }}
                onClick={() => {
                  onSwitch(c.id);
                  setOpen(false);
                }}
              >
                <span style={{ color: isActive ? 'var(--purple)' : 'transparent', fontSize: 10 }}>•</span>
                <span
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {c.title}
                </span>
                <button
                  onClick={(ev) => {
                    ev.stopPropagation();
                    if (window.confirm(`删除会话 "${c.title}"？`)) {
                      onDelete(c.id);
                    }
                  }}
                  title="删除"
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--t3)',
                    cursor: 'pointer',
                    fontSize: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
