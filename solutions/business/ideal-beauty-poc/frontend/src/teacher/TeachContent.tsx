import React from 'react';
import { BEAUTY_EX, RUBRIC } from '../data/content';

/* ═══════ Helpers ═══════ */

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        margin: '12px 0',
        padding: '10px 14px',
        borderRadius: 8,
        background: '#f5f3ff',
        border: '1px solid #ede9fe',
        fontSize: 12,
        color: '#3d3b36',
        lineHeight: 1.6,
      }}
    >
      <strong style={{ color: '#7c3aed' }}>Teacher hint:</strong> {children}
    </div>
  );
}

function Card({
  children,
  style: s,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        padding: '14px 16px',
        background: '#fff',
        borderRadius: 10,
        border: '1px solid #ebe8e2',
        ...s,
      }}
    >
      {children}
    </div>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 15,
        fontWeight: 700,
        color: '#7c3aed',
        marginBottom: 10,
        fontFamily: "'DM Sans',system-ui,sans-serif",
      }}
    >
      {children}
    </div>
  );
}

/* ═══════ P-E-E structure items ═══════ */

const PEE_ITEMS = [
  { l: 'Point', c: '#7a90aa', t: 'Beauty ideals change across periods' },
  {
    l: 'Evidence',
    c: '#6d9578',
    t: 'Egyptian, Venus, Rubens, Elizabethan pale skin',
  },
  {
    l: 'Elaboration',
    c: '#a69570',
    t: 'Each standard tied to cultural values',
  },
];

const TRANSITION_CATS = [
  { l: 'Example', c: '#a78bfa', w: 'for instance, like' },
  { l: 'Contrast', c: '#a78bfa', w: 'However, while, but' },
  { l: 'Time', c: '#a78bfa', w: 'over time, Today, In the 1600s' },
  { l: 'Cause', c: '#a78bfa', w: 'because, So, also' },
];

/* ═══════ Component ═══════ */

interface TeachContentProps {
  sceneId: string;
}

