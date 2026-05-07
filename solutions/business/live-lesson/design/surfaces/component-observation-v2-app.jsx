const { useState, useCallback, Fragment, useMemo } = React;

/* ═══════════════════════════════════════════════════════════
   Component-Level Observation — Design Exploration v2
   
   方案 D: C 的布局 + B 的学生可见性 + 教师多选关注机制
   ═══════════════════════════════════════════════════════════ */

/* ─── MOCK DATA (same as v1) ─── */
const STEPS = [
  {
    id: 1, name: 'Predict', type: '图式激活', time: '5 min', studentCount: 0,
    components: [
      { id: 'c1-1', type: 'practice', label: '阅读前两段 + 回答', status: 'done', students: { done: 42, prog: 0, stuck: 0 }, metrics: { accuracy: 95 } },
      { id: 'c1-2', type: 'discuss', label: 'Discuss: 核心冲突', status: 'done', students: { done: 42, prog: 0, stuck: 0 }, metrics: { goalRate: 88, avgRounds: 2.1 } },
    ],
    activeComponent: null,
  },
  {
    id: 2, name: 'Skim', type: '结构解码', time: '8 min', studentCount: 4,
    components: [
      { id: 'c2-1', type: 'practice', label: '略读 + 结构匹配', status: 'done', students: { done: 38, prog: 4, stuck: 0 }, metrics: { accuracy: 83 } },
      { id: 'c2-2', type: 'discuss', label: 'Discuss: 语篇结构', status: 'active', students: { done: 36, prog: 4, stuck: 2 }, metrics: { goalRate: 72, avgRounds: 3.1 } },
    ],
    activeComponent: 'c2-2',
  },
  {
    id: 3, name: 'Scan & Build', type: '信息矩阵', time: '15 min', studentCount: 26,
    components: [
      { id: 'c3-1', type: 'lecture', label: '讲解: 寻读策略', status: 'done', students: { done: 42, prog: 0, stuck: 0 }, metrics: {} },
      { id: 'c3-2', type: 'practice', label: '填写信息矩阵', status: 'active', students: { done: 12, prog: 10, stuck: 4 }, metrics: { accuracy: 31, weakDim: 'Why 列' } },
      { id: 'c3-3', type: 'discuss', label: 'Discuss: 美的文化语言', status: 'active', students: { done: 10, prog: 9, stuck: 7 }, metrics: { goalRate: 38, avgRounds: 4.2, fallback: 7, fallbackCorrect: 4 } },
      { id: 'c3-4', type: 'summary', label: '任务总结', status: 'future', students: { done: 0, prog: 0, stuck: 0 }, metrics: {} },
    ],
    activeComponent: 'c3-2',
  },
  {
    id: 4, name: 'Evaluate', type: '批判质疑', time: '12 min', studentCount: 10,
    components: [
      { id: 'c4-1', type: 'practice', label: '观点 + 证据表达', status: 'active', students: { done: 4, prog: 5, stuck: 1 }, metrics: { accuracy: 40 } },
      { id: 'c4-2', type: 'discuss', label: 'Discuss: 评价作者观点', status: 'waiting', students: { done: 0, prog: 3, stuck: 0 }, metrics: { goalRate: 0, avgRounds: 1.5 } },
    ],
    activeComponent: 'c4-1',
  },
  {
    id: 5, name: 'Wrap-up', type: '策略复盘', time: '5 min', studentCount: 2,
    components: [
      { id: 'c5-1', type: 'practice', label: '策略排序 + 迁移', status: 'waiting', students: { done: 1, prog: 1, stuck: 0 }, metrics: {} },
    ],
    activeComponent: null,
  },
];

