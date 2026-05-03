/* ════════════════════════════════════════════════
   Creator Shared Components
   ════════════════════════════════════════════════ */

/* ── Top Navigation Shell ── */
function CreatorShell({ activePage, children }) {
  const shellStyles = {
    shell: { display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' },
    topbar: {
      display: 'flex', alignItems: 'center', height: 48, padding: '0 20px',
      background: 'var(--surface)', borderBottom: '1px solid var(--border)',
      flexShrink: 0, gap: 12, zIndex: 50,
    },
    mark: {
      width: 24, height: 24, borderRadius: 6, background: 'var(--t1)', color: 'var(--surface)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, fontWeight: 700, flexShrink: 0,
    },
    navGroup: { display: 'flex', gap: 2, marginLeft: 8 },
    navBtn: (active) => ({
      padding: '6px 14px', fontSize: 12, fontWeight: active ? 600 : 400,
      color: active ? 'var(--t1)' : 'var(--t3)', background: active ? 'var(--surface2)' : 'transparent',
      border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
      transition: 'all .15s',
    }),
    right: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 },
    body: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  };

  return (
    <div style={shellStyles.shell}>
      <div style={shellStyles.topbar}>
        <div style={shellStyles.mark}>E</div>
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: -.2 }}>创作中心</span>
        <div style={shellStyles.navGroup}>
          <a href="Template Library.html" style={{ textDecoration: 'none' }}>
            <button style={shellStyles.navBtn(activePage === 'templates')}>模板库</button>
          </a>
          <a href="Lesson Builder.html" style={{ textDecoration: 'none' }}>
            <button style={shellStyles.navBtn(activePage === 'builder')}>课程构建</button>
          </a>
        </div>
        <div style={shellStyles.right}>
          <Btn variant="ghost" small>帮助</Btn>
        </div>
      </div>
      <div style={shellStyles.body}>{children}</div>
    </div>
  );
}

/* ── Button ── */
function Btn({ children, variant = 'default', small, icon, onClick, style, disabled }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontSize: small ? 11 : 12, fontWeight: 500, fontFamily: 'inherit',
    padding: small ? '4px 10px' : '7px 14px',
    borderRadius: 'var(--r-input)', cursor: disabled ? 'default' : 'pointer',
    border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--t2)',
    transition: 'all .15s', opacity: disabled ? .5 : 1,
    whiteSpace: 'nowrap',
  };
  const variants = {
    primary: { background: 'var(--t1)', color: 'var(--surface)', borderColor: 'var(--t1)' },
    ai: { background: 'var(--purple-bg)', color: 'var(--purple)', borderColor: 'transparent' },
    ghost: { background: 'transparent', borderColor: 'transparent', color: 'var(--t3)' },
    danger: { background: 'var(--red-bg)', color: 'var(--red)', borderColor: 'transparent' },
    teal: { background: 'var(--teal-bg)', color: 'var(--teal)', borderColor: 'transparent' },
  };
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ ...base, ...(variants[variant] || {}), ...style }}
    >
      {icon && <span style={{ fontSize: small ? 12 : 14, lineHeight: 1 }}>{icon}</span>}
      {children}
    </button>
  );
}

/* ── Badge ── */
function Badge({ children, color = 'default', style }) {
  const colorMap = {
    blue: { bg: 'var(--blue-bg)', fg: 'var(--blue)' },
    green: { bg: 'var(--green-bg)', fg: 'var(--green)' },
    amber: { bg: 'var(--amber-bg)', fg: 'var(--amber)' },
    red: { bg: 'var(--red-bg)', fg: 'var(--red)' },
    purple: { bg: 'var(--purple-bg)', fg: 'var(--purple)' },
    teal: { bg: 'var(--teal-bg)', fg: 'var(--teal)' },
    coral: { bg: 'var(--coral-bg)', fg: 'var(--coral)' },
    default: { bg: 'var(--surface2)', fg: 'var(--t2)' },
  };
  const c = colorMap[color] || colorMap.default;
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--r-pill)',
      background: c.bg, color: c.fg, whiteSpace: 'nowrap', ...style,
    }}>{children}</span>
  );
}

/* ── Search Input ── */
function SearchInput({ value, onChange, placeholder = '搜索...', style }) {
  return (
    <div style={{ position: 'relative', ...style }}>
      <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--t3)', pointerEvents: 'none' }}>⌕</span>
      <input
        value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '8px 12px 8px 30px', fontSize: 12, fontFamily: 'inherit',
          border: '1px solid var(--border)', borderRadius: 'var(--r-input-lg)',
          background: 'var(--surface)', outline: 'none', color: 'var(--t1)',
        }}
      />
    </div>
  );
}

/* ── Empty State ── */
function EmptyState({ icon, title, subtitle, action }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 8, color: 'var(--t3)' }}>
      {icon && <span style={{ fontSize: 32, opacity: .5 }}>{icon}</span>}
      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--t2)' }}>{title}</span>
      {subtitle && <span style={{ fontSize: 12 }}>{subtitle}</span>}
      {action}
    </div>
  );
}

/* ── Chip/Filter Tag ── */
function Chip({ children, active, onClick, count }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '5px 12px', fontSize: 11, fontWeight: active ? 600 : 400,
      fontFamily: 'inherit', borderRadius: 20, cursor: 'pointer',
      border: active ? '1px solid var(--t1)' : '1px solid var(--border)',
      background: active ? 'var(--t1)' : 'var(--surface)',
      color: active ? 'var(--surface)' : 'var(--t2)',
      transition: 'all .15s',
    }}>
      {children}
      {count != null && <span style={{ fontSize: 10, opacity: .7 }}>{count}</span>}
    </button>
  );
}

/* ── Section Label ── */
function SectionLabel({ children, style }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 600, color: 'var(--t3)',
      textTransform: 'uppercase', letterSpacing: .5, ...style,
    }}>{children}</div>
  );
}

/* ── Modal ── */
function Modal({ open, onClose, width = 560, children, title }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--surface)', borderRadius: 'var(--r-card-lg)', width,
        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 12px 40px rgba(0,0,0,.15)',
      }}>
        {title && (
          <div style={{
            padding: '14px 20px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>
            <span onClick={onClose} style={{ cursor: 'pointer', color: 'var(--t3)', fontSize: 16 }}>✕</span>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/* ── Scrollable Area ── */
function Scr({ children, style }) {
  return <div className="scr" style={{ overflowY: 'auto', ...style }}>{children}</div>;
}

Object.assign(window, {
  CreatorShell, Btn, Badge, SearchInput, EmptyState, Chip, SectionLabel, Modal, Scr,
});
