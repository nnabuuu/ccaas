import React from 'react';
import RubricBreakdown from '../ui/RubricBreakdown';
import { computeScore } from '../ui/ScoreBadge';
import { scoreColor } from '../ui/tokens';
import type { StudentProgress, WritingVersion } from './StudentPanel';

/* ═══════ Types ═══════ */

interface FullDetailProps {
  student: StudentProgress;
  onClose: () => void;
  onBroadcast: (student: StudentProgress, version: WritingVersion) => void;
}

/* ═══════ Helpers ═══════ */

function barColor(t: number): string {
  if (t >= 2) return '#34d399';
  return '#ef4444';
}

/* ═══════ Component ═══════ */

export default function FullDetail({
  student,
  onClose,
  onBroadcast,
}: FullDetailProps) {
  const versions = student.versions ?? [];
  const evVersions = versions.filter(v => v.evaluation);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid #ebe8e2',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <div>
          <div
            style={{ fontSize: 15, fontWeight: 700, color: '#1a1a18' }}
          >
            {student.student_name}
          </div>
          <div style={{ fontSize: 11, color: '#9e9c96' }}>
            {evVersions.length} {evVersions.length === 1 ? 'draft' : 'drafts'}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close detail view"
          style={{
            padding: '5px 14px',
            borderRadius: 6,
            border: '1px solid #ebe8e2',
            background: '#fff',
            fontSize: 12,
            cursor: 'pointer',
            color: '#6b6963',
          }}
        >
          &larr; Back
        </button>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {/* Score progression chart */}
        {evVersions.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#9e9c96',
                marginBottom: 6,
              }}
            >
              Score progression
            </div>
            <div
              style={{
                display: 'flex',
                gap: 6,
                alignItems: 'flex-end',
                height: 50,
              }}
            >
              {evVersions.map((v, i) => {
                const t = computeScore(v.evaluation) ?? 0;
                const h = (t / 3) * 36 + 12;
                const col = barColor(t);
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
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: col,
                      }}
                    >
                      {t}/3
                    </span>
                    <div
                      style={{
                        width: '100%',
                        maxWidth: 32,
                        height: h,
                        background: `${col}18`,
                        borderRadius: 4,
                        border: `1px solid ${col}44`,
                      }}
                    />
                    <span style={{ fontSize: 9, color: '#9e9c96' }}>
                      Draft {i + 1}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Full version timeline */}
        {versions.map((v, i) => {
          const ev = v.evaluation;
          const t = computeScore(ev);
          const isLast = i === versions.length - 1;

          return (
            <div
              key={v.id}
              style={{
                marginBottom: 14,
                padding: '14px 16px',
                background: isLast ? '#f5f3ff' : '#fff',
                borderRadius: 10,
                border: `1px solid ${isLast ? '#ede9fe' : '#ebe8e2'}`,
              }}
            >
              {/* Version header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#7c3aed',
                    }}
                  >
                    Draft {v.version_number}
                  </span>
                  {t !== null && (
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: scoreColor(t),
                      }}
                    >
                      {t}/3
                    </span>
                  )}
                </div>
                <button
                  onClick={() => onBroadcast(student, v)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 5,
                    border: '1px solid #ede9fe',
                    background: '#faf5ff',
                    color: '#7c3aed',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Broadcast
                </button>
              </div>

              {/* Version text */}
              <div
                style={{
                  fontSize: 14,
                  color: '#1a1a18',
                  lineHeight: 1.8,
                  padding: '10px 14px',
                  background: '#fafaf8',
                  borderRadius: 8,
                  fontFamily: "'Source Serif 4',Georgia,serif",
                }}
              >
                {v.text}
              </div>

              {/* Rubric breakdown */}
              {ev && (
                <div style={{ marginTop: 10 }}>
                  <RubricBreakdown evaluation={ev} />
                </div>
              )}

              {/* Suggestion */}
              {ev?.overallSuggestion && (
                <div
                  style={{
                    marginTop: 6,
                    padding: '8px 10px',
                    background: '#faf5ff',
                    borderRadius: 6,
                    fontSize: 11,
                    color: '#3d3b36',
                  }}
                >
                  <strong style={{ color: '#7c3aed' }}>Suggestion:</strong>{' '}
                  {ev.overallSuggestion}
                </div>
              )}

              {/* Improvement note */}
              {ev?.improvementNote && (
                <div
                  style={{
                    marginTop: 4,
                    padding: '8px 10px',
                    background: 'rgba(52,211,153,.04)',
                    borderRadius: 6,
                    fontSize: 11,
                    color: '#059669',
                  }}
                >
                  {ev.improvementNote}
                </div>
              )}
            </div>
          );
        })}

        {versions.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: 40,
              color: '#b8b5ae',
              fontSize: 13,
            }}
          >
            No writing submitted yet.
          </div>
        )}
      </div>
    </div>
  );
}
