/* teacher-gd-app.jsx — Teacher Observation for Guided Discovery 平方差公式 */
const { useState, useRef, useEffect, useCallback, Fragment } = React;

/* ═══ Mock Data ═══ */
const STEPS = [
  { id: 'observe', num: 1, label: '观察规律', short: '观察' },
  { id: 'symbolize', num: 2, label: '符号表示', short: '符号' },
  { id: 'verify', num: 3, label: '验证公式', short: '验证' },
  { id: 'verbalize', num: 4, label: '文字描述', short: '文字' },
];

/* Student data: step = current step (0-3 = working on that step, 4 = all done) */
const S = [
  { id:1,  n:'陈昕妍', step:4, t:285, answers: { observe: {c1a:0,c1b:1,c2a:0,c2b:1}, symbolize: {left:'(a+b)(a-b)',right:'a²-b²'}, verify: 'a²-b²', verbalize: {b1:'和',b2:'差'} }, attempts: {observe:1,symbolize:1,verify:1,verbalize:1} },
  { id:2,  n:'李奕辰', step:4, t:312, answers: { observe: {c1a:0,c1b:1,c2a:0,c2b:1}, symbolize: {left:'(a+b)(a-b)',right:'a²-b²'}, verify: 'a²-b²', verbalize: {b1:'和',b2:'差'} }, attempts: {observe:1,symbolize:2,verify:1,verbalize:1} },
  { id:3,  n:'王译文', step:3, t:null, answers: { observe: {c1a:0,c1b:1,c2a:0,c2b:1}, symbolize: {left:'(a+b)(a-b)',right:'a²-b²'}, verify: null }, attempts: {observe:2,symbolize:1,verify:0} },
  { id:4,  n:'张皓月', step:4, t:198, answers: { observe: {c1a:0,c1b:1,c2a:0,c2b:1}, symbolize: {left:'(a-b)(a+b)',right:'a²-b²'}, verify: 'a²-b²', verbalize: {b1:'和',b2:'差'} }, attempts: {observe:1,symbolize:1,verify:1,verbalize:1} },
  { id:5,  n:'刘子墨', step:2, t:null, answers: { observe: {c1a:0,c1b:1,c2a:0,c2b:1}, symbolize: null }, attempts: {observe:1,symbolize:0} },
  { id:6,  n:'赵雪莉', step:0, t:null, answers: {}, attempts: {} },
  { id:7,  n:'孙楠语', step:4, t:487, answers: { observe: {c1a:0,c1b:1,c2a:0,c2b:1}, symbolize: {left:'(a+b)(a-b)',right:'a²-b²'}, verify: 'a²-b²', verbalize: {b1:'和',b2:'差'} }, attempts: {observe:1,symbolize:1,verify:2,verbalize:1} },
  { id:8,  n:'周航宇', step:4, t:245, answers: { observe: {c1a:0,c1b:1,c2a:0,c2b:1}, symbolize: {left:'(a+b)(a-b)',right:'a²-b²'}, verify: 'a²-b²', verbalize: {b1:'和',b2:'差'} }, attempts: {observe:1,symbolize:1,verify:1,verbalize:1} },
  { id:9,  n:'吴思涵', step:1, t:null, answers: { observe: {c1a:0,c1b:0,c2a:0,c2b:1} }, attempts: {observe:0} },
  { id:10, n:'郑若曦', step:4, t:398, answers: { observe: {c1a:0,c1b:1,c2a:0,c2b:1}, symbolize: {left:'(a+b)(a-b)',right:'a²-b²'}, verify: 'a²-b²', verbalize: {b1:'和',b2:'差'} }, attempts: {observe:1,symbolize:1,verify:1,verbalize:2} },
  { id:11, n:'黄婉晴', step:2, t:null, answers: { observe: {c1a:0,c1b:1,c2a:0,c2b:1}, symbolize: {left:'(a+b)(a-b)',right:'b²-a²'} }, attempts: {observe:1,symbolize:1}, errors: {symbolize:'写成 b²-a² 顺序颠倒'} },
  { id:12, n:'马乐瑶', step:4, t:210, answers: { observe: {c1a:0,c1b:1,c2a:0,c2b:1}, symbolize: {left:'(a+b)(a-b)',right:'a²-b²'}, verify: 'a²-b²', verbalize: {b1:'和',b2:'差'} }, attempts: {observe:1,symbolize:1,verify:1,verbalize:1} },
  { id:13, n:'胡恩齐', step:1, t:null, answers: { observe: {c1a:0,c1b:1,c2a:1,c2b:0} }, attempts: {observe:0}, errors: {observe:'c2a/c2b 选反'} },
  { id:14, n:'林澜',   step:4, t:510, answers: { observe: {c1a:0,c1b:1,c2a:0,c2b:1}, symbolize: {left:'(a+b)(a-b)',right:'a²-b²'}, verify: 'a²-b²', verbalize: {b1:'和',b2:'差'} }, attempts: {observe:2,symbolize:2,verify:1,verbalize:1} },
  { id:15, n:'徐晨曦', step:4, t:278, answers: { observe: {c1a:0,c1b:1,c2a:0,c2b:1}, symbolize: {left:'(a+b)(a-b)',right:'a²-b²'}, verify: 'a²-b²', verbalize: {b1:'和',b2:'差'} }, attempts: {observe:1,symbolize:1,verify:1,verbalize:1} },
  { id:16, n:'高远航', step:4, t:445, answers: { observe: {c1a:0,c1b:1,c2a:0,c2b:1}, symbolize: {left:'(a+b)(a-b)',right:'a²-b²'}, verify: 'a²-b²', verbalize: {b1:'差',b2:'和'} }, attempts: {observe:1,symbolize:1,verify:1,verbalize:2}, errors: {verbalize:'和/差填反'} },
  { id:17, n:'朱思语', step:4, t:189, answers: { observe: {c1a:0,c1b:1,c2a:0,c2b:1}, symbolize: {left:'(a+b)(a-b)',right:'a²-b²'}, verify: 'a²-b²', verbalize: {b1:'和',b2:'差'} }, attempts: {observe:1,symbolize:1,verify:1,verbalize:1} },
  { id:18, n:'何子睿', step:0, t:null, answers: {}, attempts: {} },
  { id:19, n:'郭斐然', step:3, t:null, answers: { observe: {c1a:0,c1b:1,c2a:0,c2b:1}, symbolize: {left:'(a+b)(a-b)',right:'a²-b²'}, verify: 'a-b' }, attempts: {observe:1,symbolize:1,verify:1}, errors: {verify:'填写 a-b 而非 a²-b²'} },
  { id:20, n:'罗婉儿', step:2, t:null, answers: { observe: {c1a:0,c1b:1,c2a:0,c2b:1}, symbolize: null }, attempts: {observe:1,symbolize:0} },
  { id:21, n:'曾以柔', step:4, t:325, answers: { observe: {c1a:0,c1b:1,c2a:0,c2b:1}, symbolize: {left:'(a+b)(a-b)',right:'a²-b²'}, verify: 'a²-b²', verbalize: {b1:'和',b2:'差'} }, attempts: {observe:1,symbolize:1,verify:1,verbalize:1} },
  { id:22, n:'蔡明轩', step:4, t:410, answers: { observe: {c1a:0,c1b:1,c2a:0,c2b:1}, symbolize: {left:'(a+b)(a-b)',right:'a²-b²'}, verify: 'a²-b²', verbalize: {b1:'和',b2:'差'} }, attempts: {observe:1,symbolize:1,verify:1,verbalize:1} },
  { id:23, n:'邓梓涵', step:1, t:null, answers: { observe: {c1a:1,c1b:0,c2a:0,c2b:1} }, attempts: {observe:0}, errors: {observe:'c1a/c1b 选反'} },
  { id:24, n:'程一帆', step:4, t:530, answers: { observe: {c1a:0,c1b:1,c2a:0,c2b:1}, symbolize: {left:'(a+b)(a-b)',right:'a²-b²'}, verify: 'a²-b²', verbalize: {b1:'和',b2:'差'} }, attempts: {observe:2,symbolize:2,verify:2,verbalize:2} },
  { id:25, n:'韩思远', step:4, t:156, answers: { observe: {c1a:0,c1b:1,c2a:0,c2b:1}, symbolize: {left:'(a+b)(a-b)',right:'a²-b²'}, verify: 'a²-b²', verbalize: {b1:'和',b2:'差'} }, attempts: {observe:1,symbolize:1,verify:1,verbalize:1} },
  { id:26, n:'董思齐', step:3, t:null, answers: { observe: {c1a:0,c1b:1,c2a:0,c2b:1}, symbolize: {left:'(a+b)(a-b)',right:'a²-b²'}, verify: null }, attempts: {observe:1,symbolize:1,verify:0} },
  { id:27, n:'袁朗',   step:2, t:null, answers: { observe: {c1a:0,c1b:1,c2a:0,c2b:1}, symbolize: {left:'(a+b)(a-b)',right:'b²-a²'} }, attempts: {observe:1,symbolize:1}, errors: {symbolize:'顺序颠倒 b²-a²'} },
  { id:28, n:'谢宇航', step:4, t:267, answers: { observe: {c1a:0,c1b:1,c2a:0,c2b:1}, symbolize: {left:'(a+b)(a-b)',right:'a²-b²'}, verify: 'a²-b²', verbalize: {b1:'和',b2:'差'} }, attempts: {observe:1,symbolize:1,verify:1,verbalize:1} },
  { id:29, n:'唐诗雅', step:4, t:495, answers: { observe: {c1a:0,c1b:1,c2a:0,c2b:1}, symbolize: {left:'(a+b)(a-b)',right:'a²-b²'}, verify: 'a²-b²', verbalize: {b1:'和',b2:'差'} }, attempts: {observe:2,symbolize:1,verify:1,verbalize:1} },
  { id:30, n:'姚明泽', step:1, t:null, answers: { observe: {c1a:0,c1b:1,c2a:0,c2b:0} }, attempts: {observe:0}, errors: {observe:'c2b 选错'} },
  { id:31, n:'彭雨萱', step:4, t:478, answers: { observe: {c1a:0,c1b:1,c2a:0,c2b:1}, symbolize: {left:'(a+b)(a-b)',right:'a²-b²'}, verify: 'a²-b²', verbalize: {b1:'差',b2:'和'} }, attempts: {observe:1,symbolize:1,verify:1,verbalize:2}, errors: {verbalize:'和/差填反后修正'} },
  { id:32, n:'潘若水', step:4, t:340, answers: { observe: {c1a:0,c1b:1,c2a:0,c2b:1}, symbolize: {left:'(a+b)(a-b)',right:'a²-b²'}, verify: 'a²-b²', verbalize: {b1:'和',b2:'差'} }, attempts: {observe:1,symbolize:1,verify:1,verbalize:1} },
  { id:33, n:'冯子涵', step:0, t:null, answers: {}, attempts: {} },
  { id:34, n:'贾小诺', step:4, t:515, answers: { observe: {c1a:0,c1b:1,c2a:0,c2b:1}, symbolize: {left:'(a+b)(a-b)',right:'a²-b²'}, verify: 'a²-b²', verbalize: {b1:'和',b2:'差'} }, attempts: {observe:2,symbolize:2,verify:2,verbalize:2} },
  { id:35, n:'夏天依', step:4, t:223, answers: { observe: {c1a:0,c1b:1,c2a:0,c2b:1}, symbolize: {left:'(a+b)(a-b)',right:'a²-b²'}, verify: 'a²-b²', verbalize: {b1:'和',b2:'差'} }, attempts: {observe:1,symbolize:1,verify:1,verbalize:1} },
  { id:36, n:'石嘉禾', step:2, t:null, answers: { observe: {c1a:0,c1b:1,c2a:0,c2b:1}, symbolize: null }, attempts: {observe:1,symbolize:0} },
  { id:37, n:'钟意',   step:4, t:402, answers: { observe: {c1a:0,c1b:1,c2a:0,c2b:1}, symbolize: {left:'(a+b)(a-b)',right:'a²-b²'}, verify: 'a²-b²', verbalize: {b1:'和',b2:'差'} }, attempts: {observe:1,symbolize:1,verify:1,verbalize:1} },
  { id:38, n:'方晓晨', step:4, t:295, answers: { observe: {c1a:0,c1b:1,c2a:0,c2b:1}, symbolize: {left:'(a+b)(a-b)',right:'a²-b²'}, verify: 'a²-b²', verbalize: {b1:'和',b2:'差'} }, attempts: {observe:1,symbolize:1,verify:1,verbalize:1} },
  { id:39, n:'丁一凡', step:1, t:null, answers: { observe: {c1a:0,c1b:1,c2a:0,c2b:1} }, attempts: {observe:0} },
  { id:40, n:'秦若兰', step:4, t:460, answers: { observe: {c1a:0,c1b:1,c2a:0,c2b:1}, symbolize: {left:'(a+b)(a-b)',right:'a²-b²'}, verify: 'a²-b²', verbalize: {b1:'和',b2:'差'} }, attempts: {observe:1,symbolize:1,verify:1,verbalize:1} },
  { id:41, n:'田佳怡', step:4, t:310, answers: { observe: {c1a:0,c1b:1,c2a:0,c2b:1}, symbolize: {left:'(a+b)(a-b)',right:'a²-b²'}, verify: 'a²-b²', verbalize: {b1:'和',b2:'差'} }, attempts: {observe:1,symbolize:1,verify:1,verbalize:1} },
  { id:42, n:'严子轩', step:0, t:null, answers: {}, attempts: {} },
];

