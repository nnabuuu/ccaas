/* Architecture Map — Reusable Diagram Primitives */
const { useState, useRef, useEffect, useCallback } = React;

/* ── Section wrapper ── */
function Section({ id, num, title, subtitle, children }) {
  return (
    <section id={id} className="arch-sec">
      <div className="sec-head">
        <span className="sec-num">{num}</span>
        <h2 className="sec-title">{title}</h2>
      </div>
      {subtitle && <p className="sec-sub" dangerouslySetInnerHTML={{ __html: subtitle }} />}
      {children}
    </section>
  );
}

/* ── Phase card (pipeline) ── */
function PhaseCard({ color, icon, title, keyword, desc, output, consumer, producer, children }) {
  return (
    <div className={`phase-card c-${color}`}>
      <div className="phase-head">
        <span className="phase-icon">{icon}</span>
        <span className="phase-title">{title}</span>
        {keyword && <span className={`phase-kw c-${color}`}>{keyword}</span>}
      </div>
      {desc && <div className="phase-desc">{desc}</div>}
      {children}
      <div className="phase-meta">
        {producer && <div className="phase-meta-row"><span className="ml">产出</span><span>{producer}</span></div>}
        {output && <div className="phase-meta-row"><span className="ml">格式</span><span className="mono text-sm">{output}</span></div>}
        {consumer && <div className="phase-meta-row"><span className="ml">消费</span><span>{consumer}</span></div>}
      </div>
    </div>
  );
}

/* ── Flow arrow ── */
function FlowArrow({ label }) {
  return (
    <div className="flow-arrow">
      <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      {label && <span className="al">{label}</span>}
    </div>
  );
}

/* ── Tag ── */
function Tag({ color, children }) {
  return <span className={`d-tag ${color}`}>{children}</span>;
}

/* ── Info box ── */
function InfoBox({ color, title, children }) {
  return (
    <div className={`d-infobox ${color}`}>
      {title && <div className="d-infobox-title">{title}</div>}
      <div className="d-infobox-body">{children}</div>
    </div>
  );
}

/* ── File tree ── */
function FileTree({ items }) {
  return (
    <div className="file-tree">
      {items.map((item, i) => (
        <div key={i} className={`file-node ${item.active ? 'active' : ''}`}>
          <span className="fn-indent" style={{ width: (item.indent || 0) * 16 }} />
          <span className="fn-icon">{item.type === 'folder' ? '📁' : '📄'}</span>
          <span className="fn-name">{item.name}</span>
          {item.desc && <span className="fn-desc">{item.desc}</span>}
        </div>
      ))}
    </div>
  );
}

/* ── Schema table ── */
function SchemaTable({ title, badge, badgeColor, fields, sectionLabel }) {
  return (
    <div className="schema-wrap">
      <div className="schema-head">
        <span className="sh-title">{title}</span>
        {badge && <span className={`sh-badge d-tag ${badgeColor || 'neutral'}`}>{badge}</span>}
      </div>
      {sectionLabel && <div className="schema-section" style={{ color: `var(--${badgeColor || 't3'})` }}>{sectionLabel}</div>}
      <table className="schema">
        <thead><tr><th>字段</th><th>类型</th><th>必填</th><th>说明</th></tr></thead>
        <tbody>
          {fields.map((f, i) => (
            <React.Fragment key={i}>
              {f.section && (
                <tr><td colSpan={4} style={{ padding: '10px 16px 6px', fontSize: 10, fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '.5px', color: f.sectionColor || 'var(--t3)',
                  background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                  {f.section}
                </td></tr>
              )}
              {f.name && (
                <tr>
                  <td className="sf-name">{f.name}</td>
                  <td className="sf-type">{f.type}</td>
                  <td className="sf-req" style={{ color: f.required ? 'var(--red)' : 'var(--t3)' }}>
                    {f.required ? '✦' : '—'}
                  </td>
                  <td className="sf-desc">{f.desc}</td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Flow pipeline step ── */
function FlowStep({ num, title, type, color, completion, active }) {
  return (
    <div className={`flow-step ${active ? 'active' : ''}`}
         style={color ? { borderLeftColor: `var(--${color})`, borderLeftWidth: 3 } : {}}>
      <span className="fs-num">Step {num}</span>
      <span className="fs-title">{title}</span>
      <span className="fs-type">{type}</span>
      {completion && (
        <Tag color={completion === 'manual' ? 'neutral' : completion === 'hard' ? 'green' : 'purple'}>
          {completion === 'manual' ? '手动推进' : completion === 'hard' ? '硬性指标' : 'AI 评估'}
        </Tag>
      )}
    </div>
  );
}

/* ── Flow gate (arrow between steps) ── */
function FlowGate({ label }) {
  return (
    <div className="flow-gate">
      <div className="fg-line" />
      {label && <span className="fg-label">{label}</span>}
    </div>
  );
}

/* ── Comparison card ── */
function CmpCard({ title, tag, tagColor, desc, footer, children }) {
  return (
    <div className="cmp-card">
      <div className="cmp-card-title">
        {title}
        {tag && <Tag color={tagColor || 'neutral'}>{tag}</Tag>}
      </div>
      {desc && <div className="cmp-card-desc">{desc}</div>}
      {children}
      {footer && <div className="cmp-card-footer">{footer}</div>}
    </div>
  );
}

/* ── Subheading ── */
function SubHead({ children, tag, tagColor }) {
  return (
    <div className="sub-head">
      {children}
      {tag && <Tag color={tagColor}>{tag}</Tag>}
    </div>
  );
}

/* ── Code block ── */
function CodeBlock({ title, children }) {
  return (
    <div>
      {title && <div className="text-xs mono mb-sm" style={{ color: 'var(--t3)' }}>{title}</div>}
      <pre className="code-block">{children}</pre>
    </div>
  );
}

/* ── Layer stack item ── */
function LayerItem({ label, color, children }) {
  return (
    <div className="layer-item">
      <div className="li-color" style={{ background: `var(--${color})` }} />
      <span className="li-label">{label}</span>
      <span className="li-content">{children}</span>
    </div>
  );
}

/* Export to window */
Object.assign(window, {
  Section, PhaseCard, FlowArrow, Tag, InfoBox, FileTree, SchemaTable,
  FlowStep, FlowGate, CmpCard, SubHead, CodeBlock, LayerItem
});
