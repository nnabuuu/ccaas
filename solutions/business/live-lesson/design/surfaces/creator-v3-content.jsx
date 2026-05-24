/* ════════════════════════════════════════════════
   Creator v3 — Content Tab (restructured with AI field separation)
   ════════════════════════════════════════════════ */

/* ── Shared Field Components ── */
function EditorField({ label, sub, children, style }) {
  return (
    <div style={{ marginBottom: 14, ...style }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', marginBottom: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 9, color: 'var(--t3)', marginBottom: 4 }}>{sub}</div>}
      {children}
    </div>
  );
}
const edInput = {
  width: '100%', padding: '7px 10px', fontSize: 12, fontFamily: 'inherit',
  border: '1px solid var(--border)', borderRadius: 'var(--r-input)',
  background: 'var(--bg)', outline: 'none', color: 'var(--t1)', lineHeight: 1.5,
};
function EditorToggle({ label, checked, onChange }) {
  return (
    <div onClick={() => onChange && onChange(!checked)} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '6px 0', cursor: 'pointer', fontSize: 11, color: 'var(--t2)',
    }}>
      <span>{label}</span>
      <div style={{
        width: 32, height: 18, borderRadius: 9, padding: 2,
        background: checked ? 'var(--green)' : 'var(--surface2)',
        transition: 'background .15s', display: 'flex', alignItems: 'center',
      }}>
        <div style={{
          width: 14, height: 14, borderRadius: '50%', background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,.15)',
          transform: checked ? 'translateX(14px)' : 'translateX(0)',
          transition: 'transform .15s',
        }}></div>
      </div>
    </div>
  );
}
function EditorSegment({ label, options, value, onChange }) {
  return (
    <EditorField label={label}>
      <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', borderRadius: 'var(--r-input)', overflow: 'hidden' }}>
        {options.map(opt => (
          <button key={opt.id} onClick={() => onChange && onChange(opt.id)} style={{
            flex: 1, padding: '6px 8px', fontSize: 10, fontWeight: value === opt.id ? 600 : 400,
            fontFamily: 'inherit', border: 'none', cursor: 'pointer',
            background: value === opt.id ? 'var(--t1)' : 'var(--bg)',
            color: value === opt.id ? 'var(--surface)' : 'var(--t3)',
          }}>{opt.label}</button>
        ))}
      </div>
    </EditorField>
  );
}
function ContentDivider({ label, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '16px 0 10px' }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: color || 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }}></div>
    </div>
  );
}

