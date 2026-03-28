import React, { useState, useMemo } from 'react';
import { TRANS, catOf, CAT_C, CAT_L } from '../data/content';
import { saveT2, evaluateT2 } from '../api/client';
import { TASK_STYLES as B } from './TaskT1';

/* ─── Types ─── */
export interface T2Result {
  found?: string[];
  missed?: string[];
  feedback?: string;
  encouragement?: string;
}

interface TaskT2Props {
  studentSessionId: string;
  picked: string[];
  onResult: (result: T2Result) => void;
  result: T2Result | null;
}

export default function TaskT2({
  studentSessionId,
  picked,
  onResult,
  result,
}: TaskT2Props) {
  const [loading, setLoading] = useState(false);

  const grouped = useMemo(() => {
    const g: Record<string, string[]> = {};
    picked.forEach((p) => {
      const c = catOf(p);
      if (!g[c]) g[c] = [];
      g[c].push(p);
    });
    return g;
  }, [picked]);

  const doSubmit = async () => {
    setLoading(true);
    try {
      await saveT2(studentSessionId, picked);
      const r = await evaluateT2(studentSessionId);
      onResult(r);
    } catch {
      // Error is silently ignored — student can retry
    }
    setLoading(false);
  };

  return (
    <div>
      <div style={B.title}>Collect transition words</div>
      <p style={B.inst}>Click the highlighted words in the text on the right.</p>

      {picked.length > 0 ? (
        <div style={{ marginTop: 12 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#c4b5fd',
              marginBottom: 8,
            }}
          >
            Collected: {picked.length}/{TRANS.length}
          </div>

          {Object.entries(grouped).map(([c, ps]) => (
            <div key={c} style={{ marginBottom: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: CAT_C[c],
                  textTransform: 'uppercase',
                }}
              >
                {CAT_L[c]}
              </span>
              <div
                style={{
                  display: 'flex',
                  gap: 4,
                  flexWrap: 'wrap',
                  marginTop: 3,
                }}
              >
                {ps.map((p) => (
                  <span
                    key={p}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 10,
                      background: `${CAT_C[c]}22`,
                      color: CAT_C[c],
                      fontSize: 12,
                      fontWeight: 500,
                    }}
                  >
                    {p.replace(/,$/, '')}
                  </span>
                ))}
              </div>
            </div>
          ))}

          <button onClick={doSubmit} disabled={loading} style={B.btn}>
            {loading ? 'Checking...' : 'Check my answers'}
          </button>
        </div>
      ) : (
        <div
          style={{
            marginTop: 14,
            padding: 16,
            background: 'rgba(167,139,250,.05)',
            borderRadius: 8,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 24, marginBottom: 6 }}>{'\uD83D\uDC46'}</div>
          <p style={{ fontSize: 12, color: '#8a8780' }}>
            Click highlighted words in the text to collect them.
          </p>
        </div>
      )}

      {result && (
        <div style={B.fb}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#c4b5fd',
              marginBottom: 6,
            }}
          >
            AI Feedback
          </div>
          <p style={{ fontSize: 11, color: '#b0ada6', fontWeight: 500, lineHeight: 1.6 }}>
            {result.feedback}
          </p>
          {result.missed && result.missed.length > 0 && (
            <div
              style={{
                padding: 6,
                background: 'rgba(239,68,68,.06)',
                borderRadius: 4,
                marginTop: 6,
                fontSize: 11,
                color: '#ef4444',
              }}
            >
              Missed: {result.missed.join(', ')}
            </div>
          )}
          <p
            style={{
              fontSize: 11,
              color: '#a78bfa',
              fontStyle: 'italic',
              marginTop: 6,
            }}
          >
            {result.encouragement}
          </p>
        </div>
      )}
    </div>
  );
}
