import React from 'react';

export default function LectureL2() {
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
        How the author organizes ideas
      </h1>
      <p style={{ fontSize: 15, color: '#6b6963', marginBottom: 24 }}>
        Two key skills: finding the structure (P-E-E) and spotting transitions.
      </p>

      {/* Topic sentence */}
      <div
        style={{
          padding: '16px 20px',
          background: '#f5f3ff',
          borderRadius: 12,
          border: '2px solid #a78bfa',
          marginBottom: 24,
        }}
      >
        <div
          style={{ fontSize: 12, fontWeight: 600, color: '#7c3aed', marginBottom: 6 }}
        >
          Topic sentence 主题句
        </div>
        <div
          style={{
            fontSize: 18,
            color: '#1a1a18',
            lineHeight: 1.8,
            fontStyle: 'italic',
            fontFamily: "'Source Serif 4',Georgia,serif",
          }}
        >
          &ldquo;Ideas about physical beauty change over time and different periods of
          history reveal different views of beauty, particularly of women.&rdquo;
        </div>
      </div>

      {/* P-E-E structure */}
      <div
        style={{ fontSize: 14, fontWeight: 600, color: '#3d3b36', marginBottom: 12 }}
      >
        P-E-E structure 段落结构
      </div>
      {(
        [
          {
            l: 'Point 观点',
            c: '#7a90aa',
            bg: '#f0f2f5',
            t: 'Beauty ideals change across historical periods.',
          },
          {
            l: 'Evidence 论据',
            c: '#6d9578',
            bg: '#f0f4f1',
            t: "Egyptian slim women \u00B7 Venus of Hohle Fels \u00B7 Rubens' plump pale women \u00B7 Elizabethan pale skin = wealth",
          },
          {
            l: 'Elaboration 阐释',
            c: '#a69570',
            bg: '#f5f3ee',
            t: "Each era's standard tied to cultural values \u2014 wealth, health, status.",
          },
        ] as const
      ).map((x) => (
        <div
          key={x.l}
          style={{
            padding: '14px 18px',
            borderLeft: `4px solid ${x.c}`,
            background: x.bg,
            borderRadius: '0 10px 10px 0',
            marginBottom: 10,
          }}
        >
          <div
            style={{ fontSize: 12, fontWeight: 700, color: x.c, marginBottom: 3 }}
          >
            {x.l}
          </div>
          <div style={{ fontSize: 15, color: '#1a1a18', lineHeight: 1.8 }}>
            {x.t}
          </div>
        </div>
      ))}

      {/* Transitions */}
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: '#3d3b36',
          margin: '24px 0 12px',
        }}
      >
        Transition expressions 过渡词
      </div>
      <div className="grid-2col" style={{ gap: 10 }}>
        {(
          [
            { l: 'Example 举例', c: '#a78bfa', w: ['for instance', 'like'] },
            { l: 'Contrast 对比', c: '#a78bfa', w: ['However', 'while', 'but'] },
            {
              l: 'Time/Culture 时间文化',
              c: '#a78bfa',
              w: [
                'over time',
                'In the early 1600s',
                'Today',
                'Within different cultures...',
              ],
            },
            { l: 'Cause 因果', c: '#a78bfa', w: ['because', 'So', 'also'] },
          ] as const
        ).map((g) => (
          <div
            key={g.l}
            style={{
              padding: '12px 14px',
              borderTop: `3px solid ${g.c}`,
              background: '#fff',
              borderRadius: '0 0 8px 8px',
              border: '1px solid #ebe8e2',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: g.c,
                marginBottom: 6,
              }}
            >
              {g.l}
            </div>
            {g.w.map((w, i) => (
              <div
                key={i}
                style={{
                  padding: '4px 10px',
                  background: `${g.c}0a`,
                  borderRadius: 5,
                  marginBottom: 3,
                  fontSize: 13,
                  color: '#1a1a18',
                }}
              >
                {w}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
