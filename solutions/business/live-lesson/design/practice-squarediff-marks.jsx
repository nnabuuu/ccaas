/* practice-squarediff-marks.jsx
   Underline annotation graphics:
   - DoubleUnderline   (= 相同项, teal)
   - WavyUnderline     (= 相反项, coral)
   - Marked / StaticMarked   wraps a child with one of the above
   These are used in BOTH the main problem AND the sidebar formula card.
*/

function DoubleUnderline({ visible, color }) {
  return (
    <svg width="100%" height="7" viewBox="0 0 100 7" preserveAspectRatio="none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: -9, overflow: 'visible', pointerEvents: 'none' }}>
      <line x1="2" y1="2" x2="98" y2="2" stroke={color} strokeWidth="1.6" strokeLinecap="round"
        pathLength="100" strokeDasharray="100"
        strokeDashoffset={visible ? 0 : 100}
        style={{ transition: 'stroke-dashoffset .55s ease' }} />
      <line x1="2" y1="5" x2="98" y2="5" stroke={color} strokeWidth="1.6" strokeLinecap="round"
        pathLength="100" strokeDasharray="100"
        strokeDashoffset={visible ? 0 : 100}
        style={{ transition: 'stroke-dashoffset .55s ease .15s' }} />
    </svg>
  );
}

function WavyUnderline({ visible, color }) {
  return (
    <svg width="100%" height="8" viewBox="0 0 100 8" preserveAspectRatio="none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: -10, overflow: 'visible', pointerEvents: 'none' }}>
      <path d="M 0 4 Q 6.25 0 12.5 4 T 25 4 T 37.5 4 T 50 4 T 62.5 4 T 75 4 T 87.5 4 T 100 4"
        fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round"
        pathLength="100" strokeDasharray="100"
        strokeDashoffset={visible ? 0 : 100}
        style={{ transition: 'stroke-dashoffset .65s ease' }} />
    </svg>
  );
}

function Marked({ children, kind, visible, color, padX = 2 }) {
  return (
    <span style={{ position: 'relative', display: 'inline-block', padding: `0 ${padX}px` }}>
      {children}
      {kind === 'double'
        ? <DoubleUnderline visible={visible} color={color} />
        : <WavyUnderline visible={visible} color={color} />}
    </span>
  );
}

/* Always-on small inline marker (used in sidebar rule card, where marks are persistent reference) */
function StaticMarked({ children, kind, color, padX = 2 }) {
  return <Marked kind={kind} visible={true} color={color} padX={padX}>{children}</Marked>;
}

/* Expose to other Babel scripts (each script tag has its own scope) */
Object.assign(window, { DoubleUnderline, WavyUnderline, Marked, StaticMarked });
