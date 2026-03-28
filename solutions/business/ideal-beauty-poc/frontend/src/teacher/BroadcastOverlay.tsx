import React from 'react';
import RubricBreakdown from '../ui/RubricBreakdown';
import type { WritingEvaluation } from '../api/client';

/* ═══════ Types ═══════ */

export interface BroadcastVersion {
  id: string;
  text: string;
  version_number: number;
  evaluation: WritingEvaluation | null;
}

export interface BroadcastStudent {
  id: string;
  student_name: string;
}

interface BroadcastOverlayProps {
  student: BroadcastStudent;
  version: BroadcastVersion;
  onSend: () => void;
  onClose: () => void;
}

/* ═══════ Component ═══════ */

export default function BroadcastOverlay({
  student,
  version,
  onSend,
  onClose,
}: BroadcastOverlayProps) {
  const ev = version.evaluation;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Broadcast student work"
      className="anim-fade-in"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        zIndex: 100,
      }}
    >
      <div
        className="broadcast-modal-teacher"
        style={{
          background: '#fff',
          borderRadius: 14,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '12px 20px',
            background: '#1e1d1b',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span
            style={{ fontSize: 13, fontWeight: 700, color: '#e2e0d8' }}
          >
            {student.student_name} &middot; Draft {version.version_number}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onSend}
              style={{
                padding: '4px 12px',
                borderRadius: 5,
                border: '1px solid rgba(124,58,237,.5)',
                background: '#7c3aed',
                color: '#fff',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Share with class
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '4px 12px',
                borderRadius: 5,
                border: '1px solid rgba(255,255,255,.12)',
                background: 'transparent',
                color: '#8a8780',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>

        {/* Body text */}
        <div
          style={{
            padding: '22px 24px',
            fontSize: 16,
            lineHeight: 2,
            color: '#1a1a18',
            fontFamily: "'Source Serif 4',Georgia,serif",
          }}
        >
          {version.text}
        </div>

        {/* Rubric breakdown */}
        {ev && (
          <div
            style={{
              padding: '0 24px 18px',
              borderTop: '1px solid #ebe8e2',
              marginTop: 0,
              paddingTop: 12,
            }}
          >
            <RubricBreakdown evaluation={ev} labelKey="label" />
          </div>
        )}
      </div>
    </div>
  );
}
