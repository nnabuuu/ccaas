import React from 'react';
import { SCENES, type Scene } from '../data/content';

/* ═══════ Types ═══════ */

interface StudentProgress {
  current_scene_idx: number;
}

interface PulseBarProps {
  sceneIdx: number;
  setSceneIdx: (i: number) => void;
  students: StudentProgress[];
  connected: boolean;
}

/* ═══════ Constants ═══════ */

const SCENE_COLORS = SCENES.map(() => '#a78bfa');

/* ═══════ Component ═══════ */

export default function PulseBar({
  sceneIdx,
  setSceneIdx,
  students,
  connected,
}: PulseBarProps) {
  // Build distribution: how many students at each scene
  const dist = Array(SCENES.length).fill(0);
  students.forEach(s => dist[Math.min(s.current_scene_idx, SCENES.length - 1)]++);

  return (
    <div style={{ background: '#1e1d1b', flexShrink: 0 }}>
      {/* Top row: pulse dot, title, distribution bar, student count */}
      <div
        style={{
          padding: '8px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        {/* Pulse dot + title + badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: connected ? '#34d399' : '#6b6963',
              animation: connected ? 'pulse 2s infinite' : 'none',
            }}
          />
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#e2e0d8',
              fontFamily: "'DM Sans',system-ui,sans-serif",
            }}
          >
            Ideal Beauty
          </span>
          <span
            style={{
              fontSize: 11,
              background: '#f0eee8',
              color: '#6b6963',
              padding: '2px 6px',
              borderRadius: 4,
              fontWeight: 600,
            }}
          >
            Teacher
          </span>
        </div>

        {/* Distribution bar */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            gap: 2,
            height: 12,
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          {dist.map((count, i) =>
            count > 0 ? (
              <div
                key={i}
                style={{
                  width: `${(count / Math.max(students.length, 1)) * 100}%`,
                  background: SCENE_COLORS[i],
                  fontSize: 9,
                  fontWeight: 700,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 14,
                }}
              >
                {count}
              </div>
            ) : null,
          )}
        </div>

        {/* Student count */}
        <span style={{ fontSize: 11, color: '#6b6963' }}>
          {students.length} students
        </span>
      </div>

      {/* Scene nav */}
      <div style={{ padding: '0 20px 8px', display: 'flex', gap: 3 }}>
        {SCENES.map((s: Scene, i: number) => {
          const active = sceneIdx === i;
          return (
            <button
              key={s.id}
              onClick={() => setSceneIdx(i)}
              style={{
                flex: 1,
                padding: '6px 4px',
                borderRadius: 6,
                border: 'none',
                background: active
                  ? '#a78bfa'
                  : 'rgba(255,255,255,.06)',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: active ? 600 : 500,
                    color: active ? '#fff' : '#8a8780',
                  }}
                >
                  {s.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>

    </div>
  );
}
