const { useState, useCallback, Fragment, useMemo } = React;

/* ═══════════════════════════════════════════════════════════
   Component-Level Observation — Design Exploration
   
   核心问题：教师端只展示 Step 粒度，对 Step 内部的
   task component（讲解→练习→Discuss→总结）无感知。
   
   本页展示三个方案的对比。
   ═══════════════════════════════════════════════════════════ */

/* ─── MOCK: Step & Component Data ─── */
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
    students: ['王译文','刘子墨','孙楠语','蔡明轩'],
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
];

/* ─── Component type config ─── */
const COMP_TYPES = {
  lecture:  { label: '讲解', color: 'var(--teal)',   bg: 'var(--teal-bg)',   icon: '📖' },
  practice: { label: '练习', color: 'var(--blue)',   bg: 'var(--blue-bg)',   icon: '✏️' },
  discuss:  { label: '讨论', color: 'var(--purple)', bg: 'var(--purple-bg)', icon: '💬' },
  summary:  { label: '总结', color: 'var(--green)',  bg: 'var(--green-bg)',  icon: '📋' },
};

const STATUS_COLORS = {
  done:    { bg: 'var(--green)',  label: '已完成' },
  active:  { bg: 'var(--blue)',   label: '进行中' },
  waiting: { bg: 'var(--surface2)', label: '等待中' },
  future:  { bg: 'var(--surface2)', label: '未开始' },
};

/* ═══════════════════════════════════════════════════════════
   OPTION A: Step 卡片内嵌 Component 子进度条
   
   设计思路：在每个 Step 卡片内增加一行 component 进度，
   折叠态也可见。点击 component 可展开该 component 的
   详细 observation。
   ═══════════════════════════════════════════════════════════ */

