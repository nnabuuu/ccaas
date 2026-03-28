import React, { useState } from 'react';
import { SENTS, HL, hlFor } from '../data/content';
import { saveT1, evaluateT1 } from '../api/client';

/* ─── Shared task-panel styles ─── */
const B = {
  title: {
    fontSize: 18,
    fontWeight: 700 as const,
    color: '#e8e6e0',
    marginBottom: 6,
    fontFamily: "'DM Sans',system-ui,sans-serif",
  },
  inst: {
    fontSize: 13,
    color: '#b0ada6',
    fontWeight: 500 as const,
    lineHeight: 1.6,
    margin: '0 0 4px',
  },
  btn: {
    marginTop: 12,
    padding: '10px 20px',
    borderRadius: 8,
    border: 'none',
    background: '#7c3aed',
    color: '#fff',
    fontWeight: 600 as const,
    fontSize: 14,
    cursor: 'pointer' as const,
  },
  fb: {
    marginTop: 14,
    padding: 12,
    background: 'rgba(255,255,255,.025)',
    borderRadius: 8,
    border: '1px solid rgba(167,139,250,.12)',
  },
};

export { B as TASK_STYLES };

/* ─── Types ─── */
export interface T1Result {
  topicSentence?: { found: boolean; feedback: string };
  paragraphStructure?: {
    point?: { identified: boolean; feedback: string };
    evidence?: { identified: boolean; feedback: string };
    elaboration?: { identified: boolean; feedback: string };
  };
  overallTip?: string;
}

interface TaskT1Props {
  studentSessionId: string;
  highlights: Record<string, string>;
  activeTool: string | null;
  setActiveTool: (tool: string | null) => void;
  onResult: (result: T1Result) => void;
  result: T1Result | null;
}

export default function TaskT1({
  studentSessionId,
  highlights,
  activeTool,
  setActiveTool,
  onResult,
  result,
}: TaskT1Props) {
  const [loading, setLoading] = useState(false);

  const tagged = HL.map((t) => ({
    ...t,
    sents: Object.entries(highlights)
      .filter(([, v]) => v === t.key)
      .map(([id]) => {
        const s = SENTS.find((x) => x.id === id);
        return s?.text || '';
      }),
  }));

  const doSubmit = async () => {
    setLoading(true);
    try {
      await saveT1(studentSessionId, highlights);
      const r = await evaluateT1(studentSessionId);
      onResult(r);
    } catch {
      // Error is silently ignored — student can retry
    }
    setLoading(false);
  };

  return (
    <div>
      <div style={B.title}>Highlight P-E-E structure</div>
      <p style={B.inst}>
        Choose a color below, then click sentences in the text on the right.
      </p>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '12px 0' }}>
        {HL.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTool(activeTool === t.key ? null : t.key)}
            style={{
              padding: '10px 14px',
              borderRadius: 16,
              border: `2px solid ${activeTool === t.key ? t.color : 'rgba(255,255,255,.08)'}`,
              background: activeTool === t.key ? t.bg : 'transparent',
              color: activeTool === t.key ? t.color : '#b0ada6',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: t.color,
                opacity: activeTool === t.key ? 1 : 0.4,
              }}
            />
            {t.label}
          </button>
        ))}
      </div>

      {activeTool && (
        <div
          style={{
            padding: '6px 10px',
            background: hlFor(activeTool)!.bg,
            borderRadius: 6,
            fontSize: 11,
            color: hlFor(activeTool)!.color,
            marginBottom: 10,
          }}
        >
          Click sentences on the right to mark as{' '}
          <strong>{hlFor(activeTool)!.label}</strong>
        </div>
      )}

      {tagged.map(
        (t) =>
          t.sents.length > 0 && (
            <div
              key={t.key}
              style={{
                marginBottom: 8,
                padding: '6px 10px',
                borderLeft: `3px solid ${t.color}`,
                background: 'rgba(255,255,255,.02)',
                borderRadius: '0 6px 6px 0',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: t.color,
                  marginBottom: 2,
                }}
              >
                {t.label}
              </div>
              {t.sents.map((s, i) => (
                <div
                  key={i}
                  style={{ fontSize: 11, color: '#d4d0c8', lineHeight: 1.5 }}
                >
                  &ldquo;{s}&rdquo;
                </div>
              ))}
            </div>
          ),
      )}

      {Object.keys(highlights).length > 0 && (
        <button onClick={doSubmit} disabled={loading} style={B.btn}>
          {loading ? 'Checking...' : 'Check my work'}
        </button>
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
          {(
            [
              [
                'Topic sentence',
                result.topicSentence?.found,
                result.topicSentence?.feedback,
              ],
              [
                'Point',
                result.paragraphStructure?.point?.identified,
                result.paragraphStructure?.point?.feedback,
              ],
              [
                'Evidence',
                result.paragraphStructure?.evidence?.identified,
                result.paragraphStructure?.evidence?.feedback,
              ],
              [
                'Elaboration',
                result.paragraphStructure?.elaboration?.identified,
                result.paragraphStructure?.elaboration?.feedback,
              ],
            ] as [string, boolean | undefined, string | undefined][]
          ).map(([l, ok, fb]) => (
            <p key={l} style={{ fontSize: 11, color: '#b0ada6', fontWeight: 500, margin: '3px 0' }}>
              {ok ? '\u2705' : '\u26A0\uFE0F'}{' '}
              <strong style={{ color: '#d4d0c8' }}>{l}:</strong> {fb}
            </p>
          ))}
          <p
            style={{
              fontSize: 11,
              color: '#a78bfa',
              fontStyle: 'italic',
              marginTop: 6,
            }}
          >
            {result.overallTip}
          </p>
        </div>
      )}
    </div>
  );
}