/* ── Completion Condition Config (reusable across all types) ── */
function CompletionConfig({ block }) {
  const comp = block.completion || { type: 'manual' };
  const [type, setType] = React.useState(comp.type);
  const [timeout, setTimeout] = React.useState(comp.timeoutSec || 600);

  return (
    <div>
      <ContentDivider label="完成条件" color="var(--green)" />
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        {COMPLETION_TYPES.map(ct => (
          <button key={ct.id} onClick={() => setType(ct.id)} style={{
            flex: 1, padding: '8px 6px', fontSize: 10, fontWeight: type === ct.id ? 600 : 400,
            fontFamily: 'inherit', borderRadius: 6, cursor: 'pointer',
            border: type === ct.id ? '1.5px solid var(--t1)' : '1.5px solid var(--border)',
            background: type === ct.id ? 'var(--surface)' : 'var(--bg)',
            color: type === ct.id ? 'var(--t1)' : 'var(--t3)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          }}>
            <span style={{ fontSize: 12 }}>{ct.icon}</span>
            {ct.label}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 10, color: 'var(--t3)', lineHeight: 1.5, marginBottom: 8 }}>
        {COMPLETION_TYPES.find(c => c.id === type)?.desc}
      </div>
      {type === 'hard' && comp.rule && (
        <div style={{ padding: '6px 10px', background: 'var(--green-bg)', borderRadius: 4, fontSize: 10, color: 'var(--green)', fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>
          Rule: {comp.rule}
        </div>
      )}
      {type === 'ai_eval' && (
        <EditorField label={`超时兜底 · ${timeout}s`} style={{ marginBottom: 0 }}>
          <input type="range" min={120} max={900} step={30} value={timeout}
            onChange={e => setTimeout(+e.target.value)} style={{ width: '100%' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--t3)' }}>
            <span>2min</span><span>15min</span>
          </div>
        </EditorField>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   AI Field Section (Tutor Instruction + Completion Rubric)
   ═══════════════════════════════════════════════ */
function AIFieldSection({ block }) {
  const ai = block.ai || {};
  return (
    <div>
      <ContentDivider label="AI 字段（角色分离）" color="var(--purple)" />
      {/* Tutor Instruction */}
      <div style={{
        marginBottom: 12, padding: '12px 14px', borderRadius: 8,
        background: 'var(--purple-bg)', border: '1px solid rgba(58,49,133,.12)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <Badge color="purple">→ AI Tutor</Badge>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--purple)' }}>Tutor Instruction</span>
        </div>
        <div style={{ fontSize: 9, color: 'var(--purple)', opacity: .7, marginBottom: 6 }}>
          定义 tutor 在模块内如何与学生互动。读取者: AI Tutor。
        </div>
        <textarea defaultValue={ai.tutorInstruction || ''} rows={3}
          style={{ ...edInput, resize: 'vertical', background: 'rgba(255,255,255,.6)', borderColor: 'rgba(58,49,133,.15)' }}
          placeholder="引导学生理解...，鼓励从课文中找证据，不直接给出答案..." />
      </div>
      {/* Completion Rubric */}
      <div style={{
        padding: '12px 14px', borderRadius: 8,
        background: 'var(--coral-bg)', border: '1px solid rgba(107,42,20,.12)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <Badge color="coral">→ AI Evaluator</Badge>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--coral)' }}>Completion Rubric</span>
        </div>
        <div style={{ fontSize: 9, color: 'var(--coral)', opacity: .7, marginBottom: 6 }}>
          定义学生达标判断标准。读取者: Evaluator LLM。与 tutor 独立。
        </div>
        <textarea defaultValue={ai.completionRubric || ''} rows={3}
          style={{ ...edInput, resize: 'vertical', background: 'rgba(255,255,255,.6)', borderColor: 'rgba(107,42,20,.15)' }}
          placeholder="学生能够说出...，并引用至少一个课文证据..." />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Type-Specific Content Editors (restructured)
   ═══════════════════════════════════════════════ */
function ContentTab({ block }) {
  const t = block.type;
  if (t === 'choice') return <MCEditor block={block} />;
  if (t === 'discuss') return <DiscussEditor block={block} />;
  if (t === 'matrix') return <MatrixEditor block={block} />;
  if (t === 'map') return <MapEditor block={block} />;
  if (t === 'evidence') return <EvidenceEditor block={block} />;
  return <GenericEditor block={block} />;
}

/* ── Discuss Editor (restructured with AI field separation) ── */
function DiscussEditor({ block }) {
  const c = block.content || {};
  const [method, setMethod] = React.useState(c.method || 'socratic');
  const [maxRounds, setMaxRounds] = React.useState(c.maxRounds || 6);
  const [hasFallback, setHasFallback] = React.useState(!!c.fallback);

  return (
    <Scr style={{ flex: 1, padding: 16 }}>
      {/* Structured config */}
      <ContentDivider label="结构化配置（机器消费）" color="var(--blue)" />
      <EditorSegment label="对话方法" value={method} onChange={setMethod} options={[
        { id: 'socratic', label: 'Socratic 引导式' },
        { id: 'guided', label: 'Guided 结构化' },
        { id: 'free', label: 'Free 开放式' },
      ]} />
      <EditorField label={`最大轮次 · ${maxRounds} 轮`}>
        <input type="range" min={2} max={12} value={maxRounds} onChange={e => setMaxRounds(+e.target.value)} style={{ width: '100%' }} />
      </EditorField>
      <EditorToggle label="允许中文回复" checked={true} />
      <EditorToggle label="理解度实时追踪" checked={true} />

      {/* AI fields */}
      <AIFieldSection block={block} />

      {/* Content definition */}
      <ContentDivider label="内容定义（展示什么）" color="var(--teal)" />
      <EditorField label="学习目标" sub="学生需要在对话中展示的理解">
        <textarea defaultValue={c.goal} rows={2} style={{ ...edInput, resize: 'vertical' }} />
      </EditorField>

      {/* Fallback */}
      <ContentDivider label="兜底策略" />
      <EditorToggle label="启用兜底选择题" checked={hasFallback} onChange={setHasFallback} />
      {hasFallback && c.fallback && (
        <div style={{ background: 'var(--amber-bg)', border: '1px solid rgba(196,138,30,.15)', borderRadius: 8, padding: 14, marginTop: 8 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 10 }}>对话未达标时自动切换</div>
          <EditorField label="兜底题目">
            <textarea defaultValue={c.fallback.question} rows={2} style={{ ...edInput, resize: 'vertical' }} />
          </EditorField>
          <EditorField label="选项">
            {(c.fallback.options || []).map((opt, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{
                  width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                  border: c.fallback.correct === i ? '2px solid var(--green)' : '2px solid var(--border)',
                  background: c.fallback.correct === i ? 'var(--green)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {c.fallback.correct === i && <span style={{ color: '#fff', fontSize: 8, fontWeight: 700 }}>✓</span>}
                </div>
                <input defaultValue={opt} style={{ ...edInput, flex: 1 }} />
              </div>
            ))}
          </EditorField>
        </div>
      )}

      {/* Completion */}
      <CompletionConfig block={block} />
    </Scr>
  );
}

/* ── MC Editor (restructured) ── */
function MCEditor({ block }) {
  const questions = block.content?.questions || [];
  const [selectedQ, setSelectedQ] = React.useState(0);
  const [allowMultiple, setAllowMultiple] = React.useState(false);
  const [showExplanation, setShowExplanation] = React.useState(true);
  const q = questions[selectedQ];

  return (
    <Scr style={{ flex: 1, padding: 16 }}>
      {/* Structured config */}
      <ContentDivider label="结构化配置（机器消费）" color="var(--blue)" />
      <EditorToggle label="允许多选" checked={allowMultiple} onChange={setAllowMultiple} />
      <EditorToggle label="显示解析" checked={showExplanation} onChange={setShowExplanation} />
      <EditorToggle label="选项随机排列" checked={false} />

      {/* Content definition */}
      <ContentDivider label="内容定义（展示什么）" color="var(--teal)" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
        {questions.map((qq, i) => (
          <div key={i} onClick={() => setSelectedQ(i)} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
            borderRadius: 'var(--r-input)', cursor: 'pointer',
            background: selectedQ === i ? 'var(--blue-bg)' : 'transparent',
            border: selectedQ === i ? '1px solid rgba(26,95,160,.2)' : '1px solid transparent',
          }}>
            <span style={{
              width: 22, height: 22, borderRadius: 5, fontSize: 10, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              background: selectedQ === i ? 'var(--blue)' : 'var(--surface2)',
              color: selectedQ === i ? '#fff' : 'var(--t3)',
            }}>Q{i + 1}</span>
            <span style={{ fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{qq.stem}</span>
            {qq.tag && <span style={{ fontSize: 9, color: 'var(--t3)', background: 'var(--surface2)', padding: '1px 5px', borderRadius: 3, flexShrink: 0 }}>{qq.tag}</span>}
          </div>
        ))}
        <button style={{
          padding: 7, fontSize: 10, color: 'var(--t3)', background: 'transparent',
          border: '1px dashed var(--border)', borderRadius: 'var(--r-input)', cursor: 'pointer', fontFamily: 'inherit',
        }}>＋ 添加题目</button>
      </div>
      {q && (
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
          <EditorField label={`Q${selectedQ + 1} 题干`}>
            <textarea defaultValue={q.stem} rows={2} style={{ ...edInput, resize: 'vertical' }} />
          </EditorField>
          <EditorField label="选项">
            {q.options.map((opt, oi) => (
              <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                  border: q.correct === oi ? '2px solid var(--green)' : '2px solid var(--border)',
                  background: q.correct === oi ? 'var(--green)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {q.correct === oi && <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>✓</span>}
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', width: 14, flexShrink: 0 }}>{String.fromCharCode(65 + oi)}</span>
                <input defaultValue={opt} style={{ ...edInput, flex: 1 }} />
              </div>
            ))}
          </EditorField>
        </div>
      )}

      {/* Completion */}
      <CompletionConfig block={block} />
    </Scr>
  );
}

/* ── Matrix Editor ── */
function MatrixEditor({ block }) {
  const c = block.content || {};
  return (
    <Scr style={{ flex: 1, padding: 16 }}>
      <ContentDivider label="结构化配置" color="var(--blue)" />
      <EditorToggle label="允许部分提交" checked={true} />
      <EditorToggle label="支架提示 (Why 列)" checked={true} />

      <ContentDivider label="内容定义" color="var(--teal)" />
      <EditorField label="行 · 数据项">
        {(c.rows || []).map((row, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', width: 16, textAlign: 'center' }}>{i + 1}</span>
            <input defaultValue={row} style={{ ...edInput, flex: 1 }} />
          </div>
        ))}
        <button style={{ width: '100%', padding: 6, fontSize: 10, color: 'var(--t3)', background: 'transparent', border: '1px dashed var(--border)', borderRadius: 'var(--r-input)', cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 }}>＋ 添加行</button>
      </EditorField>
      <EditorField label="列 · 分析维度">
        {(c.cols || []).map((col, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', width: 16, textAlign: 'center' }}>{String.fromCharCode(65 + i)}</span>
            <input defaultValue={col} style={{ ...edInput, flex: 1 }} />
          </div>
        ))}
      </EditorField>

      <CompletionConfig block={block} />
    </Scr>
  );
}

/* ── Map Editor ── */
function MapEditor({ block }) {
  const c = block.content || {};
  return (
    <Scr style={{ flex: 1, padding: 16 }}>
      <ContentDivider label="结构化配置" color="var(--blue)" />
      <EditorToggle label="要求写理由 (reasoning)" checked={true} />
      <EditorToggle label="显示参考答案区域" checked={false} />

      <ContentDivider label="内容定义" color="var(--teal)" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <EditorField label="X 轴左端" style={{ marginBottom: 0 }}><input defaultValue={c.xAxis?.neg} style={edInput} /></EditorField>
        <EditorField label="X 轴右端" style={{ marginBottom: 0 }}><input defaultValue={c.xAxis?.pos} style={edInput} /></EditorField>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <EditorField label="Y 轴下端" style={{ marginBottom: 0 }}><input defaultValue={c.yAxis?.neg} style={edInput} /></EditorField>
        <EditorField label="Y 轴上端" style={{ marginBottom: 0 }}><input defaultValue={c.yAxis?.pos} style={edInput} /></EditorField>
      </div>
      <EditorField label="放置项目">
        {(c.items || []).map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--blue)', flexShrink: 0 }}></span>
            <input defaultValue={item} style={{ ...edInput, flex: 1 }} />
          </div>
        ))}
      </EditorField>

      <CompletionConfig block={block} />
    </Scr>
  );
}

/* ── Evidence Editor ── */
function EvidenceEditor({ block }) {
  const c = block.content || {};
  return (
    <Scr style={{ flex: 1, padding: 16 }}>
      <ContentDivider label="结构化配置" color="var(--blue)" />
      <EditorToggle label="要求选择证据短语" checked={true} />
      <EditorToggle label="错误时显示 AI 提示" checked={true} />

      <ContentDivider label="内容定义" color="var(--teal)" />
      {(c.sections || []).map((sec, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', marginBottom: 4,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-input)',
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--teal)', width: 36, flexShrink: 0 }}>{sec.label}</span>
          <span style={{ fontSize: 8, color: 'var(--t3)' }}>→</span>
          <input defaultValue={sec.func} style={{ ...edInput, flex: 1, fontWeight: 600 }} />
        </div>
      ))}

      <CompletionConfig block={block} />
    </Scr>
  );
}

/* ── Generic Editor ── */
function GenericEditor({ block }) {
  return (
    <Scr style={{ flex: 1, padding: 16 }}>
      <ContentDivider label="基本信息" color="var(--blue)" />
      <EditorField label="标题"><input defaultValue={block.title} style={edInput} /></EditorField>
      <EditorField label="内容描述">
        <textarea defaultValue={block.desc} rows={3} style={{ ...edInput, resize: 'vertical' }} />
      </EditorField>
      {block.ai && <AIFieldSection block={block} />}
      <CompletionConfig block={block} />
    </Scr>
  );
}

Object.assign(window, { ContentTab, EditorField, EditorToggle, EditorSegment, ContentDivider, edInput, CompletionConfig, AIFieldSection });
