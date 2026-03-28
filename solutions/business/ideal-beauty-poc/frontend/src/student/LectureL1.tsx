import React from 'react';
import { FULL_TEXT_PARAS, BEAUTY_EX } from '../data/content';

export default function LectureL1() {
  return (
    <div className="lecture-container">
      <h1
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: '#1a1a18',
          marginBottom: 8,
          fontFamily: "'DM Sans',system-ui,sans-serif",
        }}
      >
        Ideal Beauty
      </h1>
      <p style={{ fontSize: 15, color: '#6b6963', marginBottom: 24 }}>
        Read the passage below. How many different beauty standards can you find?
      </p>

      <div
        style={{
          fontSize: 15,
          lineHeight: 2,
          color: '#3d3b36',
          marginBottom: 28,
        }}
      >
        {FULL_TEXT_PARAS.map((p, i) => (
          <p key={i} style={{ marginBottom: 16 }}>
            {p}
          </p>
        ))}
      </div>

      <div style={{ padding: '20px 24px', background: '#f5f3ff', borderRadius: 12 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: '#7c3aed',
            marginBottom: 12,
          }}
        >
          Beauty standards across cultures
        </div>
        <div className="grid-2col" style={{ gap: 8 }}>
          {BEAUTY_EX.map((e, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: '#fff',
                borderRadius: 8,
                border: '1px solid #ede9fe',
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18' }}>
                  {e.c}
                </div>
                <div style={{ fontSize: 11, color: '#9e9c96' }}>{e.s}</div>
              </div>
              <div style={{ fontSize: 10, color: '#b8b5ae', alignSelf: 'center' }}>
                {e.p}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
