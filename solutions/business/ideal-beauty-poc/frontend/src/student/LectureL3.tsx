import React from 'react';

export default function LectureL3() {
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
        Your writing task
      </h1>
      <p style={{ fontSize: 15, color: '#6b6963', marginBottom: 24 }}>
        Now it&apos;s your turn to write using everything you&apos;ve learned.
      </p>

      <div
        style={{
          padding: '20px 24px',
          background: '#f5f3ff',
          borderRadius: 12,
          marginBottom: 20,
        }}
      >
        <div style={{ fontSize: 18, color: '#1a1a18', lineHeight: 1.8 }}>
          Write a <strong>50-80 word paragraph</strong> about a specific beauty
          standard from any culture or historical period. Explain how it shows that
          beauty is culturally influenced.
        </div>
      </div>

      <div
        style={{ fontSize: 14, fontWeight: 600, color: '#3d3b36', marginBottom: 10 }}
      >
        Sentence patterns 句型支架
      </div>
      {[
        '[Practice] reflects the idea that beauty is shaped by [factor].',
        'In [culture/period], [standard] was considered ideal because...',
        'For example, in [place], [specific detail about the practice]...',
        'In contrast, [different culture] values [different standard]...',
      ].map((p, i) => (
        <div
          key={i}
          style={{
            padding: '10px 16px',
            background: '#fff',
            borderRadius: 8,
            marginBottom: 6,
            fontSize: 15,
            color: '#3d3b36',
            borderLeft: '3px solid #a78bfa',
            border: '1px solid #ebe8e2',
            lineHeight: 1.7,
          }}
        >
          {p}
        </div>
      ))}

      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: '#3d3b36',
          margin: '20px 0 10px',
        }}
      >
        Your paragraph must include 必须包含
      </div>
      <div className="grid-3col" style={{ gap: 10 }}>
        {[
          { n: 'Topic sentence', d: 'Clear main idea', icon: '\uD83D\uDCDD' },
          { n: '1+ specific example', d: 'Cultural/historical detail', icon: '\uD83C\uDF0D' },
          { n: 'Transition words', d: 'For example, However...', icon: '\uD83D\uDD17' },
        ].map((x, i) => (
          <div
            key={i}
            style={{
              padding: '14px',
              background: '#fff',
              borderRadius: 10,
              border: '1px solid #ebe8e2',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 4 }}>{x.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18' }}>
              {x.n}
            </div>
            <div style={{ fontSize: 11, color: '#9e9c96', marginTop: 2 }}>
              {x.d}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
