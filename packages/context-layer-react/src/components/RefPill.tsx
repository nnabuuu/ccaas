import React from 'react';

export interface RefPillProps {
  icon: string;
  displayName: string;
  onRemove?: () => void;
}

export function RefPill({ icon, displayName, onRemove }: RefPillProps) {
  return (
    <span
      data-testid="ref-pill"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        background: '#e8f0fe',
        borderRadius: '12px',
        fontSize: '13px',
        color: '#1a73e8',
        border: '1px solid #c5d9f7',
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