function OptionA() {
  const [expandedStep, setExpandedStep] = useState(3);
  const [expandedComp, setExpandedComp] = useState('c3-3');

  const compObs = (compId) => OBSERVATIONS.filter(o => o.componentId === compId);

  return React.createElement('div', { style: { fontFamily: '"Plus Jakarta Sans", -apple-system, "PingFang SC", sans-serif', color: 'var(--t1)', background: 'var(--bg)', minHeight: '100%', padding: 0 } },

    /* ── Context header ── */
    React.createElement('div', { style: { padding: '14px 20px 10px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border)' } },
      React.createElement('span', { style: { fontSize: 10, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.5px' } }, '课堂进程'),
      React.createElement('span', { style: { fontSize: 10, color: 'var(--t3)' } }, '已用 18:22 / 45:00'),
    ),

    /* ── Step cards ── */
    React.createElement('div', { style: { padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 } },
      STEPS.map(step => {
        const isExpanded = expandedStep === step.id;
        const activeComp = step.components.find(c => c.id === step.activeComponent);
        const hasAlert = OBSERVATIONS.some(o => o.stepId === step.id && o.severity === 'urg');

        return React.createElement('div', { key: step.id, style: {
          background: 'var(--surface)', border: `1px solid ${hasAlert ? 'rgba(148,41,41,.2)' : 'var(--border)'}`,
          borderRadius: 10, overflow: 'hidden',
        } },

          /* ── Card header (always visible) ── */
          React.createElement('div', {
            onClick: () => setExpandedStep(isExpanded ? null : step.id),
            style: { padding: '10px 14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }
          },
            /* Row 1: Step info */
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
              React.createElement('span', { style: { width: 22, height: 22, borderRadius: '50%', background: 'var(--t1)', color: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 } }, step.id),
              React.createElement('span', { style: { fontSize: 13, fontWeight: 700 } }, step.name),
              React.createElement('span', { style: { fontSize: 9, color: 'var(--t2)' } }, `${step.time} · ${step.type}`),
              React.createElement('span', { style: { marginLeft: 'auto', fontSize: 8, color: 'var(--t3)', transition: 'transform .2s', transform: isExpanded ? 'rotate(90deg)' : 'none' } }, '▶'),
            ),

            /* Row 2: Component progress strip (ALWAYS visible — key innovation) */
            React.createElement('div', { style: { display: 'flex', gap: 3, height: 22, borderRadius: 4, overflow: 'hidden' } },
              step.components.map(comp => {
                const ct = COMP_TYPES[comp.type];
                const total = comp.students.done + comp.students.prog + comp.students.stuck;
                const isActive = comp.status === 'active';
                const isFuture = comp.status === 'future' || comp.status === 'waiting';
                const compAlerts = compObs(comp.id);
                const hasCompAlert = compAlerts.some(o => o.severity === 'urg');

                return React.createElement('div', { key: comp.id, style: {
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  background: isFuture ? 'var(--surface2)' : isActive ? ct.bg : 'var(--green-bg)',
                  borderLeft: isActive ? `3px solid ${ct.color}` : 'none',
                  fontSize: 9, fontWeight: 600,
                  color: isFuture ? 'var(--t3)' : ct.color,
                  position: 'relative', cursor: 'pointer',
                  opacity: isFuture ? 0.5 : 1,
                } },
                  React.createElement('span', null, ct.label),
                  !isFuture && total > 0 && React.createElement('span', { style: { fontWeight: 700 } }, comp.students.done + '/' + total),
                  hasCompAlert && React.createElement('span', { style: { position: 'absolute', top: 2, right: 4, width: 6, height: 6, borderRadius: '50%', background: 'var(--red)' } }),
                );
              }),
            ),

            /* Row 3: Active component callout (collapsed state awareness) */
            activeComp && React.createElement('div', { style: {
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: COMP_TYPES[activeComp.type].color,
              background: COMP_TYPES[activeComp.type].bg, padding: '4px 8px', borderRadius: 4, marginTop: -2,
            } },
              React.createElement('span', { style: { fontWeight: 700 } }, `▸ ${activeComp.label}`),
              activeComp.type === 'discuss' && activeComp.metrics.goalRate !== undefined &&
                React.createElement('span', { style: { marginLeft: 'auto', fontSize: 9, fontWeight: 600 } },
                  `达标 ${activeComp.metrics.goalRate}% · ${activeComp.metrics.avgRounds} 轮`),
              activeComp.type === 'practice' && activeComp.metrics.accuracy !== undefined &&
                React.createElement('span', { style: { marginLeft: 'auto', fontSize: 9, fontWeight: 600 } },
                  `正确率 ${activeComp.metrics.accuracy}%`),
              activeComp.students.stuck > 0 &&
                React.createElement('span', { style: { fontSize: 9, fontWeight: 700, color: 'var(--amber)', background: 'var(--amber-bg)', padding: '1px 5px', borderRadius: 3 } },
                  `${activeComp.students.stuck} 卡住`),
            ),
          ),

          /* ── Expanded: Component detail cards ── */
          isExpanded && React.createElement('div', { style: { padding: '0 14px 14px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 10 } },
            step.components.map(comp => {
              const ct = COMP_TYPES[comp.type];
              const total = comp.students.done + comp.students.prog + comp.students.stuck;
              const isCompExpanded = expandedComp === comp.id;
              const alerts = compObs(comp.id);

              return React.createElement('div', { key: comp.id, style: {
                background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden',
                borderLeft: `3px solid ${ct.color}`,
              } },
                /* Component header */
                React.createElement('div', {
                  onClick: () => setExpandedComp(isCompExpanded ? null : comp.id),
                  style: { padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }
                },
                  React.createElement('span', { style: { fontSize: 9, fontWeight: 700, color: ct.color, background: ct.bg, padding: '2px 6px', borderRadius: 3 } }, ct.label),
                  React.createElement('span', { style: { fontSize: 11, fontWeight: 600, flex: 1 } }, comp.label),
                  total > 0 && React.createElement('div', { style: { display: 'flex', gap: 4, alignItems: 'center' } },
                    React.createElement('span', { style: { fontSize: 9, color: 'var(--green)', fontWeight: 600 } }, `✓${comp.students.done}`),
                    comp.students.prog > 0 && React.createElement('span', { style: { fontSize: 9, color: 'var(--blue)', fontWeight: 600 } }, `●${comp.students.prog}`),
                    comp.students.stuck > 0 && React.createElement('span', { style: { fontSize: 9, color: 'var(--amber)', fontWeight: 700 } }, `⚠${comp.students.stuck}`),
                  ),
                  alerts.length > 0 && React.createElement('span', { style: { fontSize: 9, fontWeight: 700, color: '#fff', background: alerts[0].severity === 'urg' ? 'var(--red)' : 'var(--amber)', padding: '1px 5px', borderRadius: 3 } }, alerts.length),
                  React.createElement('span', { style: { fontSize: 8, color: 'var(--t3)', transform: isCompExpanded ? 'rotate(90deg)' : 'none', transition: 'transform .15s' } }, '▶'),
                ),

                /* Component detail: inline observations */
                isCompExpanded && alerts.length > 0 && React.createElement('div', { style: { padding: '0 12px 10px', display: 'flex', flexDirection: 'column', gap: 6 } },
                  alerts.map(obs => React.createElement('div', { key: obs.id, style: {
                    padding: '8px 10px', borderRadius: 6,
                    background: obs.severity === 'urg' ? 'rgba(148,41,41,.04)' : 'rgba(196,138,30,.04)',
                    border: `1px solid ${obs.severity === 'urg' ? 'rgba(148,41,41,.15)' : 'rgba(196,138,30,.15)'}`,
                    borderLeft: `3px solid ${obs.severity === 'urg' ? 'var(--red)' : 'var(--amber)'}`,
                  } },
                    React.createElement('div', { style: { fontSize: 11, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 } }, obs.title),
                    React.createElement('div', { style: { fontSize: 10, color: 'var(--t2)', lineHeight: 1.5, marginBottom: 6 } }, obs.detail),
                    React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 } },
                      obs.students.map(name => React.createElement('span', { key: name, style: {
                        fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 3,
                        background: obs.severity === 'urg' ? 'var(--red)' : 'var(--amber)', color: '#fff',
                      } }, name)),
                    ),
                    React.createElement('div', { style: { display: 'flex', gap: 4, flexWrap: 'wrap' } },
                      obs.actions.map((act, ai) => React.createElement('button', { key: ai, style: {
                        fontSize: 9, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
                        border: '1px solid var(--border)', background: ai === 0 ? 'var(--t1)' : 'var(--surface)',
                        color: ai === 0 ? 'var(--surface)' : 'var(--t1)', cursor: 'pointer', fontFamily: 'inherit',
                      } }, act)),
                    ),
                  )),

                  /* Discuss-specific: mini funnel */
                  comp.type === 'discuss' && comp.metrics.goalRate !== undefined && React.createElement('div', { style: {
                    background: 'var(--purple-bg)', border: '1px solid rgba(58,49,133,.1)', borderRadius: 6, padding: '8px 10px',
                  } },
                    React.createElement('div', { style: { fontSize: 9, fontWeight: 700, color: 'var(--purple)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 6 } }, 'Discuss 概况'),
                    React.createElement('div', { style: { display: 'flex', gap: 12, fontSize: 10 } },
                      React.createElement('span', null, React.createElement('strong', { style: { color: 'var(--green)' } }, `${comp.metrics.goalRate}%`), React.createElement('span', { style: { color: 'var(--t3)', marginLeft: 3 } }, '对话达标')),
                      React.createElement('span', null, React.createElement('strong', { style: { color: 'var(--t1)' } }, comp.metrics.avgRounds), React.createElement('span', { style: { color: 'var(--t3)', marginLeft: 3 } }, '平均轮次')),
                      comp.metrics.fallback > 0 && React.createElement('span', null, React.createElement('strong', { style: { color: 'var(--amber)' } }, comp.metrics.fallback), React.createElement('span', { style: { color: 'var(--t3)', marginLeft: 3 } }, '兜底')),
                    ),
                  ),
                ),
              );
            }),
          ),
        );
      }),
    ),
  );
}


/* ═══════════════════════════════════════════════════════════
   OPTION B: Observation 面板 — Component 感知信号流
   
   设计思路：Observation 面板不再只标注 Step，而是精确到
   component 来源。信号卡片带 component 面包屑，按
   component 类型分组聚合。
   ═══════════════════════════════════════════════════════════ */

function OptionB() {
  const [filterComp, setFilterComp] = useState(null);

  const filteredObs = filterComp
    ? OBSERVATIONS.filter(o => {
        const comp = STEPS.flatMap(s => s.components).find(c => c.id === o.componentId);
        return comp && comp.type === filterComp;
      })
    : OBSERVATIONS;

  const compCounts = {};
  OBSERVATIONS.forEach(o => {
    const comp = STEPS.flatMap(s => s.components).find(c => c.id === o.componentId);
    if (comp) compCounts[comp.type] = (compCounts[comp.type] || 0) + 1;
  });

  return React.createElement('div', { style: { fontFamily: '"Plus Jakarta Sans", -apple-system, "PingFang SC", sans-serif', color: 'var(--t1)', background: 'var(--bg)', minHeight: '100%', padding: 0 } },

    /* ── Header ── */
    React.createElement('div', { style: { padding: '14px 20px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 } },
      React.createElement('span', { style: { fontSize: 11, fontWeight: 700, letterSpacing: '-.1px' } }, '观察要点'),
      React.createElement('span', { style: { fontSize: 9, fontWeight: 600, background: 'var(--surface2)', padding: '1px 6px', borderRadius: 8, color: 'var(--t3)' } }, OBSERVATIONS.length),
    ),

    /* ── Component filter tabs ── */
    React.createElement('div', { style: { display: 'flex', gap: 4, padding: '10px 20px 8px', flexWrap: 'wrap' } },
      React.createElement('button', {
        onClick: () => setFilterComp(null),
        style: { fontSize: 9, fontWeight: 600, padding: '3px 8px', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit',
          border: '1px solid', borderColor: !filterComp ? 'var(--t1)' : 'var(--border)',
          background: !filterComp ? 'var(--t1)' : 'var(--surface)', color: !filterComp ? 'var(--surface)' : 'var(--t2)' }
      }, `全部 ${OBSERVATIONS.length}`),
      Object.entries(COMP_TYPES).filter(([k]) => compCounts[k]).map(([k, v]) =>
        React.createElement('button', { key: k,
          onClick: () => setFilterComp(filterComp === k ? null : k),
          style: { fontSize: 9, fontWeight: 600, padding: '3px 8px', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit',
            border: '1px solid', borderColor: filterComp === k ? v.color : 'var(--border)',
            background: filterComp === k ? v.bg : 'var(--surface)', color: filterComp === k ? v.color : 'var(--t2)' }
        }, `${v.label} ${compCounts[k]}`),
      ),
    ),

    /* ── Signal cards with component breadcrumb ── */
    React.createElement('div', { style: { padding: '4px 16px 20px', display: 'flex', flexDirection: 'column', gap: 8 } },
      filteredObs.map(obs => {
        const step = STEPS.find(s => s.id === obs.stepId);
        const comp = step?.components.find(c => c.id === obs.componentId);
        const ct = comp ? COMP_TYPES[comp.type] : null;

        return React.createElement('div', { key: obs.id, style: {
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
          borderLeft: `3px solid ${obs.severity === 'urg' ? 'var(--red)' : obs.severity === 'warn' ? 'var(--amber)' : 'var(--t3)'}`,
          padding: '10px 14px', position: 'relative',
        } },

          /* Breadcrumb: T3 > 练习 > ... */
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6, fontSize: 9 } },
            React.createElement('span', { style: { fontWeight: 700, color: 'var(--t2)' } }, `T${step.id}`),
            React.createElement('span', { style: { color: 'var(--t3)' } }, '›'),
            ct && React.createElement('span', { style: { fontWeight: 700, color: ct.color, background: ct.bg, padding: '1px 5px', borderRadius: 3 } }, ct.label),
            React.createElement('span', { style: { color: 'var(--t3)' } }, '›'),
            React.createElement('span', { style: { color: 'var(--t2)', fontWeight: 500 } }, comp?.label),
            React.createElement('span', { style: { marginLeft: 'auto', color: 'var(--t3)', fontWeight: 500 } }, obs.time),
          ),

          /* Severity + title */
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 } },
            React.createElement('span', { style: { fontSize: 8, fontWeight: 700, textTransform: 'uppercase', padding: '1px 5px', borderRadius: 3,
              background: obs.severity === 'urg' ? 'var(--red)' : obs.severity === 'warn' ? 'var(--amber)' : 'var(--t3)', color: '#fff',
            } }, obs.severity === 'urg' ? '紧急' : obs.severity === 'warn' ? '注意' : '信息'),
            React.createElement('span', { style: { fontSize: 12, fontWeight: 700, color: 'var(--t1)' } }, obs.title),
          ),

          React.createElement('div', { style: { fontSize: 10, color: 'var(--t2)', lineHeight: 1.5, marginBottom: 8 } }, obs.detail),

          /* Students + actions */
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 } },
            React.createElement('div', { style: { display: 'flex', gap: 3, flexWrap: 'wrap' } },
              obs.students.slice(0, 4).map(name => React.createElement('span', { key: name, style: {
                fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 3,
                background: obs.severity === 'urg' ? 'var(--red)' : 'var(--amber)', color: '#fff',
              } }, name)),
              obs.students.length > 4 && React.createElement('span', { style: { fontSize: 9, color: 'var(--t3)' } }, `+${obs.students.length - 4}`),
            ),
            React.createElement('div', { style: { display: 'flex', gap: 4 } },
              obs.actions.slice(0, 1).map((act, ai) => React.createElement('button', { key: ai, style: {
                fontSize: 9, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
                border: 'none', background: 'var(--t1)', color: 'var(--surface)', cursor: 'pointer', fontFamily: 'inherit',
              } }, act)),
            ),
          ),
        );
      }),
    ),
  );
}


