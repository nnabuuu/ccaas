import React from 'react';
import RubricBreakdown from '../ui/RubricBreakdown';
import type { WritingEvaluation } from '../api/client';

/* ═══════ Student Broadcast Overlay ═══════
 * Full-screen modal shown when teacher broadcasts a student's work.
 * Receives raw SSE data; extracts version text + evaluation.
 */

interface BroadcastOverlayProps {
  data: Record<string, unknown>;
  onDismiss: () => void;
}

export default function BroadcastOverlay({ data, onDismiss }: BroadcastOverlayProps) {
  const version = data.version as Record<string, unknown> | undefined;
  const evaluation = version?.evaluation as WritingEvaluation | undefined;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Teacher broadcast"
      className="anim-fade-in"
      onKeyDown={(e) => e.key === 'Escape' && onDismiss()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        className="broadcast-modal"
        style={{
          maxHeight: '80vh',
          background: '#fff',
          borderRadius: 16,
          border: '1px solid #ebe8e2',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            background: '#fafaf8',
            borderBottom: '1px solid #ede9fe',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#7c3aed',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              From your teacher
            </div>
            {data.studentName as string && (
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: '#1a1a18',
                  marginTop: 2,
                  fontFamily: "'DM Sans',system-ui,sans-serif",
                }}
              >
                {String(data.studentName)}&apos;s work
              </div>
            )}
          </div>
          <button
            onClick={onDismiss}
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              border: '1px solid #ebe8e2',
              background: '#fff',
              color: '#9e9c96',
              fontSize: 16,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {typeof version?.text === 'string' && (
            <div
              style={{
                fontSize: 15,
                lineHeight: 1.9,
                color: '#3d3b36',
                marginBottom: 16,
                padding: '16px',
                background: '#fafaf8',
                borderRadius: 10,
                border: '1px solid #ebe8e2',
                fontFamily: "'Source Serif 4',Georgia,serif",
              }}
            >
              {String(version.text)}
            </div>
          )}

          {evaluation && (
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#7c3aed',
                  marginBottom: 8,
                }}
              >
                Feedback
              </div>
              <RubricBreakdown evaluation={evaluation} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #ebe8e2',
            textAlign: 'center',
          }}
        >
          <button
            onClick={onDismiss}
            style={{
              padding: '8px 24px',
              borderRadius: 8,
              border: '1px solid #ebe8e2',
              background: '#fff',
              color: '#3d3b36',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
