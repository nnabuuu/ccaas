/* ═══════════════════════════════════════════════════════════
   Teacher Console v7 — Left Sidebar (Step Navigation)
   Each step is a compact item showing:
   - Step number + name + type
   - Component mini-pills
   - Alert count badges (urg/warn)
   - Overall progress bar
   "全局" item at top for overview mode
   ═══════════════════════════════════════════════════════════ */

function StepSidebar({ selectedStepId, onSelectStep }) {
  const getStepAlerts = (stepId) => OBSERVATIONS.filter(o => o.stepId === stepId);
  const getStepStatus = (step) => {
    if (step.components.every(c => c.status === 'done')) return 'done';
    if (step.components.every(c => c.status === 'future' || c.status === 'waiting')) return 'future';
    return 'active';
  };

  const totalAlerts = OBSERVATIONS.length;
  const urgAlerts = OBSERVATIONS.filter(o => o.severity === 'urg').length;

  return React.createElement('div', {
    style: {
      width: 220, flexShrink: 0, background: 'var(--surface)',
      borderRight: '1px solid var(--border)', display: 'flex',
      flexDirection: 'column', overflow: 'hidden',
    }
  },
    /* Header */
    React.createElement('div', {
      style: {
        padding: '14px 16px 10px', fontSize: 9, fontWeight: 600,
        color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.5px',
      }
    }, '课堂进程'),

    /* Scrollable list */
    React.createElement('div', {
      style: { flex: 1, overflowY: 'auto', padding: '0 8px 12px', display: 'flex', flexDirection: 'column', gap: 3 }
    },

      /* Global overview item */
      React.createElement('div', {
        onClick: () => onSelectStep(null),
        style: {
          padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
          background: selectedStepId === null ? 'var(--bg)' : 'transparent',
          border: `1px solid ${selectedStepId === null ? 'var(--border-strong)' : 'transparent'}`,
          transition: 'all .15s',
        },
        onMouseEnter: e => { if (selectedStepId !== null) e.currentTarget.style.background = 'var(--surface2)'; },
        onMouseLeave: e => { if (selectedStepId !== null) e.currentTarget.style.background = 'transparent'; },
      },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          React.createElement('span', {
            style: {
              width: 22, height: 22, borderRadius: 6,
              background: selectedStepId === null ? 'var(--t1)' : 'var(--surface2)',
              color: selectedStepId === null ? 'var(--surface)' : 'var(--t2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700, flexShrink: 0,
            }
          }, '◉'),
          React.createElement('div', { style: { flex: 1, minWidth: 0 } },
            React.createElement('div', { style: { fontSize: 12, fontWeight: 700, color: 'var(--t1)' } }, '全局总览'),
            React.createElement('div', { style: { fontSize: 10, color: 'var(--t3)', marginTop: 1 } }, `${totalAlerts} 信号`),
          ),
          urgAlerts > 0 && React.createElement('span', {
            style: {
              fontSize: 9, fontWeight: 700, minWidth: 18, height: 18,
              borderRadius: 9, display: 'flex', alignItems: 'center',
              justifyContent: 'center', padding: '0 5px',
              background: 'var(--red)', color: '#fff', flexShrink: 0,
            }
          }, urgAlerts),
        ),
      ),

      /* Divider */
      React.createElement('div', { style: { height: 1, background: 'var(--border)', margin: '4px 6px' } }),

      /* Step items */
      STEPS.map(step => {
        const status = getStepStatus(step);
        const alerts = getStepAlerts(step.id);
        const urgCount = alerts.filter(a => a.severity === 'urg').length;
        const warnCount = alerts.filter(a => a.severity === 'warn').length;
        const isSelected = selectedStepId === step.id;
        const isDone = status === 'done';
        const isFuture = status === 'future';
        const isActive = status === 'active';

        // Compute overall progress for this step
        const totalStudents = step.components.reduce((a, c) => a + c.students.done + c.students.prog + c.students.stuck, 0);
        const doneStudents = step.components.reduce((a, c) => a + c.students.done, 0);
        const progressPct = totalStudents > 0 ? (doneStudents / totalStudents * 100) : (isDone ? 100 : 0);

        return React.createElement('div', {
          key: step.id,
          onClick: () => onSelectStep(step.id),
          style: {
            padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
            background: isSelected ? (urgCount > 0 ? 'rgba(148,41,41,.04)' : 'var(--bg)') : 'transparent',
            border: `1px solid ${isSelected ? (urgCount > 0 ? 'rgba(148,41,41,.15)' : 'var(--border-strong)') : 'transparent'}`,
            opacity: isFuture ? 0.45 : 1,
            transition: 'all .15s',
          },
          onMouseEnter: e => { if (!isSelected) e.currentTarget.style.background = 'var(--surface2)'; },
          onMouseLeave: e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; },
        },
          /* Row 1: Number + Name + Alert badge */
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 } },
            React.createElement('span', {
              style: {
                width: 22, height: 22, borderRadius: '50%', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 10,
                fontWeight: 700, flexShrink: 0,
                background: isDone ? 'var(--green)' : isActive ? 'var(--t1)' : 'var(--surface2)',
                color: isDone ? '#fff' : isActive ? 'var(--surface)' : 'var(--t3)',
              }
            }, isDone ? '✓' : `T${step.id}`),
            React.createElement('div', { style: { flex: 1, minWidth: 0 } },
              React.createElement('div', {
                style: {
                  fontSize: 12, fontWeight: 600,
                  color: isDone ? 'var(--t2)' : 'var(--t1)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }
              }, step.name),
            ),
            /* Alert badges */
            urgCount > 0 && React.createElement('span', {
              style: {
                fontSize: 8, fontWeight: 700, minWidth: 16, height: 16,
                borderRadius: 8, display: 'flex', alignItems: 'center',
                justifyContent: 'center', padding: '0 4px',
                background: 'var(--red)', color: '#fff', flexShrink: 0,
                animation: 'sig-pulse 2s infinite',
              }
            }, urgCount),
            warnCount > 0 && !urgCount && React.createElement('span', {
              style: {
                fontSize: 8, fontWeight: 700, minWidth: 16, height: 16,
                borderRadius: 8, display: 'flex', alignItems: 'center',
                justifyContent: 'center', padding: '0 4px',
                background: 'var(--amber)', color: '#fff', flexShrink: 0,
              }
            }, warnCount),
          ),

          /* Row 2: Type + time */
          React.createElement('div', {
            style: { fontSize: 10, color: 'var(--t3)', marginBottom: 6, paddingLeft: 30 }
          }, `${step.type} · ${step.time}`),

          /* Row 3: Component pills */
          React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 3, paddingLeft: 30 } },
            step.components.map(comp => {
              const ct = COMP_TYPES[comp.type];
              const isCompActive = comp.status === 'active';
              const isCompDone = comp.status === 'done';
              return React.createElement('span', {
                key: comp.id,
                style: {
                  fontSize: 8, fontWeight: 600, padding: '2px 5px', borderRadius: 3,
                  background: isCompDone ? 'var(--green-soft)' : isCompActive ? ct.bg : 'var(--surface2)',
                  color: isCompDone ? 'var(--green)' : isCompActive ? ct.color : 'var(--t3)',
                  border: isCompActive ? `1px solid ${ct.color}20` : '1px solid transparent',
                }
              }, ct.label);
            }),
          ),

          /* Row 4: Mini progress bar (only for active/done) */
          !isFuture && React.createElement('div', {
            style: { display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 30, marginTop: 6 }
          },
            React.createElement('div', {
              style: {
                flex: 1, height: 3, background: 'var(--surface2)',
                borderRadius: 2, overflow: 'hidden',
              }
            },
              React.createElement('div', {
                style: {
                  width: `${progressPct}%`, height: '100%', borderRadius: 2,
                  background: isDone ? 'var(--green)' : 'var(--blue)',
                }
              }),
            ),
            React.createElement('span', {
              style: { fontSize: 8, color: 'var(--t3)', fontWeight: 600, flexShrink: 0 }
            }, isDone ? '完成' : `${Math.round(progressPct)}%`),
          ),
        );
      }),
    ),

    /* Bottom: Time compact */
    React.createElement('div', {
      style: {
        padding: '10px 16px', borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
      }
    },
      React.createElement('div', { style: { fontSize: 18, fontWeight: 700, color: 'var(--t1)', letterSpacing: '-.5px' } }, '18:22'),
      React.createElement('div', { style: { flex: 1 } },
        React.createElement('div', { style: { fontSize: 9, color: 'var(--t3)', marginBottom: 3 } }, '/ 45:00'),
        React.createElement('div', { style: { height: 4, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden' } },
          React.createElement('div', { style: { width: '40.8%', height: '100%', borderRadius: 2, background: 'var(--t1)' } }),
        ),
      ),
      React.createElement('span', {
        style: {
          fontSize: 9, fontWeight: 600, color: 'var(--green)',
          display: 'flex', alignItems: 'center', gap: 4,
        }
      },
        React.createElement('span', { style: { width: 5, height: 5, borderRadius: '50%', background: 'var(--green-dot)', animation: 'pulse-dot 2s infinite' } }),
        '实时',
      ),
    ),
  );
}

Object.assign(window, { StepSidebar });