/* ═══════════════════════════════════════════════════════════
   OPTION C: 整合视图 — Step 卡片 + 内嵌 Observation 联动
   
   设计思路：将 A 和 B 的优点结合。Step 卡片展开后，
   Component 列表自带 inline observation badge。
   Observation 面板变成 "信号流"，点击信号可高亮
   对应 Step.Component。
   ═══════════════════════════════════════════════════════════ */

function OptionC() {
  const [selectedSignal, setSelectedSignal] = useState(null);
  const [expandedStep, setExpandedStep] = useState(3);

  return React.createElement('div', { style: {
    fontFamily: '"Plus Jakarta Sans", -apple-system, "PingFang SC", sans-serif', color: 'var(--t1)', background: 'var(--bg)',
    minHeight: '100%', display: 'grid', gridTemplateColumns: '1fr 280px',
  } },

    /* ── Left: Step cards with component awareness ── */
    React.createElement('div', { style: { padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto' } },
      React.createElement('div', { style: { fontSize: 10, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.5px', padding: '4px 0 6px' } }, '课堂进程 · Component 视图'),
      STEPS.map(step => {
        const isExpanded = expandedStep === step.id;
        const stepObs = OBSERVATIONS.filter(o => o.stepId === step.id);
        const urgCount = stepObs.filter(o => o.severity === 'urg').length;

        return React.createElement('div', { key: step.id, style: {
          background: 'var(--surface)', border: `1px solid ${selectedSignal && OBSERVATIONS.find(o => o.id === selectedSignal)?.stepId === step.id ? 'var(--blue)' : 'var(--border)'}`,
          borderRadius: 10, overflow: 'hidden', transition: 'border-color .2s',
        } },
          /* Header */
          React.createElement('div', {
            onClick: () => setExpandedStep(isExpanded ? null : step.id),
            style: { padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }
          },
            React.createElement('span', { style: { width: 22, height: 22, borderRadius: '50%', background: 'var(--t1)', color: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 } }, step.id),
            React.createElement('span', { style: { fontSize: 13, fontWeight: 700 } }, step.name),
            /* Mini component dots */
            React.createElement('div', { style: { display: 'flex', gap: 3, marginLeft: 4 } },
              step.components.map(comp => {
                const ct = COMP_TYPES[comp.type];
                const isActive = comp.status === 'active';
                const isHighlighted = selectedSignal && OBSERVATIONS.find(o => o.id === selectedSignal)?.componentId === comp.id;
                return React.createElement('div', { key: comp.id, style: {
                  width: isActive ? 'auto' : 16, height: 16, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isHighlighted ? ct.color : isActive ? ct.bg : comp.status === 'done' ? 'var(--green-bg)' : 'var(--surface2)',
                  padding: isActive ? '0 5px' : 0, gap: 3, transition: 'all .2s',
                  outline: isHighlighted ? `2px solid ${ct.color}` : 'none', outlineOffset: 1,
                } },
                  React.createElement('span', { style: { fontSize: 8, fontWeight: 700, color: isHighlighted ? '#fff' : isActive ? ct.color : comp.status === 'done' ? 'var(--green)' : 'var(--t3)' } },
                    ct.label[0]),
                  isActive && React.createElement('span', { style: { fontSize: 8, fontWeight: 600, color: ct.color } },
                    comp.students.stuck > 0 ? `⚠${comp.students.stuck}` : '●'),
                );
              }),
            ),
            urgCount > 0 && React.createElement('span', { style: { marginLeft: 'auto', fontSize: 9, fontWeight: 700, color: '#fff', background: 'var(--red)', padding: '1px 5px', borderRadius: 3 } }, urgCount),
            React.createElement('span', { style: { marginLeft: urgCount > 0 ? 4 : 'auto', fontSize: 8, color: 'var(--t3)', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform .15s' } }, '▶'),
          ),

          /* Expanded */
          isExpanded && React.createElement('div', { style: { padding: '0 14px 12px', borderTop: '1px solid var(--border)', paddingTop: 10 } },
            step.components.map(comp => {
              const ct = COMP_TYPES[comp.type];
              const total = comp.students.done + comp.students.prog + comp.students.stuck;
              const alerts = OBSERVATIONS.filter(o => o.componentId === comp.id);
              const isHighlighted = selectedSignal && alerts.some(a => a.id === selectedSignal);

              return React.createElement('div', { key: comp.id, style: {
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, marginBottom: 4,
                background: isHighlighted ? ct.bg : 'transparent', transition: 'background .2s',
                borderLeft: `3px solid ${comp.status === 'active' ? ct.color : comp.status === 'done' ? 'var(--green)' : 'var(--surface2)'}`,
              } },
                React.createElement('span', { style: { fontSize: 9, fontWeight: 700, color: ct.color, width: 28, flexShrink: 0 } }, ct.label),
                React.createElement('span', { style: { fontSize: 10, fontWeight: 500, color: 'var(--t1)', flex: 1 } }, comp.label),
                total > 0 && React.createElement('div', { style: { display: 'flex', height: 10, width: 60, borderRadius: 2, overflow: 'hidden', background: 'var(--surface2)', flexShrink: 0 } },
                  comp.students.done > 0 && React.createElement('div', { style: { width: `${comp.students.done / 42 * 100}%`, background: 'var(--green)', height: '100%' } }),
                  comp.students.prog > 0 && React.createElement('div', { style: { width: `${comp.students.prog / 42 * 100}%`, background: 'var(--blue)', height: '100%' } }),
                  comp.students.stuck > 0 && React.createElement('div', { style: { width: `${comp.students.stuck / 42 * 100}%`, background: 'var(--amber)', height: '100%' } }),
                ),
                alerts.length > 0 && React.createElement('span', { style: {
                  fontSize: 8, fontWeight: 700, width: 16, height: 16, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: alerts.some(a => a.severity === 'urg') ? 'var(--red)' : 'var(--amber)', color: '#fff', flexShrink: 0,
                } }, alerts.length),
              );
            }),
          ),
        );
      }),
    ),

    /* ── Right: Signal stream ── */
    React.createElement('div', { style: { borderLeft: '1px solid var(--border)', background: 'var(--surface)', overflowY: 'auto', display: 'flex', flexDirection: 'column' } },
      React.createElement('div', { style: { padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: 10, fontWeight: 700, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '.3px' } }, '信号流'),
      React.createElement('div', { style: { padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 } },
        OBSERVATIONS.map(obs => {
          const step = STEPS.find(s => s.id === obs.stepId);
          const comp = step?.components.find(c => c.id === obs.componentId);
          const ct = comp ? COMP_TYPES[comp.type] : null;
          const isSelected = selectedSignal === obs.id;

          return React.createElement('div', { key: obs.id,
            onClick: () => { setSelectedSignal(isSelected ? null : obs.id); setExpandedStep(obs.stepId); },
            style: {
              padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
              background: isSelected ? 'var(--bg)' : 'transparent',
              border: `1px solid ${isSelected ? 'var(--border-strong, rgba(28,28,26,.14))' : 'transparent'}`,
              transition: 'all .15s',
            }
          },
            /* Breadcrumb */
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 3, marginBottom: 4, fontSize: 8 } },
              React.createElement('span', { style: { fontWeight: 700, color: 'var(--t3)' } }, `T${step.id}`),
              React.createElement('span', { style: { color: 'var(--t3)' } }, '·'),
              ct && React.createElement('span', { style: { fontWeight: 700, color: ct.color } }, ct.label),
              React.createElement('span', { style: { marginLeft: 'auto', color: 'var(--t3)' } }, obs.time),
            ),
            React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', gap: 5 } },
              React.createElement('span', { style: { width: 6, height: 6, borderRadius: '50%', marginTop: 4, flexShrink: 0,
                background: obs.severity === 'urg' ? 'var(--red)' : obs.severity === 'warn' ? 'var(--amber)' : 'var(--t3)',
              } }),
              React.createElement('span', { style: { fontSize: 10, fontWeight: 600, color: 'var(--t1)', lineHeight: 1.4 } }, obs.title),
            ),
            React.createElement('div', { style: { display: 'flex', gap: 3, marginTop: 4, marginLeft: 11 } },
              obs.students.slice(0, 3).map(name => React.createElement('span', { key: name, style: { fontSize: 8, fontWeight: 600, color: 'var(--t2)', background: 'var(--surface2)', padding: '1px 4px', borderRadius: 2 } }, name)),
              obs.students.length > 3 && React.createElement('span', { style: { fontSize: 8, color: 'var(--t3)' } }, `+${obs.students.length - 3}`),
            ),
          );
        }),
      ),
    ),
  );
}


/* ═══ ROOT ═══ */
function App() {
  return React.createElement(window.DesignCanvas, null,
    /* ── Section: Component 感知方案 ── */
    React.createElement(window.DCSection, { id: 'component-obs', title: 'Step 内 Component 感知 × Observation 联动' },

      React.createElement(window.DCArtboard, { id: 'opt-a', label: 'A · Step 卡片内嵌 Component 子进度', width: 480, height: 820 },
        React.createElement(OptionA),
      ),

      React.createElement(window.DCArtboard, { id: 'opt-b', label: 'B · Observation 面板 Component 感知信号', width: 420, height: 780 },
        React.createElement(OptionB),
      ),

      React.createElement(window.DCArtboard, { id: 'opt-c', label: 'C · 整合视图：Step×Component + 信号流联动', width: 760, height: 700 },
        React.createElement(OptionC),
      ),
    ),
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