const OBSERVATIONS = [
  {
    id: 1, severity: 'urg', stepId: 3, componentId: 'c3-3', componentLabel: 'Discuss',
    title: '7 人理解度 < 30%，触发兜底选择题',
    detail: 'Myanmar/Indonesia 内容合并导致矩阵错误，Discuss 中无法归纳文化语言概念',
    students: ['黄婉晴','徐晨曦','郭斐然','邓梓涵','董思齐','冯璐','谢安然'],
    time: '刚刚',
    actions: ['推送 ¶7 分隔提示', '暂停 T3.Discuss'],
  },
  {
    id: 2, severity: 'warn', stepId: 3, componentId: 'c3-2', componentLabel: '练习',
    title: 'Why 列空缺率 58%',
    detail: '学生能提取 Where/What 但不能归纳 Hidden Reason',
    students: ['王译文','刘子墨','孙楠语','蔡明轩','吴思涵','胡恩齐'],
    time: '3 分钟前',
    actions: ['推送 Why 列支架句', '加入 Discuss 引导'],
  },
  {
    id: 3, severity: 'warn', stepId: 3, componentId: 'c3-3', componentLabel: 'Discuss',
    title: 'tā moko 与 tattoos 术语混淆',
    detail: '4 人在 Discuss 中使用泛称 tattoos，未识别文化特异性',
    students: ['王译文','刘子墨','孙楠语','蔡明轩'],
    time: '2 分钟前',
    actions: ['推送术语对比卡'],
  },
  {
    id: 4, severity: 'info', stepId: 2, componentId: 'c2-2', componentLabel: 'Discuss',
    title: 'T2.Discuss 2 人卡在结构归纳',
    detail: '赵雪莉、何子睿在 Discuss 中反复回答细节而非结构',
    students: ['赵雪莉','何子睿'],
    time: '5 分钟前',
    actions: ['提示关注段首句'],
  },
  {
    id: 5, severity: 'info', stepId: 4, componentId: 'c4-1', componentLabel: '练习',
    title: '证据引用不足',
    detail: '3 人表达了观点但未引用任何文本证据',
    students: ['叶瑞','潘悦','曾以柔'],
    time: '1 分钟前',
    actions: ['推送支架句提示'],
  },
];

const COMP_TYPES = {
  lecture:  { label: '讲解', color: 'var(--teal)',   bg: 'var(--teal-bg)',   icon: '📖' },
  practice: { label: '练习', color: 'var(--blue)',   bg: 'var(--blue-bg)',   icon: '✏️' },
  discuss:  { label: '讨论', color: 'var(--purple)', bg: 'var(--purple-bg)', icon: '💬' },
  summary:  { label: '总结', color: 'var(--green)',  bg: 'var(--green-bg)',  icon: '📋' },
};


/* ═══════════════════════════════════════════════════════════
   OPTION D: C + B 融合 + 教师关注多选
   ═══════════════════════════════════════════════════════════ */

