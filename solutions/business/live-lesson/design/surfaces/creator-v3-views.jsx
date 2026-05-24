/* ════════════════════════════════════════════════
   Creator v3 — Platform Views: File System, Skills, Review
   ════════════════════════════════════════════════ */

/* ═══ FILE SYSTEM VIEW ═══ */
function FileSystemTab() {
  const [selectedFile, setSelectedFile] = React.useState('lesson-plan.md');

  const fileContents = {
    'lesson-plan.md': { type: 'md', title: 'plan/lesson-plan.md', content: `# Ideal Beauty\n\n**Source:** Textbook Unit 3\n**Subject:** 英语\n**Grade:** 高一\n**Duration:** 45 分钟\n**Class:** 高一(3)班\n\n## 课文概述\n\n本课选取关于不同文化中美的标准的议论文。课文从尼日利亚的 Happiness Edem 的故事引入，探讨了从古埃及到现代媒体中美的实践的多样性，最终论证美的实践是一种"文化语言"。` },
    'objectives.md': { type: 'md', title: 'plan/objectives.md', content: `# 核心素养目标\n\n## 语言能力\n- 通过上下文线索推断生词含义\n- 识别并分析语篇结构信号词\n\n## 思维品质\n- 分析不同文化中美的实践背后的逻辑\n- 批判性评价作者的论点和证据\n\n## 文化意识\n- 理解美的文化多样性\n- 反思媒体对美的标准的影响` },
    'requirements.md': { type: 'md', title: 'plan/requirements.md', content: `# 教学要求\n\n- [x] 识别课文中的语篇结构（现象→历史→文化→结论）\n- [x] 理解 "beauty practices as cultural language" 的核心论点\n- [x] 分析至少 3 种文化中美的实践的目的和意义\n- [x] 批判性评价作者对现代媒体美的标准的观点\n- [x] 运用 skimming / scanning 阅读策略完成信息提取` },
    'module-outline.md': { type: 'md', title: 'plan/module-outline.md', content: `# 大模块划分\n\n1. **Predict** — 图式激活 · 5min\n2. **Skim** — 结构解码 · 8min\n3. **Scan & Build** — 信息矩阵 · 15min\n4. **Evaluate** — 批判质疑 · 12min\n5. **Wrap-up** — 策略复盘 · 5min` },
    'manifest.json': { type: 'json', title: 'execution/manifest.json', content: JSON.stringify({
      modules: LESSON_V3.steps.flatMap(s => s.blocks.map(b => ({
        id: b.id, type: b.type, title: b.title,
        completion: b.completion,
        ...(b.ai ? { ai: { tutorInstruction: '...', completionRubric: '...' } } : {}),
      })))
    }, null, 2)},
  };

  const fc = fileContents[selectedFile];

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      {/* File tree */}
      <div style={{ width: 260, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: 10, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
          File Explorer
        </div>
        <div className="scr" style={{ flex: 1, padding: '8px 6px' }}>
          {FILE_TREE.map((f, i) => (
            <div key={i}
              onClick={() => f.type === 'file' && setSelectedFile(f.name)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 4,
                cursor: f.type === 'file' ? 'pointer' : 'default',
                paddingLeft: 8 + (f.indent || 0) * 16,
                background: selectedFile === f.name ? 'var(--teal-bg)' : 'transparent',
                color: selectedFile === f.name ? 'var(--teal)' : 'var(--t1)',
                transition: 'all .1s',
              }}>
              <span style={{ fontSize: 12, width: 16, textAlign: 'center', flexShrink: 0 }}>
                {f.type === 'folder' ? '📁' : '📄'}
              </span>
              <span style={{ fontSize: 11, fontWeight: f.type === 'folder' ? 600 : 400, fontFamily: 'ui-monospace, "SF Mono", monospace' }}>{f.name}</span>
              {f.size && <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--t3)' }}>{f.size}</span>}
            </div>
          ))}
        </div>
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', fontSize: 10, color: 'var(--t3)', lineHeight: 1.5 }}>
          Markdown 文件点击后进入富文本编辑模式。非 Markdown 文件按原始格式展示。
        </div>
      </div>

      {/* File content */}
      <div className="scr" style={{ flex: 1, padding: 24 }}>
        {fc ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace', color: 'var(--t3)' }}>{fc.title}</span>
              <Badge color={fc.type === 'json' ? 'blue' : 'teal'}>{fc.type.toUpperCase()}</Badge>
            </div>
            <pre style={{
              fontSize: 12, lineHeight: 1.7, fontFamily: fc.type === 'json' ? 'ui-monospace, "SF Mono", monospace' : 'inherit',
              color: 'var(--t1)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              background: fc.type === 'json' ? 'var(--t1)' : 'transparent',
              color: fc.type === 'json' ? 'rgba(240,239,232,.85)' : 'var(--t1)',
              padding: fc.type === 'json' ? 20 : 0, borderRadius: fc.type === 'json' ? 10 : 0,
            }}>{fc.content}</pre>
          </div>
        ) : (
          <EmptyState icon="📄" title="选择一个文件查看内容" />
        )}
      </div>
    </div>
  );
}

