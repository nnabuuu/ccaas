/* ════════════════════════════════════════════════
   Creator v2 — Observe / Rules / Preview Tabs
   ════════════════════════════════════════════════ */

/* ═══ OBSERVE TAB ═══ */
function ObserveTab({ block }) {
  const reg = COMP_REG[block.type];
  if (!reg || !reg.hasObserve) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 28, opacity: .3, marginBottom: 8 }}>▣</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)' }}>该组件类型无观察维度</div>
        <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4 }}>讲解/视频等非交互组件不产出学生行为数据</div>
      </div>
    );
  }

  const regMetrics = reg.metrics || [];
  const [metrics, setMetrics] = React.useState(() =>
    regMetrics.map(m => {
      const configured = (block.observe?.metrics || []).find(cm => cm.id === m.id);
      return {
        ...m,
        enabled: configured ? configured.enabled !== false : true,
        threshold: configured?.threshold ?? m.defThresh,
        severity: configured?.severity ?? m.defSev ?? 'info',
      };
    })
  );

  const [views, setViews] = React.useState(() =>
    (reg.views || []).map(v => ({ label: v, enabled: (block.observe?.views || []).includes(v) }))
  );

  const toggleMetric = (id) => {
    setMetrics(prev => prev.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m));
  };

  const updateThreshold = (id, val) => {
    setMetrics(prev => prev.map(m => m.id === id ? { ...m, threshold: +val } : m));
  };

  const updateSeverity = (id, sev) => {
    setMetrics(prev => prev.map(m => m.id === id ? { ...m, severity: sev } : m));
  };

  const toggleView = (i) => {
    setViews(prev => prev.map((v, vi) => vi === i ? { ...v, enabled: !v.enabled } : v));
  };

  const enabledCount = metrics.filter(m => m.enabled).length;

  return (
    <Scr style={{ flex: 1, padding: 16 }}>
      {/* Summary bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', marginBottom: 14,
        background: 'var(--green-bg)', border: '1px solid rgba(45,102,18,.12)', borderRadius: 'var(--r-input)',
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--green)' }}>
          📊 {enabledCount}/{regMetrics.length} 个维度已启用
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--t3)' }}>
          {views.filter(v => v.enabled).length} 个视图
        </span>
      </div>

      {/* Metrics list */}
      <ContentDivider label="观察维度" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {metrics.map(m => (
          <MetricCard key={m.id} metric={m}
            onToggle={() => toggleMetric(m.id)}
            onThresholdChange={(val) => updateThreshold(m.id, val)}
            onSeverityChange={(sev) => updateSeverity(m.id, sev)}
          />
        ))}
      </div>

      {/* Add custom metric */}
      <button style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        width: '100%', padding: 8, marginTop: 8, fontSize: 10, color: 'var(--purple)',
        background: 'var(--purple-bg)', border: '1px dashed rgba(58,49,133,.2)',
        borderRadius: 'var(--r-input)', cursor: 'pointer', fontFamily: 'inherit',
      }}>✦ 自定义观察维度</button>

      {/* Observe Views */}
      <ContentDivider label="观察视图" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {views.map((v, i) => (
          <div key={i} onClick={() => toggleView(i)} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
            borderRadius: 'var(--r-input)', cursor: 'pointer',
            background: v.enabled ? 'rgba(45,102,18,.04)' : 'transparent',
            transition: 'all .1s',
          }}>
            <div style={{
              width: 16, height: 16, borderRadius: 4, flexShrink: 0,
              border: v.enabled ? '2px solid var(--green)' : '2px solid var(--border)',
              background: v.enabled ? 'var(--green)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {v.enabled && <span style={{ color: '#fff', fontSize: 9, fontWeight: 700 }}>✓</span>}
            </div>
            <span style={{ fontSize: 11, color: v.enabled ? 'var(--t1)' : 'var(--t3)', fontWeight: v.enabled ? 500 : 400 }}>{v.label}</span>
          </div>
        ))}
      </div>
    </Scr>
  );
}