/* Derived stats */
const total = S.length;
const completed = S.filter(s => s.step === 4);
const idle = S.filter(s => s.step === 0);
const inProgress = S.filter(s => s.step > 0 && s.step < 4);
const atStep = (n) => S.filter(s => s.step === n);

function fmtTime(sec) { if (!sec) return '—'; return Math.floor(sec/60) + ':' + String(sec%60).padStart(2,'0'); }

/* Step-level stats */
function getStepStats(stepIdx) {
  // Students who have completed this step or beyond
  const passedThisStep = S.filter(s => s.step > stepIdx);
  // Students currently at this step
  const atThisStep = S.filter(s => s.step === stepIdx);
  // Students who had >1 attempt on this step
  const stepKey = STEPS[stepIdx].id;
  const withRetries = passedThisStep.filter(s => s.attempts[stepKey] && s.attempts[stepKey] > 1);
  return { passed: passedThisStep.length, current: atThisStep.length, retries: withRetries.length };
}

/* ═══ Step Funnel ═══ */
function StepFunnel() {
  const stats = STEPS.map((_, i) => getStepStats(i));
  const maxBar = total;

  return (
    <div className="funnel">
      {STEPS.map((step, i) => {
        const st = stats[i];
        const passedPct = (st.passed / maxBar * 100);
        const currentPct = (st.current / maxBar * 100);
        return (
          <div key={step.id} className="funnel-row">
            <div className="funnel-label">
              <span className="funnel-num">{step.num}</span>
              <span className="funnel-name">{step.short}</span>
            </div>
            <div className="funnel-bar-wrap">
              <div className="funnel-bar funnel-passed" style={{ width: passedPct + '%' }}></div>
              <div className="funnel-bar funnel-current" style={{ width: currentPct + '%', left: passedPct + '%' }}></div>
            </div>
            <div className="funnel-nums">
              <span className="funnel-pass-n">{st.passed}</span>
              {st.current > 0 && <span className="funnel-curr-n">+{st.current}</span>}
            </div>
          </div>
        );
      })}
      <div className="funnel-legend">
        <span className="funnel-leg-item"><span className="funnel-leg-dot passed"></span>已通过</span>
        <span className="funnel-leg-item"><span className="funnel-leg-dot current"></span>当前作答</span>
      </div>
    </div>
  );
}