/* ═══ SKILLS VIEW ═══ */
function SkillsTab() {
  return (
    <div className="scr" style={{ flex: 1, padding: 28 }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-.3px' }}>Skill 定义</span>
          <Badge color="purple">只读</Badge>
        </div>
        <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.6, marginBottom: 20, maxWidth: 560 }}>
          展示当前项目中生效的 skill 定义。Skill 是平台预置的、跨项目复用的资产。教师可查看但不可编辑。
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {SKILLS_DATA.map((skill, i) => (
            <div key={i} style={{
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
              borderLeft: '3px solid var(--purple)', overflow: 'hidden',
            }}>
              <div style={{ padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{
                    width: 24, height: 24, borderRadius: 6, background: 'var(--purple)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700,
                  }}>✦</span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{skill.name}</span>
                  <Badge color="purple">{skill.scope}</Badge>
                </div>
                <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.7, marginBottom: 10 }}>{skill.desc}</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--t3)', marginRight: 4 }}>适用模块:</span>
                  {skill.modules.map(m => {
                    const reg = COMP_REG[m];
                    return reg ? <Badge key={m} color="neutral">{reg.icon} {reg.label}</Badge> : null;
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══ REVIEW AUDIT VIEW (v7 — with health + insights) ═══ */
function ReviewTab() {
  const coverageItems = [
    { req: '识别课文中的语篇结构', modules: ['b4 语篇结构匹配'], status: 'covered' },
    { req: '理解核心论点 "beauty as cultural language"', modules: ['b7 文化语言讨论'], status: 'covered' },
    { req: '分析至少 3 种文化中美的实践', modules: ['b6 信息矩阵填写', 'b8 坐标图定位'], status: 'covered' },
    { req: '批判性评价作者观点', modules: ['b9 评价作者观点'], status: 'covered' },
    { req: '运用 skimming / scanning 策略', modules: ['b3 略读策略讲解', 'b5 寻读策略讲解'], status: 'covered' },
  ];
  const healthItems = [
    { label: '模块完整度', value: '13/13', ok: true },
    { label: 'AI 字段配置', value: '4/4 模块', ok: true },
    { label: '观察维度', value: '9 模块已配置', ok: true },
    { label: '干预规则', value: '3 条', ok: true, note: '可增加' },
    { label: '时间分配', value: '45min', ok: false, note: 'Step 5 偏紧' },
  ];
  const insights = [
    { sev: 'warn', title: 'Wrap-up 时间偏紧', text: 'Step 5 仅 5min，策略分类题可能时间不足。建议增加到 7min 或简化为投票题。' },
    { sev: 'info', title: 'Rubric 可增强', text: 'discuss-cultural.json 的 rubric 可增加"引用课文外例子"以提高思维品质目标覆盖。' },
  ];
  const sevMap = {
    warn: { bg: 'var(--amber-bg)', fg: 'var(--amber)', icon: '⚠', bd: 'rgba(196,138,30,.15)' },
    info: { bg: 'var(--blue-bg)', fg: 'var(--blue)', icon: 'i', bd: 'rgba(26,95,160,.12)' },
  };

  return (
    <div className="scr" style={{ flex: 1, padding: 28 }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-.3px' }}>Review 审计</span>
          <Badge color="purple">AI 生成</Badge>
          <Badge color="green">通过</Badge>
        </div>
        <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.6, marginBottom: 24, maxWidth: 560 }}>
          Agent cross-read 教案与执行设计后生成的审计报告。
        </div>

        {/* Health */}
        <ReviewSection title="项目健康度" tag={`${healthItems.filter(h => h.ok).length}/${healthItems.length}`} tagColor={healthItems.every(h => h.ok) ? 'green' : 'amber'}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {healthItems.map((h, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0',
                borderBottom: i < healthItems.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <span style={{ fontSize: 10, color: h.ok ? 'var(--green)' : 'var(--amber)', fontWeight: 700, width: 14, textAlign: 'center', flexShrink: 0 }}>{h.ok ? '✓' : '⚠'}</span>
                <span style={{ fontSize: 12, color: 'var(--t2)', flex: 1 }}>{h.label}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)' }}>{h.value}</span>
                {h.note && <span style={{ fontSize: 9, fontWeight: 500, color: h.ok ? 'var(--blue)' : 'var(--amber)', padding: '1px 6px', borderRadius: 3, background: h.ok ? 'var(--blue-bg)' : 'var(--amber-bg)' }}>{h.note}</span>}
              </div>
            ))}
          </div>
        </ReviewSection>

        {/* Coverage */}
        <ReviewSection title="要求覆盖" tag={`${coverageItems.length}/${coverageItems.length}`} tagColor="green">
          {coverageItems.map((item, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0',
              borderBottom: i < coverageItems.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <span style={{
                width: 18, height: 18, borderRadius: 4, background: 'var(--green)', color: '#fff', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, marginTop: 1,
              }}>✓</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)', marginBottom: 3 }}>{item.req}</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {item.modules.map((m, mi) => (
                    <span key={mi} style={{ fontSize: 10, color: 'var(--blue)', background: 'var(--blue-bg)', padding: '1px 6px', borderRadius: 3 }}>{m}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </ReviewSection>

        {/* Conflicts */}
        <ReviewSection title="冲突检测" tag="0 冲突" tagColor="green">
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>
            未检测到教案与执行设计之间的冲突。
          </div>
        </ReviewSection>

        {/* Insights / Suggestions */}
        <ReviewSection title="洞察与建议" tag={`${insights.length} 条`} tagColor="amber">
          {insights.map((ins, i) => {
            const s = sevMap[ins.sev] || sevMap.info;
            return (
              <div key={i} style={{
                padding: '12px 0',
                borderBottom: i < insights.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: 4, background: s.fg, color: '#fff', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, marginTop: 1,
                  }}>{s.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', marginBottom: 3 }}>{ins.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.6 }}>{ins.text}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </ReviewSection>
      </div>
    </div>
  );
}

function ReviewSection({ title, tag, tagColor, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{title}</span>
        <Badge color={tagColor}>{tag}</Badge>
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '4px 16px' }}>
        {children}
      </div>
    </div>
  );
}

Object.assign(window, { FileSystemTab, SkillsTab, ReviewTab });