/* ── Metric Card ── */
function MetricCard({ metric: m, onToggle, onThresholdChange, onSeverityChange }) {
  const [expanded, setExpanded] = React.useState(m.enabled && m.defThresh !== undefined);
  const sev = SEVERITIES.find(s => s.id === m.severity) || SEVERITIES[2];

  return (
    <div style={{
      border: `1px solid ${m.enabled ? 'var(--border)' : 'rgba(28,28,26,.06)'}`,
      borderRadius: 'var(--r-input)', overflow: 'hidden',
      background: m.enabled ? 'var(--surface)' : 'var(--bg)',
      opacity: m.enabled ? 1 : 0.6, transition: 'all .15s',
    }}>
      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', cursor: 'pointer',
      }} onClick={() => { if (m.enabled && m.hasThresh !== false) setExpanded(!expanded); }}>
        {/* Toggle */}
        <div onClick={(e) => { e.stopPropagation(); onToggle(); }} style={{
          width: 16, height: 16, borderRadius: 4, flexShrink: 0,
          border: m.enabled ? '2px solid var(--green)' : '2px solid var(--border)',
          background: m.enabled ? 'var(--green)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          {m.enabled && <span style={{ color: '#fff', fontSize: 9, fontWeight: 700 }}>✓</span>}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t1)' }}>{m.label}</div>
          {m.desc && <div style={{ fontSize: 9, color: 'var(--t3)', marginTop: 1 }}>{m.desc}</div>}
        </div>

        {/* Severity badge */}
        {m.enabled && m.hasThresh !== false && (
          <span style={{
            fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
            background: sev.bg, color: sev.color,
          }}>{sev.label}</span>
        )}

        {/* Threshold preview */}
        {m.enabled && m.hasThresh !== false && m.threshold !== undefined && (
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--t2)' }}>
            {m.threshold}{m.unit || ''}
          </span>
        )}

        {m.enabled && m.hasThresh !== false && (
          <span style={{
            fontSize: 8, color: 'var(--t3)',
            transform: expanded ? 'rotate(90deg)' : 'none',
            transition: 'transform .15s',
          }}>▶</span>
        )}
      </div>

      {/* Expanded config */}
      {expanded && m.enabled && m.hasThresh !== false && (
        <div style={{ padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          {/* Threshold slider */}
          {m.threshold !== undefined && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 9, color: 'var(--t3)' }}>阈值</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t1)' }}>
                  {m.threshold}{m.unit || ''}
                </span>
              </div>
              <input type="range"
                min={m.unit === '人' ? 1 : m.unit === '分' ? 1 : m.unit === '次' ? 1 : m.unit === '组' ? 1 : 10}
                max={m.unit === '人' ? 20 : m.unit === '分' ? 10 : m.unit === '次' ? 10 : m.unit === '组' ? 10 : m.unit === 's' ? 120 : 100}
                value={m.threshold}
                onChange={(e) => onThresholdChange(e.target.value)}
                style={{ width: '100%', accentColor: sev.color.replace('var(--', '').replace(')', '') === 'red' ? '#943029' : sev.color.replace('var(--', '').replace(')', '') === 'amber' ? '#c48a1e' : '#1a5fa0' }}
              />
            </div>
          )}

          {/* Severity selector */}
          <div>
            <span style={{ fontSize: 9, color: 'var(--t3)', display: 'block', marginBottom: 4 }}>严重级别</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {SEVERITIES.map(s => (
                <button key={s.id} onClick={() => onSeverityChange(s.id)} style={{
                  flex: 1, padding: '4px 6px', fontSize: 9, fontWeight: 600,
                  fontFamily: 'inherit', borderRadius: 4, cursor: 'pointer',
                  border: m.severity === s.id ? `1.5px solid ${s.color}` : '1.5px solid var(--border)',
                  background: m.severity === s.id ? s.bg : 'var(--bg)',
                  color: m.severity === s.id ? s.color : 'var(--t3)',
                  transition: 'all .12s',
                }}>{s.label}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* ═══ RULES TAB ═══ */
function RulesTab({ block }) {
  const reg = COMP_REG[block.type];
  if (!reg || !reg.hasObserve) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 28, opacity: .3, marginBottom: 8 }}>⚡</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)' }}>该组件类型无可配置规则</div>
      </div>
    );
  }

  const regMetrics = reg.metrics || [];
  const [rules, setRules] = React.useState(block.observe?.rules || []);
  const [showAdd, setShowAdd] = React.useState(false);

  const removeRule = (id) => {
    setRules(prev => prev.filter(r => r.id !== id));
  };

  const addRule = (rule) => {
    setRules(prev => [...prev, { id: 'r' + Date.now(), ...rule }]);
    setShowAdd(false);
  };

  return (
    <Scr style={{ flex: 1, padding: 16 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', marginBottom: 14,
        background: 'var(--purple-bg)', border: '1px solid rgba(58,49,133,.12)', borderRadius: 'var(--r-input)',
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--purple)' }}>
          ⚡ {rules.length} 条干预规则
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--t3)' }}>
          当条件满足时自动执行
        </span>
      </div>

      <ContentDivider label="当前规则" />

      {rules.length === 0 && (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--t3)', fontSize: 11 }}>
          暂无规则 — 点击下方添加
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rules.map((rule, i) => (
          <RuleCard key={rule.id} rule={rule} index={i} metrics={regMetrics} onRemove={() => removeRule(rule.id)} />
        ))}
      </div>

      {/* Add rule */}
      {!showAdd ? (
        <button onClick={() => setShowAdd(true)} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          width: '100%', padding: 10, marginTop: 10, fontSize: 11, fontWeight: 600,
          color: 'var(--purple)', background: 'var(--purple-bg)',
          border: '1px dashed rgba(58,49,133,.2)', borderRadius: 'var(--r-input)',
          cursor: 'pointer', fontFamily: 'inherit',
        }}>＋ 添加规则</button>
      ) : (
        <AddRuleForm metrics={regMetrics} onAdd={addRule} onCancel={() => setShowAdd(false)} />
      )}

      {/* Quick reference */}
      <ContentDivider label="可用动作类型" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        {AI_ACTIONS.map(a => (
          <div key={a.id} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-input)',
          }}>
            <span style={{ fontSize: 12 }}>{a.icon}</span>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--t1)' }}>{a.label}</div>
              <div style={{ fontSize: 8, color: 'var(--t3)' }}>{a.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </Scr>
  );
}

