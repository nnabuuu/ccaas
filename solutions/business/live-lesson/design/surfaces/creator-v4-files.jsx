/* ════════════════════════════════════════════════
   Creator v4 — File Panel (Claude Design style)
   Categories + previews + ref indicators + jump-to-edit
   ════════════════════════════════════════════════ */

function FilePanel({ collapsed, onToggle, activeFile, onFileClick, onNavigate }) {
  const [expandedCats, setExpandedCats] = React.useState({ plan: true, modules: true, execution: true, resources: false, records: false });

  const toggleCat = (catId) => {
    setExpandedCats(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  if (collapsed) {
    return (
      <div style={{
        width: 44, flexShrink: 0, borderRight: '1px solid var(--border)',
        background: 'var(--surface)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8, gap: 4,
      }}>
        <button className="fp-toggle" onClick={onToggle} title="展开文件面板">📁</button>
        <div style={{ width: 20, height: 1, background: 'var(--border)', margin: '4px 0' }}></div>
        {FILE_CATEGORIES.map(cat => (
          <div key={cat.id} title={cat.label} style={{
            width: 28, height: 28, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, cursor: 'pointer', position: 'relative',
          }} onClick={() => { onToggle(); setTimeout(() => setExpandedCats(prev => ({ ...prev, [cat.id]: true })), 100); }}>
            {cat.icon}
            <span style={{
              position: 'absolute', top: -2, right: -2, fontSize: 8, fontWeight: 700,
              background: `var(--${cat.color}-bg)`, color: `var(--${cat.color})`,
              width: 14, height: 14, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{cat.files.length}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="fp">
      <div className="fp-head">
        <button className="fp-toggle" onClick={onToggle}>◀</button>
        <span style={{ fontSize: 11, fontWeight: 600, flex: 1 }}>项目文件</span>
        <span style={{ fontSize: 9, color: 'var(--t3)' }}>
          {FILE_CATEGORIES.reduce((s, c) => s + c.files.length, 0)} files
        </span>
      </div>

      <div className="scr" style={{ flex: 1 }}>
        {FILE_CATEGORIES.map(cat => (
          <div key={cat.id}>
            <div className="fp-cat" onClick={() => toggleCat(cat.id)} style={{ cursor: 'pointer' }}>
              <span style={{ fontSize: 10, transform: expandedCats[cat.id] ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform .12s' }}>▶</span>
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
              <span className="fc-count">{cat.files.length}</span>
            </div>

            {expandedCats[cat.id] && cat.files.map(file => {
              const reg = file.type ? COMP_REG[file.type] : null;
              const isActive = activeFile === file.id;

              return (
                <div key={file.id}
                  className={`fp-file ${isActive ? 'active' : ''}`}
                  style={{ opacity: file.disabled ? .4 : 1, cursor: file.disabled ? 'default' : 'pointer' }}
                  onClick={() => {
                    if (file.disabled) return;
                    onFileClick(file.id);
                    if (file.navigateTo) onNavigate(file.navigateTo);
                    if (file.refId) onNavigate('exec', file.refId);
                  }}>
                  {/* Icon */}
                  <div className="ff-icon" style={{
                    background: reg ? reg.bg : `var(--${cat.color}-bg)`,
                    color: reg ? reg.color : `var(--${cat.color})`,
                    fontSize: reg ? 13 : 11,
                  }}>
                    {reg ? reg.icon : (file.name.endsWith('.md') ? '≡' : file.name.endsWith('.json') ? '{}' : '📄')}
                  </div>

                  {/* Body */}
                  <div className="ff-body">
                    <div className="ff-name">{file.name}</div>
                    <div className="ff-preview">{file.preview}</div>
                  </div>

                  {/* Ref badge */}
                  {file.refId && <span className="ff-ref" title={`Referenced in ${file.refStep}`}>ref</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Schema hint */}
      <div style={{
        padding: '8px 12px', borderTop: '1px solid var(--border)',
        fontSize: 9, color: 'var(--t3)', lineHeight: 1.5,
      }}>
        <strong style={{ color: 'var(--purple)' }}>ref</strong> 标记的模块文件可被执行流引用。编辑模块定义，所有引用处同步更新。
      </div>
    </div>
  );
}

Object.assign(window, { FilePanel });