function OptionD() {
  const [selectedSignal, setSelectedSignal] = useState(null);
  const [expandedStep, setExpandedStep] = useState(3);
  const [watched, setWatched] = useState(new Set([1])); // 默认关注第一条紧急信号
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'watched' | 'urg'

  const toggleWatch = (id, e) => {
    e.stopPropagation();
    setWatched(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filteredObs = OBSERVATIONS.filter(obs => {
    if (filterMode === 'watched') return watched.has(obs.id);
    if (filterMode === 'urg') return obs.severity === 'urg';
    return true;
  });

  const watchedCount = watched.size;

  return React.createElement('div', { style: {
    fontFamily: '"Plus Jakarta Sans", -apple-system, "PingFang SC", sans-serif', color: 'var(--t1)', background: 'var(--bg)',
    minHeight: '100%', display: 'grid', gridTemplateColumns: '1fr 320px',
  } },

    /* ══════════════ LEFT: Step cards with component awareness ══════════════ */
    React.createElement('div', { style: { padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto' } },
      React.createElement('div', { style: { fontSize: 10, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.5px', padding: '4px 0 6px', display: 'flex', alignItems: 'center', gap: 8 } },
        React.createElement('span', null, '课堂进程'),
        React.createElement('span', { style: { fontSize: 9, color: 'var(--t3)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 } }, '已用 18:22 / 45:00'),
      ),

      STEPS.map(step => {
        const isExpanded = expandedStep === step.id;
        const stepObs = OBSERVATIONS.filter(o => o.stepId === step.id);
        const urgCount = stepObs.filter(o => o.severity === 'urg').length;
        const warnCount = stepObs.filter(o => o.severity === 'warn').length;
        const highlightedCompId = selectedSignal ? OBSERVATIONS.find(o => o.id === selectedSignal)?.componentId : null;
        const isStepHighlighted = selectedSignal && stepObs.some(o => o.id === selectedSignal);

        return React.createElement('div', { key: step.id, style: {
          background: 'var(--surface)', border: `1px solid ${isStepHighlighted ? 'rgba(26,95,160,.35)' : 'var(--border)'}`,
          borderRadius: 10, overflow: 'hidden', transition: 'border-color .2s',
          boxShadow: isStepHighlighted ? '0 0 0 2px rgba(26,95,160,.08)' : 'none',
        } },

          /* ── Header ── */
          React.createElement('div', {
            onClick: () => setExpandedStep(isExpanded ? null : step.id),
            style: { padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }
          },
            React.createElement('span', { style: { width: 22, height: 22, borderRadius: '50%', background: 'var(--t1)', color: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 } }, step.id),
            React.createElement('div', { style: { flex: 1, minWidth: 0 } },
              React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
                React.createElement('span', { style: { fontSize: 13, fontWeight: 700 } }, step.name),
                React.createElement('span', { style: { fontSize: 9, color: 'var(--t2)' } }, `${step.time} · ${step.type}`),
              ),
              /* Component strip — always visible */
              React.createElement('div', { style: { display: 'flex', gap: 2, marginTop: 6 } },
                step.components.map(comp => {
                  const ct = COMP_TYPES[comp.type];
                  const isActive = comp.status === 'active';
                  const isDone = comp.status === 'done';
                  const isFuture = comp.status === 'future' || comp.status === 'waiting';
                  const isHL = highlightedCompId === comp.id;
                  const compAlerts = OBSERVATIONS.filter(o => o.componentId === comp.id);
                  const total = comp.students.done + comp.students.prog + comp.students.stuck;
                  const donePct = total > 0 ? comp.students.done / total * 100 : 0;

                  return React.createElement('div', { key: comp.id, style: {
                    flex: 1, height: 28, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
                    background: isHL ? ct.color : isFuture ? 'var(--surface2)' : isActive ? ct.bg : 'var(--green-bg)',
                    position: 'relative', overflow: 'hidden',
                    opacity: isFuture ? 0.4 : 1, transition: 'all .2s',
                  } },
                    /* Progress fill for active */
                    isActive && !isHL && React.createElement('div', { style: {
                      position: 'absolute', left: 0, top: 0, bottom: 0,
                      width: `${donePct}%`, background: ct.color, opacity: 0.12,
                    } }),
                    React.createElement('span', { style: { fontSize: 9, fontWeight: 700, color: isHL ? '#fff' : isFuture ? 'var(--t3)' : ct.color, position: 'relative', zIndex: 1 } }, ct.label),
                    isActive && !isHL && comp.students.stuck > 0 && React.createElement('span', { style: {
                      position: 'absolute', top: 2, right: 3, width: 12, height: 12, borderRadius: '50%', fontSize: 7, fontWeight: 700,
                      background: 'var(--amber)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    } }, comp.students.stuck),
                    compAlerts.some(a => a.severity === 'urg') && !isHL && React.createElement('span', { style: {
                      position: 'absolute', top: 2, left: 3, width: 6, height: 6, borderRadius: '50%', background: 'var(--red)',
                    } }),
                  );
                }),
              ),
            ),
            /* Alert count */
            (urgCount + warnCount) > 0 && React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end', flexShrink: 0 } },
              urgCount > 0 && React.createElement('span', { style: { fontSize: 8, fontWeight: 700, color: '#fff', background: 'var(--red)', padding: '1px 5px', borderRadius: 3 } }, `${urgCount} 紧急`),
              warnCount > 0 && React.createElement('span', { style: { fontSize: 8, fontWeight: 600, color: 'var(--amber)', background: 'var(--amber-bg)', padding: '1px 5px', borderRadius: 3 } }, `${warnCount} 注意`),
            ),
            React.createElement('span', { style: { fontSize: 8, color: 'var(--t3)', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform .15s', flexShrink: 0 } }, '▶'),
          ),

          /* ── Expanded: components + inline observations ── */
          isExpanded && React.createElement('div', { style: { padding: '0 14px 12px', borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 4 } },
            step.components.map(comp => {
              const ct = COMP_TYPES[comp.type];
              const total = comp.students.done + comp.students.prog + comp.students.stuck;
              const alerts = OBSERVATIONS.filter(o => o.componentId === comp.id);
              const isHL = highlightedCompId === comp.id;

              return React.createElement('div', { key: comp.id, style: {
                borderRadius: 6, overflow: 'hidden',
                background: isHL ? ct.bg : 'transparent',
                border: isHL ? `1px solid ${ct.color}30` : '1px solid transparent',
                transition: 'all .2s',
              } },
                /* Component row */
                React.createElement('div', { style: {
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                  borderLeft: `3px solid ${comp.status === 'active' ? ct.color : comp.status === 'done' ? 'var(--green)' : 'var(--surface2)'}`,
                } },
                  React.createElement('span', { style: { fontSize: 9, fontWeight: 700, color: ct.color, background: ct.bg, padding: '2px 6px', borderRadius: 3, flexShrink: 0 } }, ct.label),
                  React.createElement('span', { style: { fontSize: 10, fontWeight: 500, color: 'var(--t1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, comp.label),
                  /* Mini progress bar */
                  total > 0 && React.createElement('div', { style: { display: 'flex', height: 10, width: 54, borderRadius: 2, overflow: 'hidden', background: 'var(--surface2)', flexShrink: 0 } },
                    comp.students.done > 0 && React.createElement('div', { style: { width: `${comp.students.done / 42 * 100}%`, background: 'var(--green)', height: '100%' } }),
                    comp.students.prog > 0 && React.createElement('div', { style: { width: `${comp.students.prog / 42 * 100}%`, background: 'var(--blue)', height: '100%' } }),
                    comp.students.stuck > 0 && React.createElement('div', { style: { width: `${comp.students.stuck / 42 * 100}%`, background: 'var(--amber)', height: '100%' } }),
                  ),
                  /* Metrics */
                  comp.type === 'discuss' && comp.metrics.goalRate !== undefined && React.createElement('span', { style: { fontSize: 9, fontWeight: 600, color: comp.metrics.goalRate > 70 ? 'var(--green)' : comp.metrics.goalRate > 40 ? 'var(--amber)' : 'var(--red)', flexShrink: 0 } }, `${comp.metrics.goalRate}%达标`),
                  comp.type === 'practice' && comp.metrics.accuracy !== undefined && React.createElement('span', { style: { fontSize: 9, fontWeight: 600, color: comp.metrics.accuracy > 70 ? 'var(--green)' : comp.metrics.accuracy > 40 ? 'var(--amber)' : 'var(--red)', flexShrink: 0 } }, `${comp.metrics.accuracy}%正确`),
                  alerts.length > 0 && React.createElement('span', { style: {
                    fontSize: 8, fontWeight: 700, width: 16, height: 16, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: alerts.some(a => a.severity === 'urg') ? 'var(--red)' : 'var(--amber)', color: '#fff', flexShrink: 0,
                  } }, alerts.length),
                ),

                /* Inline alert previews when highlighted */
                isHL && alerts.length > 0 && React.createElement('div', { style: { padding: '4px 10px 8px 16px', display: 'flex', flexDirection: 'column', gap: 4 } },
                  alerts.map(obs => React.createElement('div', { key: obs.id, style: {
                    fontSize: 10, color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: 6,
                  } },
                    React.createElement('span', { style: { width: 5, height: 5, borderRadius: '50%', background: obs.severity === 'urg' ? 'var(--red)' : 'var(--amber)', flexShrink: 0 } }),
                    React.createElement('span', { style: { fontWeight: 600, color: 'var(--t1)' } }, obs.title),
                  )),
                ),
              );
            }),
          ),
        );
      }),
    ),

    /* ══════════════ RIGHT: Signal stream with watch toggles ══════════════ */
    React.createElement('div', { style: { borderLeft: '1px solid var(--border)', background: 'var(--surface)', overflowY: 'auto', display: 'flex', flexDirection: 'column' } },

      /* ── Header + filter ── */
      React.createElement('div', { style: { padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
          React.createElement('span', { style: { fontSize: 11, fontWeight: 700, letterSpacing: '-.1px' } }, '观察信号'),
          React.createElement('span', { style: { fontSize: 9, fontWeight: 600, background: 'var(--surface2)', padding: '1px 6px', borderRadius: 8, color: 'var(--t3)' } }, OBSERVATIONS.length),
          watchedCount > 0 && React.createElement('span', { style: { fontSize: 9, fontWeight: 600, background: 'var(--amber-bg)', padding: '1px 6px', borderRadius: 8, color: 'var(--amber)' } }, `${watchedCount} 关注中`),
        ),
        /* Filter toggles */
        React.createElement('div', { style: { display: 'flex', gap: 3 } },
          [
            { key: 'all', label: '全部' },
            { key: 'watched', label: '关注中' },
            { key: 'urg', label: '仅紧急' },
          ].map(f => React.createElement('button', { key: f.key,
            onClick: () => setFilterMode(f.key),
            style: {
              fontSize: 9, fontWeight: 600, padding: '3px 8px', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit',
              border: '1px solid', flex: 1,
              borderColor: filterMode === f.key ? 'var(--t1)' : 'var(--border)',
              background: filterMode === f.key ? 'var(--t1)' : 'var(--surface)',
              color: filterMode === f.key ? 'var(--surface)' : 'var(--t2)',
            },
          }, f.label)),
        ),
      ),

      /* ── Signal cards ── */
      React.createElement('div', { style: { padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 } },
        filteredObs.length === 0 && React.createElement('div', { style: { padding: 20, textAlign: 'center', color: 'var(--t3)', fontSize: 11 } },
          filterMode === 'watched' ? '暂未关注任何信号' : '暂无匹配信号'),

        filteredObs.map(obs => {
          const step = STEPS.find(s => s.id === obs.stepId);
          const comp = step?.components.find(c => c.id === obs.componentId);
          const ct = comp ? COMP_TYPES[comp.type] : null;
          const isSelected = selectedSignal === obs.id;
          const isWatched = watched.has(obs.id);

          return React.createElement('div', { key: obs.id,
            onClick: () => { setSelectedSignal(isSelected ? null : obs.id); setExpandedStep(obs.stepId); },
            style: {
              padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
              background: isSelected ? 'var(--bg)' : 'var(--surface)',
              border: `1px solid ${isSelected ? 'rgba(26,95,160,.25)' : isWatched ? 'rgba(196,138,30,.2)' : 'var(--border)'}`,
              transition: 'all .15s',
              boxShadow: isSelected ? '0 2px 8px rgba(28,28,26,.06)' : 'none',
            }
          },

            /* Row 1: breadcrumb + watch toggle */
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 } },
              React.createElement('span', { style: { fontSize: 8, fontWeight: 700, color: 'var(--t3)' } }, `T${step.id}`),
              React.createElement('span', { style: { fontSize: 8, color: 'var(--t3)' } }, '·'),
              ct && React.createElement('span', { style: { fontSize: 8, fontWeight: 700, color: ct.color, background: ct.bg, padding: '1px 4px', borderRadius: 2 } }, ct.label),

              /* Watch checkbox */
              React.createElement('div', { style: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 } },
                React.createElement('span', { style: { fontSize: 8, color: 'var(--t3)' } }, obs.time),
                React.createElement('button', {
                  onClick: (e) => toggleWatch(obs.id, e),
                  title: isWatched ? '取消关注' : '标记关注',
                  style: {
                    width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${isWatched ? 'var(--amber)' : 'var(--border)'}`,
                    background: isWatched ? 'var(--amber-bg)' : 'var(--surface)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, color: isWatched ? 'var(--amber)' : 'var(--t3)',
                    transition: 'all .12s', flexShrink: 0,
                  },
                }, isWatched ? '★' : '☆'),
              ),
            ),

            /* Row 2: severity + title */
            React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 6 } },
              React.createElement('span', { style: {
                width: 6, height: 6, borderRadius: '50%', marginTop: 5, flexShrink: 0,
                background: obs.severity === 'urg' ? 'var(--red)' : obs.severity === 'warn' ? 'var(--amber)' : 'var(--t3)',
                animation: obs.severity === 'urg' ? 'sig-pulse 2s infinite' : 'none',
              } }),
              React.createElement('span', { style: { fontSize: 11, fontWeight: 700, color: 'var(--t1)', lineHeight: 1.4 } }, obs.title),
            ),

            /* Row 3: detail (only when selected) */
            isSelected && React.createElement('div', { style: { fontSize: 10, color: 'var(--t2)', lineHeight: 1.5, marginBottom: 8, paddingLeft: 12 } }, obs.detail),

            /* Row 4: students (always visible — key from B) */
            React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: isSelected ? 8 : 0, paddingLeft: 12 } },
              obs.students.map(name => React.createElement('span', { key: name, style: {
                fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 3,
                background: obs.severity === 'urg' ? 'rgba(148,41,41,.12)' : 'rgba(196,138,30,.12)',
                color: obs.severity === 'urg' ? 'var(--red)' : 'var(--amber)',
                cursor: 'pointer',
              } }, name)),
            ),

            /* Row 5: actions (when selected) */
            isSelected && React.createElement('div', { style: { display: 'flex', gap: 4, paddingLeft: 12, paddingTop: 4, borderTop: '1px dashed var(--border)', marginTop: 4 } },
              obs.actions.map((act, ai) => React.createElement('button', { key: ai, onClick: e => e.stopPropagation(), style: {
                fontSize: 9, fontWeight: 600, padding: '4px 10px', borderRadius: 4,
                border: ai === 0 ? 'none' : '1px solid var(--border)',
                background: ai === 0 ? 'var(--t1)' : 'var(--surface)',
                color: ai === 0 ? 'var(--surface)' : 'var(--t1)', cursor: 'pointer', fontFamily: 'inherit',
              } }, act)),
            ),
          );
        }),
      ),

      /* ── Bottom: watched summary ── */
      watchedCount > 0 && React.createElement('div', { style: {
        padding: '10px 14px', borderTop: '1px solid var(--border)', background: 'var(--amber-bg)',
        display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0,
      } },
        React.createElement('div', { style: { fontSize: 9, fontWeight: 700, color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: '.4px' } }, `${watchedCount} 个关注中的信号`),
        [...watched].map(id => {
          const obs = OBSERVATIONS.find(o => o.id === id);
          if (!obs) return null;
          return React.createElement('div', { key: id, style: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 9 } },
            React.createElement('span', { style: { width: 5, height: 5, borderRadius: '50%', background: obs.severity === 'urg' ? 'var(--red)' : 'var(--amber)', flexShrink: 0 } }),
            React.createElement('span', { style: { fontWeight: 600, color: 'var(--t1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, obs.title),
            React.createElement('span', { style: { color: 'var(--t3)' } }, `${obs.students.length} 人`),
          );
        }),
      ),
    ),
  );
}


/* ═══ ROOT ═══ */
function App() {
  return React.createElement(window.DesignCanvas, null,
    React.createElement(window.DCSection, { id: 'v2-combined', title: '方案 D · 整合视图 + 学生可见 + 关注机制' },
      React.createElement(window.DCArtboard, { id: 'opt-d', label: 'D · C布局 + B学生可见 + 教师关注多选', width: 880, height: 780 },
        React.createElement('style', null, `@keyframes sig-pulse{0%,100%{opacity:1}50%{opacity:.4}}`),
        React.createElement(OptionD),
      ),
    ),
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
