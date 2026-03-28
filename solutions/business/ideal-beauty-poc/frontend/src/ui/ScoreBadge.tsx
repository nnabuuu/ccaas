import React from 'react';
import { RUBRIC } from '../data/content';
import type { WritingEvaluation } from '../api/client';
import { scoreColor, scoreColorLight } from './tokens';

/* ═══════ ScoreBadge ═══════
 * Displays a score like "2/3" with appropriate color.
 * Used in: TaskT3 timeline, TaskT4 chart, StudentPanel rows, FullDetail chart.
 */

interface ScoreBadgeProps {
  score: number;
  max?: number;
  size?: 'sm' | 'md';
  /** Use lighter palette (for dark backgrounds) */
  light?: boolean;
}

export function ScoreBadge({
  score,
  max = 3,
  size = 'sm',
  light = false,
}: ScoreBadgeProps) {
  const color = light ? scoreColorLight(score) : scoreColor(score);
  const fontSize = size === 'sm' ? 10 : 12;
  return (
    <span style={{ fontSize, fontWeight: 700, color }}>
      {score}/{max}
    </span>
  );
}

/* ═══════ ScoreIndicators ═══════
 * Row of ✓/✗ boxes for each rubric criterion.
 * Used in: StudentPanel rows, TaskT3 timeline entries.
 */

interface ScoreIndicatorsProps {
  evaluation: WritingEvaluation;
  /** Use lighter palette (for dark backgrounds) */
  light?: boolean;
}

export function ScoreIndicators({
  evaluation,
  light = false,
}: ScoreIndicatorsProps) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {RUBRIC.map((c) => {
        const has = evaluation[c.key]?.score;
        return (
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
              background: has
                ? light
                  ? 'rgba(110,231,183,.12)'
                  : 'rgba(52,211,153,.1)'
                : light
                  ? 'rgba(239,68,68,.08)'
                  : 'rgba(239,68,68,.06)',
              color: has
                ? light
                  ? '#6ee7b7'
                  : '#059669'
                : '#ef4444',
            }}
          >
            {has ? '\u2713' : '\u2717'}
          </span>
        );
      })}
    </div>
  );
}

/* ═══════ Helper ═══════ */

/** Compute total score from a writing evaluation object */
export function computeScore(
  evaluation: WritingEvaluation | null | undefined,
): number | null {
  if (!evaluation) return null;
  return RUBRIC.reduce(
    (acc, c) => acc + (evaluation[c.key]?.score || 0),
    0,
  );
}