export default function TeachContent({ sceneId }: TeachContentProps) {
  switch (sceneId) {
    case 'L1':
      return (
        <div>
          <H>L1: Reading overview</H>
          <Card>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#7c3aed',
                marginBottom: 8,
              }}
            >
              Beauty standards table
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed', wordBreak: 'break-word' }}>
              <tbody>
                {BEAUTY_EX.map((e, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f0eee8' }}>
                    <td
                      style={{
                        padding: '6px 8px',
                        fontWeight: 500,
                        color: '#1a1a18',
                      }}
                    >
                      {e.c}
                    </td>
                    <td style={{ padding: '6px 8px', color: '#3d3b36' }}>
                      {e.s}
                    </td>
                    <td style={{ padding: '6px 8px', color: '#9e9c96' }}>
                      {e.p}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Hint>
            Draw attention to paragraph 3 (historical beauty) — it has the
            clearest P-E-E structure. Give students 3-4 min to read, then move
            on.
          </Hint>
        </div>
      );

    case 'T1':
      return (
        <div>
          <H>T1: Structure analysis task</H>
          <Card>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#7c3aed',
                marginBottom: 6,
              }}
            >
              Reference answer
            </div>
            <div
              style={{
                padding: '8px 12px',
                background: '#f5f3ff',
                borderRadius: 6,
                border: '1px solid #a78bfa',
                fontSize: 13,
                lineHeight: 1.7,
                fontStyle: 'italic',
              }}
            >
              &ldquo;Ideas about physical beauty change over time and different
              periods of history reveal different views of beauty, particularly
              of women.&rdquo;
            </div>
            <div style={{ marginTop: 10 }}>
              {PEE_ITEMS.map(x => (
                <div
                  key={x.l}
                  style={{
                    padding: '6px 10px',
                    borderLeft: `3px solid ${x.c}`,
                    marginBottom: 4,
                    fontSize: 12,
                    color: '#3d3b36',
                  }}
                >
                  <strong style={{ color: x.c }}>{x.l}:</strong> {x.t}
                </div>
              ))}
            </div>
          </Card>
          <Hint>
            Common mistake: students pick &ldquo;Is one idea of beauty really
            more attractive?&rdquo; — this is a rhetorical question, not the
            topic sentence. The real one is in paragraph 3. If many students get
            this wrong, broadcast the reference answer.
          </Hint>
        </div>
      );

    case 'L2':
      return (
        <div>
          <H>L2: Structure &amp; transitions explained</H>
          <Card style={{ marginBottom: 12 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#7c3aed',
                marginBottom: 6,
              }}
            >
              P-E-E structure demo
            </div>
            {PEE_ITEMS.map(x => (
              <div
                key={x.l}
                style={{
                  padding: '6px 10px',
                  borderLeft: `3px solid ${x.c}`,
                  marginBottom: 3,
                  fontSize: 12,
                  color: '#3d3b36',
                }}
              >
                <strong style={{ color: x.c }}>{x.l}:</strong> {x.t}
              </div>
            ))}
          </Card>
          <Card>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#7c3aed',
                marginBottom: 6,
              }}
            >
              Transition categories
            </div>
            <div
              className="grid-2col"
              style={{
                gap: 6,
                fontSize: 11,
              }}
            >
              {TRANSITION_CATS.map(g => (
                <div
                  key={g.l}
                  style={{
                    padding: '6px 8px',
                    borderTop: `2px solid ${g.c}`,
                    background: '#fafaf8',
                    borderRadius: '0 0 6px 6px',
                  }}
                >
                  <strong style={{ color: g.c }}>{g.l}:</strong> {g.w}
                </div>
              ))}
            </div>
          </Card>
          <Hint>
            Students commonly miss &ldquo;because&rdquo; as a transition — they
            think of it as just a grammar word. Emphasize that it signals CAUSE,
            a structural role. Also &ldquo;Today&rdquo; as a time-shift marker.
          </Hint>
        </div>
      );

    case 'T2':
      return (
        <div>
          <H>T2: Transition collection task</H>
          <Card>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#7c3aed',
                marginBottom: 6,
              }}
            >
              All transitions in text (17 total)
            </div>
            <div
              style={{ fontSize: 12, color: '#3d3b36', lineHeight: 1.8 }}
            >
              However &middot; while (&times;3) &middot; but (&times;2)
              &middot; So &middot; because &middot; also &middot; for instance
              &middot; like &middot; Today &middot; In the early 1600s &middot;
              In Elizabethan England &middot; Within different cultures &middot;
              through the ages &middot; Whether &middot; over time
            </div>
          </Card>
          <Hint>
            Check the student panel for low-scoring students who may need a
            nudge. Students who found 7+ transitions are strong candidates for
            broadcast.
          </Hint>
        </div>
      );

    case 'L3':
      return (
        <div>
          <H>L3: Writing task setup</H>
          <Card style={{ marginBottom: 12 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#7c3aed',
                marginBottom: 6,
              }}
            >
              Task
            </div>
            <div
              style={{ fontSize: 14, color: '#1a1a18', lineHeight: 1.7 }}
            >
              Write 50-80 words about a specific beauty standard. Use topic
              sentence + example + transitions.
            </div>
          </Card>
          <Card>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#7c3aed',
                marginBottom: 6,
              }}
            >
              Rubric (3 criteria)
            </div>
            {RUBRIC.map((c, i) => (
              <div
                key={c.key}
                style={{
                  display: 'flex',
                  gap: 8,
                  padding: '6px 0',
                  borderBottom: i < 2 ? '1px solid #f0eee8' : 'none',
                  fontSize: 12,
                }}
              >
                <span>{['\ud83d\udcdd', '\ud83c\udf0d', '\ud83d\udd17'][i]}</span>
                <div>
                  <strong style={{ color: '#1a1a18' }}>{c.label}</strong>
                </div>
              </div>
            ))}
          </Card>
          <Hint>
            Expect the first wave of 3/3 scores within 5 min from strong
            students. Use their work to broadcast and motivate. Students scoring
            0/3 usually lack a topic sentence — the AI will tell them, but a
            quick verbal reminder helps.
          </Hint>
        </div>
      );

    case 'T3':
      return (
        <div>
          <H>T3: Writing workshop monitoring</H>
          <Card>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#7c3aed',
                marginBottom: 6,
              }}
            >
              Key things to watch
            </div>
            <div
              style={{ fontSize: 12, color: '#3d3b36', lineHeight: 1.7 }}
            >
              <br />
              &bull; Students who get 0/3 on first try — they need verbal
              encouragement
              <br />
              &bull; Students with 2+ revisions showing improvement — good
              broadcast candidates
              <br />
              &bull; Class-wide weakness in any single dimension
            </div>
          </Card>
          <Hint>
            Look for students with multiple revisions showing score progression
            (0&rarr;1&rarr;2) — excellent examples for teaching revision
            strategy. Consider broadcasting draft 1 vs draft 3 side-by-side.
          </Hint>
        </div>
      );

    case 'T4':
      return (
        <div>
          <H>T4: Final submission monitoring</H>
          <Card>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#7c3aed',
                marginBottom: 6,
              }}
            >
              Final prompt
            </div>
            <div
              style={{
                fontSize: 13,
                color: '#1a1a18',
                lineHeight: 1.7,
                fontStyle: 'italic',
              }}
            >
              What does &ldquo;ideal beauty&rdquo; mean to you? 80-100 words, 2+
              examples.
            </div>
          </Card>
          <Hint>
            Good broadcast candidates for final review: students with strong
            cultural contrasts, local perspectives, or unique angles.
          </Hint>
        </div>
      );

    default:
      return null;
  }
}