/* ── Rule Card ── */
function RuleCard({ rule, index, metrics, onRemove }) {
  const metricDef = metrics.find(m => m.id === rule.condition?.metric);
  const actionDef = AI_ACTIONS.find(a => a.id === rule.action?.type);
  const sev = rule.condition?.op === '<' || rule.condition?.op === '<=' ? 'warn' : 'info';

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)',
      overflow: 'hidden',
    }}>
      {/* Condition */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px',
        background: 'var(--bg)', borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', width: 14 }}>#{index + 1}</span>
        <span style={{ fontSize: 10, color: 'var(--t3)' }}>当</span>
        <span style={{
          fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 3,
          background: 'var(--blue-bg)', color: 'var(--blue)',
        }}>{metricDef?.label || rule.condition?.metric}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t1)' }}>
          {rule.condition?.op} {rule.condition?.value}{metricDef?.unit || ''}
        </span>
      </div>

      {/* Action */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 12px' }}>
        <span style={{ fontSize: 12, marginTop: 1 }}>{actionDef?.icon || '⚡'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--purple)' }}>{actionDef?.label || rule.action?.type}</div>
          <div style={{ fontSize: 10, color: 'var(--t2)', marginTop: 2, lineHeight: 1.5 }}>
            {rule.action?.message}
          </div>
        </div>
        <span onClick={onRemove} style={{
          fontSize: 11, color: 'var(--t3)', cursor: 'pointer', padding: '2px 4px',
          borderRadius: 3, flexShrink: 0,
        }}>✕</span>
      </div>
    </div>
  );
}

