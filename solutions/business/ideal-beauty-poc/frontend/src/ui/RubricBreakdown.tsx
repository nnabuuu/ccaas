import React from 'react';
import { RUBRIC } from '../data/content';
import type { WritingEvaluation } from '../api/client';

/* ═══════ RubricBreakdown ═══════
 * Displays the 3-criterion writing rubric as a grid of score cards.
 * Used in: student broadcast overlay, teacher broadcast overlay, teacher full detail.
 */

interface RubricBreakdownProps {
  evaluation: WritingEvaluation;
  /** 'short' uses c.short (e.g. "Topic"), 'label' uses c.label (e.g. "Topic sentence") */
  labelKey?: 'short' | 'label';
}

export default function RubricBreakdown({
  evaluation,
  labelKey = 'short',
}: RubricBreakdownProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: 6,
      }}
    >
      {RUBRIC.map((c) => {
        const d = evaluation?.[c.key] as
          | { score?: number; comment?: string }
          | undefined;
        if (!d) return null;
        const passed = !!d.score;
        return (
          <div
            key={c.key}
            style={{
              padding: '8px 10px',
              borderRadius: 6,
              borderBottom: '1px solid #ebe8e2',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: passed ? '#059669' : '#ef4444',
              }}
            >
              {c[labelKey]}
            </div>
            {d.comment && (
              <div
                style={{
                  fontSize: 11,
                  color: '#6b6963',
                  marginTop: 2,
                  lineHeight: 1.4,
                }}
              >
                {d.comment}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
