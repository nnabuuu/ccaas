import React from 'react';
import {
  FULL_TEXT_PARAS,
  SENTS,
  TRANS,
  hlFor,
  catOf,
  CAT_C,
} from '../data/content';

interface RefPanelProps {
  sceneId: string;
  highlights: Record<string, string>;
  activeTool: string | null;
  onSentClick: (id: string) => void;
  picked: string[];
  onPickTrans: (phrase: string) => void;
}

export default function RefPanel({
  sceneId,
  highlights,
  activeTool,
  onSentClick,
  picked,
  onPickTrans,
}: RefPanelProps) {
  const isT1 = sceneId === 'T1';
  const isT2 = sceneId === 'T2';

  const renderPara = (p: string, pi: number) => {
    if (isT1) {
      const ss = SENTS.filter((s) => s.pi === pi);
      return (
        <div
          key={pi}
          style={{ marginBottom: 12, lineHeight: 1.85, fontSize: 13.5, color: '#3d3b36' }}
        >
          {ss.map((s) => {
            const h = highlights[s.id];
            const tool = h ? hlFor(h) : null;
            return (
              <span
                key={s.id}
                role={activeTool ? 'button' : undefined}
                tabIndex={activeTool ? 0 : undefined}
                onClick={() => activeTool && onSentClick(s.id)}
                onKeyDown={(e) => {
                  if (activeTool && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onSentClick(s.id);
                  }
                }}
                style={{
                  background: tool
                    ? tool.bg
                    : activeTool
                      ? 'rgba(167,139,250,.04)'
                      : 'transparent',
                  borderBottom: tool ? `2px solid ${tool.color}` : 'none',
                  padding: tool ? '2px 1px' : '0',
                  borderRadius: tool ? 3 : 0,
                  cursor: activeTool ? 'pointer' : 'default',
                  transition: 'background .12s',
                }}
                onMouseEnter={(e) => {
                  if (activeTool && !tool)
                    (e.target as HTMLElement).style.background =
                      hlFor(activeTool)!.bg;
                }}
                onMouseLeave={(e) => {
                  if (activeTool && !tool)
                    (e.target as HTMLElement).style.background =
                      'rgba(167,139,250,.04)';
                }}
              >
                {s.text}{' '}
              </span>
            );
          })}
        </div>
      );
    }

    if (isT2) {
      type Part = { type: 't' | 'tr'; content: string };
      let parts: Part[] = [{ type: 't', content: p }];

      TRANS.forEach((ph) => {
        const np: Part[] = [];
        parts.forEach((pt) => {
          if (pt.type !== 't') {
            np.push(pt);
            return;
          }
          const idx = pt.content.indexOf(ph);
          if (idx === -1) {
            np.push(pt);
            return;
          }
          if (idx > 0) np.push({ type: 't', content: pt.content.slice(0, idx) });
          np.push({ type: 'tr', content: ph });
          const rest = pt.content.slice(idx + ph.length);
          if (rest) np.push({ type: 't', content: rest });
        });
        parts = np;
      });

      return (
        <div
          key={pi}
          style={{ marginBottom: 12, lineHeight: 2.1, fontSize: 13.5, color: '#3d3b36' }}
        >
          {parts.map((pt, i) => {
            if (pt.type === 'tr') {
              const pk = picked.includes(pt.content);
              const col = CAT_C[catOf(pt.content)];
              return (
                <span
                  key={i}
                  role="button"
                  tabIndex={0}
                  onClick={() => onPickTrans(pt.content)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onPickTrans(pt.content);
                    }
                  }}
                  style={{
                    background: pk ? `${col}25` : 'rgba(167,139,250,.08)',
                    color: pk ? col : '#6d28d9',
                    padding: '3px 6px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    border: pk
                      ? `1.5px solid ${col}66`
                      : '1.5px solid rgba(167,139,250,.2)',
                    fontWeight: pk ? 600 : 400,
                  }}
                >
                  {pt.content}
                  {pk && ' \u2713'}
                </span>
              );
            }
            return <span key={i}>{pt.content}</span>;
          })}
        </div>
      );
    }

    return (
      <div
        key={pi}
        style={{ marginBottom: 12, lineHeight: 1.85, fontSize: 13.5, color: '#3d3b36' }}
      >
        {p}
      </div>
    );
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
      <div
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: '#1a1a18',
          marginBottom: 14,
          fontFamily: "'DM Sans',system-ui,sans-serif",
        }}
      >
        Ideal Beauty
      </div>

      {isT1 && activeTool && (
        <div
          style={{
            marginBottom: 8,
            fontSize: 11,
            color: hlFor(activeTool)!.color,
            fontWeight: 600,
            padding: '5px 8px',
            background: hlFor(activeTool)!.bg,
            borderRadius: 5,
          }}
        >
          Active: {hlFor(activeTool)!.label} &mdash; click sentences
        </div>
      )}

      {FULL_TEXT_PARAS.map((p, i) => renderPara(p, i))}
    </div>
  );
}