/* ── Add Rule Form ── */
function AddRuleForm({ metrics, onAdd, onCancel }) {
  const [metric, setMetric] = React.useState(metrics[0]?.id || '');
  const [op, setOp] = React.useState('<');
  const [value, setValue] = React.useState(70);
  const [actionType, setActionType] = React.useState('alert');
  const [message, setMessage] = React.useState('');

  const selStyle = {
    padding: '6px 8px', fontSize: 11, fontFamily: 'inherit',
    border: '1px solid var(--border)', borderRadius: 'var(--r-input)',
    background: 'var(--bg)', color: 'var(--t1)', outline: 'none',
  };

  return (
    <div style={{
      marginTop: 10, padding: 14, background: 'var(--surface)',
      border: '1px solid rgba(58,49,133,.15)', borderRadius: 'var(--r-card)',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--purple)', marginBottom: 10 }}>新建规则</div>

      {/* Condition row */}
      <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--t3)', marginBottom: 4 }}>条件</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, color: 'var(--t3)', lineHeight: '28px' }}>当</span>
        <select value={metric} onChange={e => setMetric(e.target.value)} style={selStyle}>
          {metrics.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        <select value={op} onChange={e => setOp(e.target.value)} style={{ ...selStyle, width: 48 }}>
          {OPS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <input type="number" value={value} onChange={e => setValue(+e.target.value)}
          style={{ ...selStyle, width: 56 }} />
      </div>

      {/* Action row */}
      <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--t3)', marginBottom: 4 }}>动作</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <select value={actionType} onChange={e => setActionType(e.target.value)} style={selStyle}>
          {AI_ACTIONS.map(a => <option key={a.id} value={a.id}>{a.icon} {a.label}</option>)}
        </select>
      </div>
      <textarea value={message} onChange={e => setMessage(e.target.value)}
        placeholder="描述具体动作内容..."
        rows={2} style={{ ...edInput, resize: 'vertical', marginBottom: 10 }} />

      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <Btn small onClick={onCancel}>取消</Btn>
        <Btn small variant="primary" onClick={() => onAdd({
          condition: { metric, op, value },
          action: { type: actionType, message: message || `${AI_ACTIONS.find(a=>a.id===actionType)?.label}` },
        })}>添加</Btn>
      </div>
    </div>
  );
}


/* ═══ PREVIEW TAB ═══ */
function PreviewTab({ block }) {
  const reg = COMP_REG[block.type];
  if (!reg || !reg.hasObserve) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 28, opacity: .3, marginBottom: 8 }}>👁</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)' }}>该组件类型无观察面板</div>
      </div>
    );
  }

  const enabledMetrics = (block.observe?.metrics || []).filter(m => m.enabled);
  const t = block.type;

  return (
    <Scr style={{ flex: 1, padding: 16 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', marginBottom: 14,
        background: 'var(--surface2)', borderRadius: 'var(--r-input)',
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)' }}>👁 运行时预览</span>
        <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--t3)' }}>模拟数据</span>
      </div>

      {/* Mini observe preview */}
      <div style={{
        border: '1px solid var(--border)', borderRadius: 'var(--r-card)',
        overflow: 'hidden', background: 'var(--bg)',
      }}>
        {/* Mock header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
          background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        }}>
          <span style={{
            width: 18, height: 18, borderRadius: 4,
            background: reg.bg, color: reg.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10,
          }}>{reg.icon}</span>
          <span style={{ fontSize: 11, fontWeight: 600 }}>{block.title}</span>
          <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--green)', fontWeight: 600 }}>● 实时</span>
        </div>

        {/* Mock health cards */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(enabledMetrics.length, 3)}, 1fr)`, gap: 1, background: 'var(--border)' }}>
          {enabledMetrics.slice(0, 3).map(m => {
            const mockValues = { accuracy: 73, firstAttempt: 65, misconceptions: 4, goalRate: 58, fallbackCount: 7, understanding: 42, completion: 82, placementAcc: 66, funcAccuracy: 71, evidenceHit: 55, exactOrder: 48 };
            const val = mockValues[m.id] || Math.floor(Math.random() * 40 + 40);
            const mDef = (reg.metrics || []).find(rm => rm.id === m.id);
            const isLow = m.threshold && val < m.threshold;
            return (
              <div key={m.id} style={{ padding: '10px 12px', background: isLow ? 'rgba(196,138,30,.04)' : 'var(--surface)' }}>
                <div style={{ fontSize: 8, fontWeight: 600, color: isLow ? 'var(--amber)' : 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.3px' }}>
                  {mDef?.label || m.id}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: isLow ? 'var(--amber)' : 'var(--t1)', letterSpacing: '-.5px' }}>
                  {val}{mDef?.unit || ''}
                </div>
                {m.threshold && (
                  <div style={{ fontSize: 8, color: 'var(--t3)', marginTop: 2 }}>
                    阈值: {m.threshold}{mDef?.unit || ''}
                    {isLow && <span style={{ color: 'var(--amber)', fontWeight: 700, marginLeft: 4 }}>⚠ 低于阈值</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Type-specific mock content */}
        <div style={{ padding: 12 }}>
          {t === 'choice' && <MCPreviewMock />}
          {t === 'discuss' && <DiscussPreviewMock />}
          {t === 'matrix' && <MatrixPreviewMock block={block} />}
          {t === 'map' && <MapPreviewMock />}
          {t === 'evidence' && <EvidencePreviewMock />}
          {!['choice','discuss','matrix','map','evidence'].includes(t) && <GenericPreviewMock type={t} reg={reg} />}
        </div>

        {/* Mock student list preview */}
        <div style={{ borderTop: '1px solid var(--border)', padding: '8px 12px' }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 6 }}>学生列表</div>
          {['王译文', '陈昕妍', '徐晨曦'].map((name, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <span style={{ fontSize: 10, fontWeight: 600, flex: 1 }}>{name}</span>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--surface2)', overflow: 'hidden' }}>
                <div style={{ width: `${[95, 100, 22][i]}%`, height: '100%', borderRadius: 2, background: [95, 100, 22][i] > 60 ? 'var(--green)' : 'var(--amber)' }}></div>
              </div>
              <span style={{ fontSize: 9, fontWeight: 600, color: [95, 100, 22][i] > 60 ? 'var(--green)' : 'var(--amber)', width: 28 }}>{[95, 100, 22][i]}%</span>
            </div>
          ))}
          <div style={{ fontSize: 9, color: 'var(--t3)', marginTop: 4 }}>⋯ 还有 13 名学生</div>
        </div>
      </div>

      {/* Link to full observe */}
      <div style={{ marginTop: 12, textAlign: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--blue)', cursor: 'pointer', fontWeight: 600 }}>
          打开完整观察面板 →
        </span>
      </div>

      {/* Configured rules summary */}
      {(block.observe?.rules || []).length > 0 && (
        <React.Fragment>
          <ContentDivider label="活跃规则预览" />
          {(block.observe?.rules || []).map((rule, i) => {
            const mDef = (reg.metrics || []).find(m => m.id === rule.condition?.metric);
            const aDef = AI_ACTIONS.find(a => a.id === rule.action?.type);
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', marginBottom: 4,
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-input)',
                fontSize: 10,
              }}>
                <span>{aDef?.icon || '⚡'}</span>
                <span style={{ color: 'var(--t3)' }}>当 {mDef?.label} {rule.condition?.op} {rule.condition?.value}{mDef?.unit || ''}</span>
                <span style={{ marginLeft: 'auto', fontWeight: 600, color: 'var(--purple)' }}>{aDef?.label}</span>
              </div>
            );
          })}
        </React.Fragment>
      )}
    </Scr>
  );
}

/* ── Type-specific preview mocks ── */
function MCPreviewMock() {
  return (
    <React.Fragment>
      <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 6 }}>逐题正确率</div>
      {[{q:'Q1',pct:94},{q:'Q2',pct:69},{q:'Q3',pct:81}].map(d => (
        <div key={d.q} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
          <span style={{fontSize:9,fontWeight:700,width:20}}>{d.q}</span>
          <div style={{flex:1,height:8,background:'var(--surface2)',borderRadius:2,overflow:'hidden'}}>
            <div style={{width:`${d.pct}%`,height:'100%',borderRadius:2,background:d.pct>80?'var(--green)':d.pct>60?'var(--blue)':'var(--red)'}}></div>
          </div>
          <span style={{fontSize:9,fontWeight:600,color:d.pct>80?'var(--green)':d.pct>60?'var(--blue)':'var(--red)',width:28}}>{d.pct}%</span>
        </div>
      ))}
      <div style={{fontSize:9,color:'var(--amber)',fontWeight:600,marginTop:6,padding:'4px 8px',background:'var(--amber-bg)',borderRadius:4}}>
        ⚠ 3个误解聚类已检测
      </div>
    </React.Fragment>
  );
}

function DiscussPreviewMock() {
  return (
    <React.Fragment>
      <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 6 }}>结果漏斗</div>
      <div style={{display:'flex',height:20,borderRadius:3,overflow:'hidden',marginBottom:8}}>
        <div style={{width:'56%',background:'var(--green)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:700,color:'#fff'}}>9 对话达标</div>
        <div style={{width:'25%',background:'var(--amber)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:700,color:'#fff'}}>4 兜底对</div>
        <div style={{width:'19%',background:'var(--red)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:700,color:'#fff'}}>3 兜底错</div>
      </div>
      <div style={{fontSize:9,color:'var(--red)',fontWeight:600,padding:'4px 8px',background:'var(--red-bg)',borderRadius:4}}>
        🔴 7人理解度 &lt; 30%，触发紧急提醒
      </div>
    </React.Fragment>
  );
}

function MatrixPreviewMock({ block }) {
  const cols = block.content?.cols || ['A','B','C','D'];
  return (
    <React.Fragment>
      <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 6 }}>维度完成率</div>
      {cols.map((col, i) => {
        const pcts = [92, 88, 85, 42];
        const pct = pcts[i] || 60;
        return (
          <div key={i} style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
            <span style={{fontSize:9,fontWeight:600,width:50,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'var(--t2)'}}>{col}</span>
            <div style={{flex:1,height:8,background:'var(--surface2)',borderRadius:2,overflow:'hidden'}}>
              <div style={{width:`${pct}%`,height:'100%',borderRadius:2,background:pct>70?'var(--green)':pct>50?'var(--amber)':'var(--red)'}}></div>
            </div>
            <span style={{fontSize:9,fontWeight:600,color:pct>70?'var(--green)':'var(--amber)',width:28}}>{pct}%</span>
          </div>
        );
      })}
      <div style={{fontSize:9,color:'var(--amber)',fontWeight:600,marginTop:6,padding:'4px 8px',background:'var(--amber-bg)',borderRadius:4}}>
        ⚠ Why列空缺率 58%
      </div>
    </React.Fragment>
  );
}

function MapPreviewMock() {
  return (
    <React.Fragment>
      <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 6 }}>坐标分布</div>
      <div style={{position:'relative',width:'100%',aspectRatio:'1.5',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:4,overflow:'hidden',marginBottom:6}}>
        <div style={{position:'absolute',left:'50%',top:4,bottom:4,width:1,background:'var(--border)'}}></div>
        <div style={{position:'absolute',top:'50%',left:4,right:4,height:1,background:'var(--border)'}}></div>
        {[[.7,.8],[-.5,-.5],[.3,-.2],[.8,.9],[-.7,-.7]].map(([x,y],i) => (
          <div key={i} style={{position:'absolute',left:`${50+x*40}%`,top:`${50-y*40}%`,width:6,height:6,borderRadius:'50%',background:'var(--blue)',opacity:.6,transform:'translate(-50%,-50%)'}}></div>
        ))}
        {[[0,.1],[.1,0],[-.1,.1]].map(([x,y],i) => (
          <div key={i+10} style={{position:'absolute',left:`${50+x*40}%`,top:`${50-y*40}%`,width:6,height:6,borderRadius:'50%',background:'var(--amber)',transform:'translate(-50%,-50%)'}}></div>
        ))}
      </div>
      <div style={{fontSize:9,color:'var(--amber)',fontWeight:600,padding:'4px 8px',background:'var(--amber-bg)',borderRadius:4}}>
        ⚠ 3人放在原点附近——轴向理解困难
      </div>
    </React.Fragment>
  );
}

function EvidencePreviewMock() {
  return (
    <React.Fragment>
      <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 6 }}>逐段识别率</div>
      {[{s:'¶1-2',f:'Phenomenon',pct:88},{s:'¶3-4',f:'History',pct:75},{s:'¶5-7',f:'Culture',pct:69},{s:'¶8',f:'Conclusion',pct:94}].map(d => (
        <div key={d.s} style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
          <span style={{fontSize:9,fontWeight:700,width:28,color:'var(--teal)'}}>{d.s}</span>
          <span style={{fontSize:9,color:'var(--t3)',width:60}}>{d.f}</span>
          <div style={{flex:1,height:8,background:'var(--surface2)',borderRadius:2,overflow:'hidden'}}>
            <div style={{width:`${d.pct}%`,height:'100%',borderRadius:2,background:d.pct>80?'var(--green)':d.pct>60?'var(--blue)':'var(--amber)'}}></div>
          </div>
          <span style={{fontSize:9,fontWeight:600,width:28}}>{d.pct}%</span>
        </div>
      ))}
    </React.Fragment>
  );
}

function GenericPreviewMock({ type, reg }) {
  return (
    <div style={{ padding: 12, textAlign: 'center', color: 'var(--t3)', fontSize: 10 }}>
      <span style={{ fontSize: 20, display: 'block', marginBottom: 4, opacity: .4 }}>{reg.icon}</span>
      {reg.label} 观察面板预览
    </div>
  );
}

Object.assign(window, { ObserveTab, RulesTab, PreviewTab });