/* ═══ Per-Step Detail Cards ═══ */
function StepDetailCards() {
  const errorsByStep = {
    observe: [],
    symbolize: [],
    verify: [],
    verbalize: [],
  };

  S.forEach(s => {
    if (s.errors) {
      Object.entries(s.errors).forEach(([stepId, desc]) => {
        errorsByStep[stepId].push({ name: s.n, desc });
      });
    }
  });

  // Group errors by description
  const groupErrors = (errs) => {
    const map = {};
    errs.forEach(e => {
      const key = e.desc.replace(e.name, '').trim();
      if (!map[key]) map[key] = { desc: e.desc, names: [] };
      map[key].names.push(e.name);
    });
    return Object.values(map);
  };

  const stepDetails = STEPS.map((step, i) => {
    const st = getStepStats(i);
    const errs = groupErrors(errorsByStep[step.id]);
    const retriesCount = S.filter(s => s.attempts[step.id] && s.attempts[step.id] > 1).length;
    return { ...step, ...st, errors: errs, retriesCount };
  });

  return (
    <div className="step-details">
      {stepDetails.map(sd => (
        <div key={sd.id} className="sd-card">
          <div className="sd-hd">
            <span className="sd-num">{sd.num}</span>
            <span className="sd-name">{sd.label}</span>
            <span className="sd-stat">
              <span className="sd-pass">{sd.passed}通过</span>
              {sd.current > 0 && <span className="sd-curr">{sd.current}人作答中</span>}
            </span>
          </div>
          {sd.retriesCount > 0 && (
            <div className="sd-retry-info">
              <span className="sd-retry-badge">{sd.retriesCount}人</span> 多次尝试
            </div>
          )}
          {sd.errors.length > 0 && (
            <div className="sd-errors">
              {sd.errors.map((e, ei) => (
                <div key={ei} className="sd-err-row">
                  <span className="sd-err-badge">{e.names.length}人</span>
                  <span className="sd-err-desc">{e.desc}</span>
                  <span className="sd-err-names">{e.names.join(' · ')}</span>
                </div>
              ))}
            </div>
          )}
          {sd.errors.length === 0 && sd.retriesCount === 0 && (
            <div className="sd-ok">暂无错误</div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ═══ Student List ═══ */
function StudentList({ filter, onSelect }) {
  let list = S;
  if (filter === 'done') list = completed;
  else if (filter === 'prog') list = inProgress;
  else if (filter === 'idle') list = idle;
  else if (filter === 'err') list = S.filter(s => s.errors && Object.keys(s.errors).length > 0);

  return (
    <div className="stu-list">
      {list.map(s => (
        <div key={s.id} className={'sl-row ' + (s.step === 0 ? 'idle' : '')} onClick={() => onSelect(s)}>
          <span className={'sl-dot ' + (s.step === 4 ? 'done' : s.step === 0 ? 'idle' : 'prog')}></span>
          <span className="sl-name">{s.n}</span>
          {s.step === 4 && <span className="sl-ok">✓</span>}
          {s.step > 0 && s.step < 4 && (
            <span className="sl-step-tag">第{s.step}步</span>
          )}
          {s.errors && Object.keys(s.errors).length > 0 && <span className="sl-err-dot">●</span>}
        </div>
      ))}
    </div>
  );
}

/* ═══ Student Modal ═══ */
function StudentModal({ student, onClose }) {
  if (!student) return null;
  const s = student;

  const stepLabels = { observe: '观察规律', symbolize: '符号表示', verify: '验证公式', verbalize: '文字描述' };
  const choiceNames = { c1a: '相同项称为', c1b: '相反项称为', c2a: '结果=□的平方', c2b: '减□的平方' };
  const correctChoices = { c1a: 0, c1b: 1, c2a: 0, c2b: 1 };

  const renderStepAnswer = (stepId) => {
    const ans = s.answers[stepId];
    if (ans == null) return <span className="mod-empty">尚未作答</span>;

    if (stepId === 'observe') {
      return (
        <div className="mod-choices">
          {Object.entries(ans).map(([k, v]) => {
            const correct = v === correctChoices[k];
            return (
              <div key={k} className={'mod-choice-row ' + (correct ? 'ok' : 'err')}>
                <span className="mod-choice-label">{choiceNames[k]}</span>
                <span className="mod-choice-val">{v === 0 ? '相同项' : '相反项'}</span>
                <span className="mod-choice-icon">{correct ? '✓' : '✗'}</span>
              </div>
            );
          })}
        </div>
      );
    }
    if (stepId === 'symbolize') {
      return <div className="mod-formula">{ans.left} = {ans.right}</div>;
    }
    if (stepId === 'verify') {
      return <div className="mod-formula">(a+b)(a-b) = a² - ab + ab - b² = {ans}</div>;
    }
    if (stepId === 'verbalize') {
      return <div className="mod-text-ans">两个数的「{ans.b1}」与这两个数的「{ans.b2}」的乘积…</div>;
    }
  };

  return (
    <div className="overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="mod-hd">
          <div className="mod-av">{s.n[0]}</div>
          <div className="mod-ti">
            <div className="mod-ti-n">{s.n}</div>
            <div className="mod-ti-m">
              {s.step === 4 ? '已完成全部' : s.step === 0 ? '未开始' : '当前：第' + s.step + '步 ' + stepLabels[STEPS[s.step - 1]?.id]}
              {s.t && (' · 用时 ' + fmtTime(s.t))}
            </div>
          </div>
          <div className="mod-cls" onClick={onClose}>关闭 ✕</div>
        </div>

        <div className="mod-body">
          {/* Left: Per-step answers */}
          <div className="mod-col">
            <div className="mod-h">各步骤作答</div>
            {STEPS.map((step, i) => {
              const isActive = s.step > i || s.step === 4;
              const isCurrent = s.step === i;
              const att = s.attempts[step.id];
              return (
                <div key={step.id} className={'mod-step-card' + (isActive ? ' done' : '') + (isCurrent ? ' current' : '') + (!isActive && !isCurrent ? ' locked' : '')}>
                  <div className="mod-step-hd">
                    <span className={'mod-step-num' + (isActive ? ' done' : '') + (isCurrent ? ' active' : '')}>
                      {isActive ? '✓' : step.num}
                    </span>
                    <span className="mod-step-label">{step.label}</span>
                    {att > 1 && <span className="mod-retry-tag">{att}次尝试</span>}
                  </div>
                  <div className="mod-step-body">
                    {isActive || isCurrent ? renderStepAnswer(step.id) : <span className="mod-empty">未到达</span>}
                  </div>
                  {s.errors && s.errors[step.id] && (
                    <div className="mod-step-err">
                      <span className="mod-err-dot"></span>{s.errors[step.id]}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right: Summary */}
          <div className="mod-col right">
            <div className="mod-section">
              <div className="mod-h">完成进度</div>
              <div className="mod-progress-visual">
                {STEPS.map((step, i) => (
                  <div key={step.id} className={'mod-prog-step' + (s.step > i ? ' done' : '') + (s.step === i ? ' active' : '')}>
                    <span className="mod-prog-dot">{s.step > i ? '✓' : step.num}</span>
                    <span className="mod-prog-label">{step.short}</span>
                  </div>
                ))}
              </div>
            </div>

            {s.step === 4 && (
              <div className="mod-section">
                <div className="mod-h">完成情况</div>
                <div className="mod-verdict correct">
                  <span className="verdict-icon">✓</span>
                  <span className="verdict-text">全部完成</span>
                  <span className="verdict-answer">{fmtTime(s.t)}</span>
                </div>
              </div>
            )}

            <div className="mod-section">
              <div className="mod-h">尝试次数</div>
              <div className="mod-attempts-grid">
                {STEPS.map(step => {
                  const att = s.attempts[step.id];
                  return (
                    <div key={step.id} className="mod-att-item">
                      <span className="mod-att-label">{step.short}</span>
                      <span className={'mod-att-val' + (att > 1 ? ' retry' : '')}>{att || '—'}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {s.errors && Object.keys(s.errors).length > 0 && (
              <div className="mod-section">
                <div className="mod-h">错误记录</div>
                {Object.entries(s.errors).map(([stepId, desc]) => (
                  <div key={stepId} className="mod-error-detail">
                    <span className="err-dot"></span>
                    <strong>{stepLabels[stepId]}：</strong>{desc}
                  </div>
                ))}
              </div>
            )}

            <div className="mod-section">
              <div className="mod-h">AI 助教分析</div>
              <div className="ai-analysis">
                {s.step === 4 ? (
                  <p>该生已完成全部四步引导探究。
                    {Object.values(s.attempts).every(a => a === 1) ? '全部一次通过，概念理解准确。' : '部分步骤经历多次尝试，但最终掌握了平方差公式的推导逻辑。'}
                  </p>
                ) : s.step === 0 ? (
                  <p>该生尚未开始作答，建议关注。</p>
                ) : (
                  <p>该生当前在第{s.step}步「{stepLabels[STEPS[s.step - 1]?.id]}」{s.errors ? '，遇到了困难。' : '，正常进行中。'}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══ Main App ═══ */
function TeacherGDApp() {
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('all');

  const errCount = S.filter(s => s.errors && Object.keys(s.errors).length > 0).length;

  return (
    <div className="app">
      {/* Band */}
      <div className="band">
        <div className="band-mark">T</div>
        <div className="band-title">课堂控制台</div>
        <div className="band-class">初二(3)班 · 多项式乘法 · 平方差公式 · {total} 人</div>
        <div className="band-step">
          <span className="lb">Type</span><span className="num">引导探究</span>
          <span className="sep">·</span>
          <span className="lb">Time</span><span className="num">08:45</span><span className="sl">/</span><span className="tot">15:00</span>
        </div>
      </div>

      <div className="body">
        {/* Focus */}
        <div className="focus">
          <div className="hero">
            <div className="hero-main">
              <div className="hero-eyebrow"><span className="pill">GUIDED DISCOVERY</span>引导探究进行中</div>
              <div className="hero-title">平方差公式<span className="en">(a+b)(a-b) = a²-b²</span></div>
              <div className="hero-brief">学生通过<strong>观察 → 符号化 → 验证 → 语言化</strong>四步递进发现平方差公式。每步即时反馈，选错/填错可重试。</div>
            </div>
            <div className="hero-side">
              <div className="hs-pair"><span className="hs-lb">已完成</span><span className="hs-v"><span className="n">{completed.length}</span><span className="sl">/</span><span className="tot">{total}</span></span></div>
              <div className="hs-pair"><span className="hs-lb">平均用时</span><span className="hs-v"><span className="n">{fmtTime(Math.round(completed.reduce((a,s)=>a+s.t,0)/completed.length))}</span></span></div>
            </div>
          </div>

          {/* Step funnel */}
          <div className="section-hd">
            <span className="section-label">步骤进度漏斗</span>
            <span className="section-meta">{completed.length} 人完成全部 · {inProgress.length} 人进行中 · {idle.length} 人未开始</span>
          </div>
          <div className="stat-card" style={{ marginBottom: 20 }}>
            <StepFunnel />
          </div>

          {/* Per-step details */}
          <div className="section-hd">
            <span className="section-label">各步骤详情</span>
            <span className="section-meta">错误聚类 + 重试分布</span>
          </div>
          <StepDetailCards />

          {/* Teacher suggestion */}
          <div className="teacher-line">
            <div className="line-lb">建议讲解要点</div>
            <div className="line-text">
              <strong>第2步"符号表示"是主要瓶颈：</strong>部分学生写成 <span className="k">b²-a²</span>（顺序颠倒），建议在黑板上强调等号右边必须是 <span className="k">a²-b²</span>，与左边 (a+b)(a-b) 中 a 的位置对应。<br />
              <strong>第4步"文字描述"：</strong>有学生把"和"与"差"填反，建议带领全班朗读一遍公式的文字表述。
            </div>
          </div>

          {/* Actions */}
          <div className="actions">
            <button className="btn ghost">← 上一题</button>
            <button className="btn">延长 2 min</button>
            <button className="btn">推送提示</button>
            <div style={{ flex: 1 }}></div>
            <button className="btn pri">下一题 →</button>
          </div>
        </div>

        {/* Overview */}
        <div className="overview">
          <div className="pulse">
            <div className="pulse-cell">
              <div className="pulse-n">{completed.length}</div>
              <div className="pulse-row"><span className="pulse-dot done"></span><span className="pulse-lb">已完成</span></div>
            </div>
            <div className="pulse-cell">
              <div className="pulse-n">{inProgress.length}</div>
              <div className="pulse-row"><span className="pulse-dot prog"></span><span className="pulse-lb">进行中</span></div>
            </div>
            <div className="pulse-cell">
              <div className="pulse-n">{idle.length}</div>
              <div className="pulse-row"><span className="pulse-dot idle"></span><span className="pulse-lb">未开始</span></div>
            </div>
          </div>

          <div className="q-filter">
            {[
              { key: 'all', label: '全部', n: total },
              { key: 'done', label: '已完成', n: completed.length },
              { key: 'err', label: '有错误', n: errCount },
              { key: 'prog', label: '进行中', n: inProgress.length },
            ].map(f => (
              <button key={f.key} className={'q-chip' + (filter === f.key ? ' act' : '')} onClick={() => setFilter(f.key)}>
                {f.label}<span className="chip-n">{f.n}</span>
              </button>
            ))}
          </div>

          <div className="stu-scroll">
            <StudentList filter={filter} onSelect={setSelected} />
          </div>
        </div>
      </div>

      <StudentModal student={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<TeacherGDApp />);
