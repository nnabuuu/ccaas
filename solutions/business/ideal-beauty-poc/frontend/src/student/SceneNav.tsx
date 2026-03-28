import React from 'react';
import { SCENES } from '../data/content';

interface SceneNavProps {
  currentIdx: number;
  maxVisited: number;
  onSelect: (idx: number) => void;
}

export default function SceneNav({ currentIdx, maxVisited, onSelect }: SceneNavProps) {
  return (
    <div
      style={{
        padding: '8px 20px',
        borderBottom: '1px solid #ebe8e2',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: '#fdfcfa',
      }}
    >
      <span
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: '#1a1a18',
          fontFamily: "'DM Sans',system-ui,sans-serif",
        }}
      >
        Ideal Beauty
      </span>

      <div style={{ flex: 1, display: 'flex', gap: 3, overflowX: 'auto' }}>
        {SCENES.map((s, i) => {
          const active = currentIdx === i;
          const done = i < currentIdx;
          const reachable = i <= maxVisited + 1;

          return (
            <button
              key={s.id}
              onClick={() => reachable && onSelect(i)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 10px',
                borderRadius: 7,
                border: 'none',
                background: active ? '#1e1d1b' : done ? '#f0eee8' : 'transparent',
                color: active ? '#fff' : done ? '#3d3b36' : '#b8b5ae',
                fontSize: 11,
                fontWeight: active ? 600 : 400,
                cursor: reachable ? 'pointer' : 'default',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <span style={{ fontSize: 11, color: '#9e9c96', flexShrink: 0 }}>
        {currentIdx + 1}/{SCENES.length}
      </span>
    </div>
  );
}
