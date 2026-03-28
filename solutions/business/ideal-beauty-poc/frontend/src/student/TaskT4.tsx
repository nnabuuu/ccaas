import React from 'react';
import { RUBRIC } from '../data/content';
import { TASK_STYLES as B } from './TaskT1';
import type { VersionEntry } from './TaskT3';

interface TaskT4Props {
  draft: string;
  setDraft: (v: string) => void;
  versions: VersionEntry[];
}

export default function TaskT4({ draft, setDraft, versions }: TaskT4Props) {
  const wc = draft.trim().split(/\s+/).filter(Boolean).length;
  const evs = versions.filter((v) => v.eval);

  return (
    <div>
      <div style={B.title}>Final submission</div>
      <p style={B.inst}>Expand to 80-100 words with 2+ examples.</p>

      <div
        style={{
          margin: '8px 0 10px',
          padding: 8,
          background: 'rgba(167,139,250,.04)',
          borderRadius: 6,
          fontSize: 12,
          color: '#d4d0c8',
          lineHeight: 1.5,
          fontStyle: 'italic',
        }}
      >
        <strong style={{ fontStyle: 'normal', color: '#c4b5fd' }}>Prompt:</strong>{' '}
        What does &ldquo;ideal beauty&rdquo; mean to you? Should there be one
        standard or diverse forms?
      </div>

      <div style={{ position: 'relative' }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          style={{
            width: '100%',
            padding: 12,
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,.08)',
            background: 'rgba(255,255,255,.03)',
            color: '#e2e0d8',
            fontSize: 15,
            lineHeight: '1.9',
            resize: 'vertical',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
            minHeight: 200,
          }}
        />
        <span
          style={{
            position: 'absolute',
            bottom: 8,
            right: 10,
            fontSize: 10,
            fontWeight: 700,
            color: wc >= 80 && wc <= 100 ? '#b0ada6' : '#ef4444',
            background: 'rgba(30,29,27,.85)',
            padding: '2px 6px',
            borderRadius: 4,
          }}
        >
          {wc} / 80–100 words
        </span>
      </div>

      {evs.length > 0 && (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            background: 'rgba(167,139,250,.04)',
            borderRadius: 8,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#c4b5fd',
              marginBottom: 6,
            }}
          >
            Your progress ({evs.length} {evs.length === 1 ? 'draft' : 'drafts'})
          </div>
          <div
            style={{
              display: 'flex',
              gap: 4,
              alignItems: 'flex-end',
              height: 40,
            }}
          >
            {evs.map((v) => {
              const t = RUBRIC.reduce(
                (s, c) => s + (v.eval[c.key]?.score || 0),
                0,
              );
              const h = (t / 3) * 28 + 10;
              const col =
                t >= 2 ? '#6ee7b7' : '#ef4444';
              return (
                <div
                  key={v.id}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2,
                  }}
                >
                  <span style={{ fontSize: 9, fontWeight: 700, color: col }}>
                    {t}/3
                  </span>
                  <div
                    style={{
                      width: '100%',
                      maxWidth: 24,
                      height: h,
                      background: `${col}18`,
                      borderRadius: 3,
                      border: `1px solid ${col}44`,
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
