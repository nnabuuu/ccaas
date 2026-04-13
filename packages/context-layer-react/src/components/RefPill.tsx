import React from 'react';

export type RefPillColor = 'blue' | 'green' | 'orange' | 'purple' | 'red';

const COLOR_MAP = {
  blue:   { bg: '#e8f0fe', text: '#1a73e8', border: '#c5d9f7' },
  green:  { bg: '#e6f4ea', text: '#1e8e3e', border: '#b7e1c6' },
  orange: { bg: '#fef3e0', text: '#e37400', border: '#fcd9a8' },
  purple: { bg: '#f3e8fd', text: '#9334e6', border: '#d7b8f5' },
  red:    { bg: '#fce8e6', text: '#d93025', border: '#f5b8b2' },
} as const;

const DEFAULT_PALETTE: RefPillColor = 'blue';

export interface RefPillProps {
  icon: string;
  displayName: string;
  onRemove?: () => void;
  color?: RefPillColor;
}

export function RefPill({ icon, displayName, onRemove, color }: RefPillProps) {
  const palette = COLOR_MAP[color ?? DEFAULT_PALETTE];

  return (
    <span
      data-testid="ref-pill"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        background: palette.bg,
        borderRadius: '12px',
        fontSize: '13px',
        color: palette.text,
        border: `1px solid ${palette.border}`,
      }}
    >
      <span>{icon}</span>
      <span data-testid="ref-pill-name">{displayName}</span>
      {onRemove && (
        <button
          data-testid="ref-pill-remove"
          onClick={onRemove}
          style={{
            background: 'none',
            border: 'none',
            color: '#666',
            cursor: 'pointer',
            fontSize: '14px',
            padding: '0 2px',
            lineHeight: 1,
          }}
        >
          ×
        </button>
      )}
    </span>
  );
}
