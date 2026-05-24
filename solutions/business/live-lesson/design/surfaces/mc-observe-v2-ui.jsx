/* ═══════════════════════════════════════════
   MC OBSERVE v2 — UI Components
   ═══════════════════════════════════════════ */

/* ── Overlay Shell ── */
function OverlayShell({ open, onClose, depth, children }) {
  const [animState, setAnimState] = React.useState('closed');
  const prevOpen = React.useRef(false);

  React.useEffect(() => {
    if (open && !prevOpen.current) {
      setAnimState('entering');
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimState('open')));
    } else if (!open && prevOpen.current) {
      setAnimState('leaving');
      const t = setTimeout(() => setAnimState('closed'), 320);
      return () => clearTimeout(t);
    }
    prevOpen.current = open;
  }, [open]);

  if (animState === 'closed') return null;
  const isVisible = animState === 'open';
  const leftOffset = depth === 0 ? 48 : 108;

  return React.createElement(React.Fragment, null,
    React.createElement('div', {
      onClick: onClose,
      style: {
        position:'fixed', inset:0, zIndex: 100 + depth*10,
        background: `rgba(28,28,26,${depth===0?'.18':'.12'})`,
        opacity: isVisible ? 1 : 0,
        transition: 'opacity .3s ease',
        cursor: 'pointer',
      }
    }),
    React.createElement('div', {
      style: {
        position:'fixed', top:0, bottom:0, right:0,
        left: leftOffset,
        zIndex: 101 + depth*10,
        background: 'var(--bg)',
        borderLeft: '1px solid rgba(28,28,26,.06)',
        boxShadow: '-12px 0 40px rgba(28,28,26,.10)',
        display:'flex', flexDirection:'column',
        transform: isVisible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform .32s cubic-bezier(.4,.0,.2,1)',
        borderRadius: '14px 0 0 14px',
        overflow: 'hidden',
      }
    }, children),
  );
}

/* ── Helpers ── */
function StatCard({ label, value, sub, accent }) {
  const bc = accent==='green'?'rgba(45,102,18,.15)':accent==='purple'?'rgba(58,49,133,.15)':'var(--border)';
  const bg = accent==='green'?'var(--green-bg)':accent==='purple'?'var(--purple-bg)':'var(--surface)';
  const lc = accent==='green'?'var(--green)':accent==='purple'?'var(--purple)':'var(--t3)';
  const vc = accent==='green'?'var(--green)':accent==='purple'?'var(--purple)':'var(--t1)';
  return React.createElement('div', { style: { background:bg, border:`1px solid ${bc}`, borderRadius:10, padding:'12px 14px' } },
    React.createElement('div', { style: { fontSize:9, fontWeight:600, color:lc, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 } }, label),
    React.createElement('div', { style: { fontSize:24, fontWeight:700, letterSpacing:'-.5px', lineHeight:1, color:vc } }, value),
    sub && React.createElement('div', { style: { fontSize:10, color:'var(--t2)', marginTop:4, lineHeight:1.4 } }, sub),
  );
}
function MiniStat({ label, value, color }) {
  return React.createElement('div', { style: { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 12px', textAlign:'center' } },
    React.createElement('div', { style: { fontSize:20, fontWeight:700, lineHeight:1, color:color||'var(--t1)' } }, value),
    React.createElement('div', { style: { fontSize:8, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.3px', marginTop:3 } }, label),
  );
}
function SectionHeader({ text }) {
  return React.createElement('div', { style: { fontSize:10, fontWeight:600, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.6px', marginBottom:10, marginTop:20, display:'flex', alignItems:'center', gap:8 } },
    React.createElement('span', null, text),
    React.createElement('div', { style: { flex:1, height:1, background:'var(--border)' } }),
  );
}

Object.assign(window, { OverlayShell, StatCard, MiniStat, SectionHeader });
