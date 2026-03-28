import React, { useState, useRef } from 'react';
import { RUBRIC } from '../data/content';
import { createVersion, evaluateVersion, type WritingEvaluation } from '../api/client';
import { TASK_STYLES as B } from './TaskT1';

/* ─── Types ─── */
export interface VersionEntry {
  id: string;
  text: string;
  time: string;
  eval: WritingEvaluation;
}

interface TaskT3Props {
  studentSessionId: string;
  draft: string;
  setDraft: (v: string) => void;
  versions: VersionEntry[];
  onVersionAdded: (v: VersionEntry) => void;
}

export default function TaskT3({
  studentSessionId,
  draft,
  setDraft,
  versions,
  onVersionAdded,
}: TaskT3Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const feedEnd = useRef<HTMLDivElement>(null);

  const wc = draft.trim().split(/\s+/).filter(Boolean).length;
  const evs = versions.filter((v) => v.eval);

  const doEval = async () => {
    if (!draft.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const created = await createVersion(studentSessionId, draft, 'T3');
      const evalResult = await evaluateVersion(studentSessionId, created.id);
      onVersionAdded({
        id: created.id,
        text: draft,
        time: new Date().toLocaleTimeString(),
        eval: evalResult,
      });
      setTimeout(
        () => feedEnd.current?.scrollIntoView({ behavior: 'smooth' }),
        100,
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Evaluation failed');
    }
    setLoading(false);
  };

  return (
    <div>
      <div style={B.title}>Write, evaluate, revise</div>
      <p style={B.inst}>
        Write your paragraph, submit for AI feedback, then revise and resubmit.
      </p>

      <div
        style={{
          margin: '8px 0 10px',
          padding: 8,
          background: 'rgba(167,139,250,.04)',
          borderRadius: 6,
          fontSize: 11,
          lineHeight: 1.6,
          color: '#b0ada6',
          fontWeight: 500,
        }}
      >
        <strong style={{ color: '#c4b5fd' }}>Sentence starters:</strong> [Practice]
        reflects... &middot; In [culture], [standard] was ideal because... &middot;
        For example &middot; However &middot; In contrast
      </div>

      <div style={{ position: 'relative' }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write your paragraph (50-80 words)..."
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
            minHeight: 160,
          }}
        />
        <span
          style={{
            position: 'absolute',
            bottom: 8,
            right: 10,
            fontSize: 11,
            fontWeight: 700,
            color:
              wc >= 50 && wc <= 80 ? '#b0ada6' : '#ef4444',
            background: 'rgba(30,29,27,.85)',
            padding: '2px 6px',
            borderRadius: 4,
          }}
        >
          {wc} words
        </span>
      </div>

      <button
        onClick={doEval}
        disabled={loading || !draft.trim()}
        style={{ ...B.btn, width: '100%', textAlign: 'center' }}
      >
        {loading
          ? 'Checking...'
          : evs.length === 0
            ? 'Check my writing'
            : `Check again (draft ${evs.length + 1})`}
      </button>

      {error && (
        <div
          role="alert"
          style={{
            marginTop: 8,
            padding: '8px 12px',
            borderRadius: 6,
            background: 'rgba(239,68,68,.08)',
            color: '#ef4444',
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      {evs.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#c4b5fd',
              marginBottom: 10,
            }}
          >
            Your drafts ({evs.length})
          </div>
          <div style={{ position: 'relative', paddingLeft: 16 }}>
            <div
              style={{
                position: 'absolute',
                left: 5,
                top: 6,
                bottom: 6,
                width: 2,
                background: 'rgba(167,139,250,.12)',
                borderRadius: 1,
              }}
            />
            {evs.map((v, i) => {
              const t = RUBRIC.reduce(
                (s, c) => s + (v.eval[c.key]?.score || 0),
                0,
              );
              const isLast = i === evs.length - 1;
              return (
                <div key={v.id} style={{ marginBottom: 12, position: 'relative' }}>
                  <div
                    style={{
                      position: 'absolute',
                      left: -13,
                      top: 4,
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: isLast ? '#a78bfa' : 'rgba(167,139,250,.3)',
                      border: '2px solid #1e1d1b',
                    }}
                  />
                  <div
                    style={{
                      padding: 10,
                      background: isLast
                        ? 'rgba(167,139,250,.06)'
                        : 'rgba(255,255,255,.02)',
                      borderRadius: 8,
                      border: `1px solid ${isLast ? 'rgba(167,139,250,.12)' : 'rgba(255,255,255,.04)'}`,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: 4,
                      }}
                    >
                      <span
                        style={{ fontSize: 11, fontWeight: 700, color: '#c4b5fd' }}
                      >
                        Draft {i + 1}{' '}
                        <span style={{ fontWeight: 400, color: '#5c5a56' }}>
                          {v.time}
                        </span>
                      </span>
                      <div style={{ display: 'flex', gap: 2 }}>
                        {RUBRIC.map((c) => (
                          <span
                            key={c.key}
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: 3,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 8,
                              fontWeight: 700,
                              background: v.eval[c.key]?.score
                                ? 'rgba(110,231,183,.12)'
                                : 'rgba(239,68,68,.08)',
                              color: v.eval[c.key]?.score
                                ? '#6ee7b7'
                                : '#ef4444',
                            }}
                          >
                            {v.eval[c.key]?.score ? '\u2713' : '\u2717'}
                          </span>
                        ))}
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color:
                              t >= 2
                                ? '#6ee7b7'
                                : '#ef4444',
                            marginLeft: 3,
                          }}
                        >
                          {t}/3
                        </span>
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: '#b0ada6',
                        lineHeight: 1.5,
                        maxHeight: isLast ? 'none' : 40,
                        overflow: 'hidden',
                      }}
                    >
                      {v.text}
                    </div>
                    {isLast && (
                      <div style={{ marginTop: 6 }}>
                        {RUBRIC.map((c) => (
                          <div
                            key={c.key}
                            style={{
                              fontSize: 11,
                              padding: '2px 6px',
                              borderLeft: `2px solid ${v.eval[c.key]?.score ? '#34d399' : '#ef4444'}`,
                              color: '#b0ada6',
                              fontWeight: 500,
                              marginBottom: 2,
                            }}
                          >
                            {v.eval[c.key]?.score ? '\u2705' : '\u26A0\uFE0F'}{' '}
                            <strong>{c.short}</strong> {v.eval[c.key]?.comment}
                          </div>
                        ))}
                        {v.eval.overallSuggestion && (
                          <div
                            style={{
                              fontSize: 11,
                              color: '#a78bfa',
                              marginTop: 4,
                              fontStyle: 'italic',
                            }}
                          >
                            {v.eval.overallSuggestion}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div ref={feedEnd} />
        </div>
      )}
    </div>
  );
}
