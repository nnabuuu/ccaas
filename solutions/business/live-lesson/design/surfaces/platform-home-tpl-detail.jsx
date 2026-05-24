/* ════════════════════════════════════════════════
   Template Detail — Slide-over Panel
   Per-category preview mockups, config params, AI behaviors
   ════════════════════════════════════════════════ */

/* ── Per-category metadata ── */
const TPL_META = {
  choice: {
    configParams: [
      { label: '题目数量', value: '可配置', icon: '○' },
      { label: '通过分数', value: '≥ 75%', icon: '✓' },
      { label: '重试次数', value: '不限', icon: '⟳' },
      { label: '解析展示', value: '提交后', icon: '≡' },
    ],
    dataFields: ['选项分布', '正确率', '首次正确率', '用时', '改答追踪', '误解聚类'],
    aiBehaviors: ['自动批改，即时反馈正误', '错误选项归因分析', '相同错误模式自动聚类', '低正确率时提醒教师'],
    scenarios: ['课前预检', '阅读理解检查', '概念辨析', '课后巩固'],
  },
  fill: {
    configParams: [
      { label: '空位数量', value: '可配置', icon: '▭' },
      { label: '匹配模式', value: '模糊匹配', icon: '≈' },
      { label: '备选答案', value: '支持多答案', icon: '⊞' },
      { label: '提示机制', value: '首字母提示', icon: '→' },
    ],
    dataFields: ['填写内容', '正确率', '用时', '提示使用次数', '常见错误'],
    aiBehaviors: ['等价表达式智能判定', '拼写近似容错', '逐空反馈 + 整体评价', '高频错误自动归类'],
    scenarios: ['词汇练习', '公式填写', '完形填空', '关键信息提取'],
  },
  truefalse: {
    configParams: [
      { label: '题目数量', value: '可配置', icon: '◇' },
      { label: '需要理由', value: '可选', icon: '≡' },
      { label: '通过条件', value: '全对', icon: '✓' },
    ],
    dataFields: ['正确率', '用时', '理由质量', '常见误判'],
    aiBehaviors: ['即时判定正误', '理由文本 AI 评分', '易混淆概念检测'],
    scenarios: ['概念快速检查', '阅读理解判断', '纠错练习'],
  },
  matching: {
    configParams: [
      { label: '配对数量', value: '可配置', icon: '⟷' },
      { label: '左列类型', value: '文本/图片', icon: '▣' },
      { label: '右列类型', value: '文本/图片', icon: '▣' },
      { label: '连线方式', value: '拖拽', icon: '↗' },
    ],
    dataFields: ['配对正确率', '用时', '错误配对', '完成率'],
    aiBehaviors: ['自动判定配对正确性', '错误配对模式分析', '部分得分计算'],
    scenarios: ['术语定义配对', '条件结论连线', '图文匹配', '因果对应'],
  },
  sorting: {
    configParams: [
      { label: '项目数量', value: '可配置', icon: '↕' },
      { label: '排序维度', value: '单维度', icon: '→' },
      { label: '部分得分', value: '支持', icon: '≈' },
    ],
    dataFields: ['完全正确率', '逆序对数', '用时', '拖拽轨迹'],
    aiBehaviors: ['顺序自动判定', '部分正确评分', '逆序对分析'],
    scenarios: ['步骤排序', '时间线排列', '论证顺序', '优先级排列'],
  },
  classify: {
    configParams: [
      { label: '分类桶数', value: '可配置', icon: '⊞' },
      { label: '卡片数量', value: '可配置', icon: '▣' },
      { label: '拖拽方式', value: '拖入桶中', icon: '↗' },
    ],
    dataFields: ['分类正确率', '错分模式', '用时', '每桶完成率'],
    aiBehaviors: ['自动判定分类正确性', '混淆类别检测', '分类策略分析'],
    scenarios: ['概念分类', '韦恩图', '优缺点归类', '策略对应'],
  },
  annotate: {
    configParams: [
      { label: '标注类型', value: '区域/文字', icon: '✎' },
      { label: '标签预设', value: '可自定义', icon: '⊞' },
      { label: '多人协作', value: '支持', icon: '⇆' },
    ],
    dataFields: ['标注位置', '标签分布', '用时', '标注密度'],
    aiBehaviors: ['标注位置匹配评分', '标签一致性分析', '遗漏区域提示'],
    scenarios: ['图片标注', '文本批注', '地图标记', '实验标注'],
  },
  poll: {
    configParams: [
      { label: '选项数量', value: '可配置', icon: '▮' },
      { label: '匿名投票', value: '可选', icon: '○' },
      { label: '实时展示', value: '柱状图', icon: '▣' },
    ],
    dataFields: ['选项分布', '投票率', '变更追踪'],
    aiBehaviors: ['实时统计可视化', '观点聚类', '少数派观点标记'],
    scenarios: ['课堂调查', '观点倾向', '决策投票', '兴趣收集'],
  },
  discuss: {
    configParams: [
      { label: '讨论模式', value: 'Socratic', icon: '◬' },
      { label: '最大轮次', value: '6 轮', icon: '⟳' },
      { label: '兜底机制', value: '选择题兜底', icon: '○' },
      { label: '达标判定', value: 'AI 评估', icon: '✦' },
    ],
    dataFields: ['达标率', '平均轮次', '兜底人数', '理解度趋势', '对话记录'],
    aiBehaviors: ['苏格拉底式追问引导', '逐轮理解度评估', 'Rubric 达标判定', '超时自动兜底'],
    scenarios: ['深度讨论', '观点阐述', '概念探究', '批判性思维'],
  },
  group: {
    configParams: [
      { label: '分组方式', value: '随机/手动', icon: '⊡' },
      { label: '组内人数', value: '3-5 人', icon: '⊡' },
      { label: '角色分工', value: '可配置', icon: '≡' },
    ],
    dataFields: ['组内贡献度', '完成进度', '协作频率', '角色完成度'],
    aiBehaviors: ['智能分组建议', '组内参与度监测', '进度落后提醒'],
    scenarios: ['协作任务', 'Jigsaw 拼图', '项目学习', '角色扮演'],
  },
  video: {
    configParams: [
      { label: '视频来源', value: '上传/链接', icon: '▶' },
      { label: '检查点', value: '可插入', icon: '○' },
      { label: '播放控制', value: '可限制', icon: '→' },
    ],
    dataFields: ['观看进度', '检查点正确率', '暂停点', '重播片段'],
    aiBehaviors: ['检查点自动批改', '观看行为分析', '重点片段标记'],
    scenarios: ['微课讲解', '实验演示', '翻转课堂', '案例学习'],
  },
  reading: {
    configParams: [
      { label: '分段方式', value: '按段落', icon: '≡' },
      { label: '检查频率', value: '每段', icon: '○' },
      { label: '标注工具', value: '划线+批注', icon: '✎' },
    ],
    dataFields: ['阅读进度', '理解检查正确率', '标注密度', '用时'],
    aiBehaviors: ['阅读进度追踪', '理解检查自动判定', '生词辅助', '段落功能识别'],
    scenarios: ['精读任务', '资料卡片', '对比阅读', '信息提取'],
  },
  timed: {
    configParams: [
      { label: '时间限制', value: '可配置', icon: '◷' },
      { label: '题目来源', value: '多种类型', icon: '⊞' },
      { label: '超时处理', value: '自动提交', icon: '→' },
    ],
    dataFields: ['完成率', '正确率', '每题用时', '超时人数'],
    aiBehaviors: ['倒计时管理', '自动提交', '速度与准确度分析'],
    scenarios: ['限时挑战', '速算练习', '定时测验', '竞赛模式'],
  },
  peer: {
    configParams: [
      { label: '匿名模式', value: '默认匿名', icon: '○' },
      { label: '评分维度', value: '可自定义', icon: '≡' },
      { label: 'AI 辅助', value: '评分一致性', icon: '✦' },
    ],
    dataFields: ['评分分布', '评分一致性', '反馈质量', '互评完成率'],
    aiBehaviors: ['评分偏差检测', '反馈质量评估', '匿名分配管理'],
    scenarios: ['作品互评', '写作互评', '方案评审', '展示评价'],
  },
  whiteboard: {
    configParams: [
      { label: '画布大小', value: '自适应', icon: '▢' },
      { label: '工具集', value: '画笔/文字/形状', icon: '✎' },
      { label: '多人协作', value: '实时同步', icon: '⇆' },
    ],
    dataFields: ['参与度', '内容密度', '协作频率'],
    aiBehaviors: ['内容关键词提取', '绘制内容分类', '参与度监测'],
    scenarios: ['头脑风暴', '概念图绘制', '协作笔记', '流程图'],
  },
};

/* ── Preview Mockup Components ── */
function PreviewChoice() {
  return (
    <div style={{ padding: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t1)', marginBottom: 10, lineHeight: 1.5 }}>
        What is the writer's main question in ¶1-2?
      </div>
      {['A. Why do people want to be beautiful?', 'B. Is one idea of beauty better?', 'C. How has beauty changed?', 'D. Why is media bad?'].map((opt, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', marginBottom: 4,
          borderRadius: 6, fontSize: 10, color: i === 1 ? 'var(--green)' : 'var(--t2)',
          background: i === 1 ? 'var(--green-bg)' : 'var(--surface2)',
          border: `1px solid ${i === 1 ? 'rgba(45,102,18,.15)' : 'transparent'}`,
        }}>
          <span style={{
            width: 14, height: 14, borderRadius: '50%', border: `1.5px solid ${i === 1 ? 'var(--green)' : 'var(--t3)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, flexShrink: 0,
          }}>{i === 1 ? '✓' : ''}</span>
          {opt}
        </div>
      ))}
    </div>
  );
}

function PreviewFill() {
  return (
    <div style={{ padding: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--t3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: .4 }}>完成句子</div>
      <div style={{ fontSize: 11, color: 'var(--t1)', lineHeight: 2 }}>
        Beauty practices are a form of{' '}
        <span style={{ display: 'inline-block', width: 80, borderBottom: '1.5px solid var(--teal)', background: 'var(--teal-bg)', padding: '1px 6px', borderRadius: '3px 3px 0 0', fontSize: 10, color: 'var(--teal)', fontWeight: 600, textAlign: 'center' }}>cultural</span>
        {' '}language that communicates{' '}
        <span style={{ display: 'inline-block', width: 90, borderBottom: '1.5px dashed var(--t3)', padding: '1px 6px', fontSize: 10, color: 'var(--t3)', textAlign: 'center' }}>______</span>
        {' '}and belonging.
      </div>
    </div>
  );
}

function PreviewDiscuss() {
  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ alignSelf: 'flex-start', maxWidth: '80%' }}>
        <div style={{ fontSize: 8, color: 'var(--purple)', fontWeight: 600, marginBottom: 2 }}>AI 助教</div>
        <div style={{ fontSize: 10, color: 'var(--purple)', background: 'var(--purple-bg)', padding: '6px 10px', borderRadius: '2px 8px 8px 8px', lineHeight: 1.5 }}>
          你认为 Maori tā moko 和现代纹身有什么本质区别？
        </div>
      </div>
      <div style={{ alignSelf: 'flex-end', maxWidth: '80%' }}>
        <div style={{ fontSize: 10, color: 'var(--t1)', background: 'var(--surface2)', padding: '6px 10px', borderRadius: '8px 2px 8px 8px', lineHeight: 1.5 }}>
          Maori 纹身代表家族身份...
        </div>
      </div>
      <div style={{ alignSelf: 'flex-start', maxWidth: '80%' }}>
        <div style={{ fontSize: 10, color: 'var(--purple)', background: 'var(--purple-bg)', padding: '6px 10px', borderRadius: '2px 8px 8px 8px', lineHeight: 1.5 }}>
          很好！那课文中哪个证据支持你的观点？
        </div>
      </div>
    </div>
  );
}

function PreviewMatching() {
  const left = ['Phenomenon', 'History', 'Culture'];
  const right = ['¶1-2', '¶3-4', '¶5-7'];
  return (
    <div style={{ padding: 12, display: 'flex', gap: 24, justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {left.map((l, i) => (
          <div key={i} style={{ fontSize: 10, padding: '5px 12px', borderRadius: 6, background: 'var(--purple-bg)', color: 'var(--purple)', fontWeight: 500, textAlign: 'center' }}>{l}</div>
        ))}
      </div>
      <svg width="40" height="70" viewBox="0 0 40 70" style={{ flexShrink: 0 }}>
        <line x1="0" y1="12" x2="40" y2="12" stroke="var(--green)" strokeWidth="1.5" strokeDasharray="3,2" />
        <line x1="0" y1="35" x2="40" y2="56" stroke="var(--t3)" strokeWidth="1" strokeDasharray="3,2" opacity=".4" />
        <line x1="0" y1="56" x2="40" y2="35" stroke="var(--t3)" strokeWidth="1" strokeDasharray="3,2" opacity=".4" />
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {right.map((r, i) => (
          <div key={i} style={{ fontSize: 10, padding: '5px 12px', borderRadius: 6, background: i === 0 ? 'var(--green-bg)' : 'var(--surface2)', color: i === 0 ? 'var(--green)' : 'var(--t2)', fontWeight: 500, textAlign: 'center' }}>{r}</div>
        ))}
      </div>
    </div>
  );
}

function PreviewSorting() {
  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--t3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: .4 }}>拖拽排序</div>
      {['1. 提出现象', '2. 历史追溯', '3. 文化分析', '4. 结论总结'].map((item, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px',
          borderRadius: 6, background: 'var(--surface2)', fontSize: 10, color: 'var(--t1)',
          border: i === 0 ? '1px solid var(--amber)' : '1px solid transparent',
        }}>
          <span style={{ color: 'var(--t3)', fontSize: 10, cursor: 'grab' }}>⠿</span>
          {item}
        </div>
      ))}
    </div>
  );
}

function PreviewClassify() {
  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {['Skimming', 'Scanning'].map(b => (
          <div key={b} style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: '1px dashed var(--border)', fontSize: 10, fontWeight: 600, color: 'var(--t2)', textAlign: 'center' }}>{b}</div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {['首句阅读', '关键词定位', '段落功能', '数据提取'].map((c, i) => (
          <span key={i} style={{ fontSize: 9, padding: '3px 8px', borderRadius: 4, background: i < 2 ? 'var(--coral-bg)' : 'var(--surface2)', color: i < 2 ? 'var(--coral)' : 'var(--t3)', cursor: 'grab' }}>{c}</span>
        ))}
      </div>
    </div>
  );
}

function PreviewPoll() {
  const data = [68, 22, 10];
  const labels = ['同意', '部分同意', '不同意'];
  const colors = ['green', 'amber', 'red'];
  return (
    <div style={{ padding: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--t3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: .4 }}>实时投票结果</div>
      {data.map((v, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--t2)', width: 50, textAlign: 'right' }}>{labels[i]}</span>
          <div style={{ flex: 1, height: 14, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${v}%`, height: '100%', background: `var(--${colors[i]}-bg)`, borderRadius: 3, transition: 'width .3s' }}></div>
          </div>
          <span style={{ fontSize: 10, fontWeight: 600, color: `var(--${colors[i]})`, width: 30 }}>{v}%</span>
        </div>
      ))}
    </div>
  );
}

function PreviewGeneric({ icon, color }) {
  return (
    <div style={{ padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 28, color: `var(--${color})`, opacity: .4 }}>{icon}</span>
      <span style={{ fontSize: 10, color: 'var(--t3)' }}>学生端交互预览</span>
    </div>
  );
}

const PREVIEW_MAP = {
  choice: PreviewChoice,
  fill: PreviewFill,
  discuss: PreviewDiscuss,
  matching: PreviewMatching,
  sorting: PreviewSorting,
  classify: PreviewClassify,
  poll: PreviewPoll,
};

/* ════════════════════════════════════════════════
   Slide-over Detail Panel
   ════════════════════════════════════════════════ */
function TplDetailPanel({ t, cats, templates, onClose, onUse, onSelect }) {
  const [faved, setFaved] = React.useState(false);
  const [picking, setPicking] = React.useState(false);
  const [projSearch, setProjSearch] = React.useState('');

  if (!t) return null;

  const projects = window.PROJECTS_DATA || [];
  const filteredProjects = projects.filter(p => {
    if (!projSearch) return true;
    const q = projSearch.toLowerCase();
    return p.title.toLowerCase().includes(q) || p.desc.includes(projSearch) || p.cls.includes(projSearch);
  });

  const catMeta = (cats || []).find(c => c.id === t.cat) || {};
  const meta = TPL_META[t.cat] || TPL_META.choice;
  const PreviewComp = PREVIEW_MAP[t.cat];

  /* related templates: same category, different id */
  const related = (templates || []).filter(r => r.cat === t.cat && r.id !== t.id).slice(0, 3);

  return (
    <React.Fragment>
      {/* Overlay */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(28,28,26,.18)',
        zIndex: 100, transition: 'opacity .25s',
      }}></div>

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
        background: 'var(--surface)', borderLeft: '1px solid var(--border)',
        zIndex: 101, display: 'flex', flexDirection: 'column',
        animation: 'tplSlideIn .25s ease',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: `var(--${t.color}-bg)`, color: `var(--${t.color})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700,
          }}>{catMeta.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: -.2 }}>{t.name}</div>
            <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 1 }}>{catMeta.label}</div>
          </div>
          <button onClick={() => setFaved(!faved)} style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 14,
            color: faved ? 'var(--amber)' : 'var(--t3)', padding: 4,
            transition: 'color .12s',
          }}>{faved ? '★' : '☆'}</button>
          <span onClick={onClose} style={{ cursor: 'pointer', color: 'var(--t3)', fontSize: 14, padding: 4, lineHeight: 1 }}>✕</span>
        </div>

        {/* Scrollable body */}
        <div className="scr" style={{ flex: 1, overflowY: 'auto' }}>
          {/* Description */}
          <div style={{ padding: '16px 20px 12px' }}>
            <p style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.7, margin: 0 }}>{t.desc}</p>
            <div style={{ display: 'flex', gap: 4, marginTop: 10, flexWrap: 'wrap' }}>
              {t.tags.map(tag => <Badge key={tag} color={t.color}>{tag}</Badge>)}
              <Badge>{t.difficulty}</Badge>
            </div>
          </div>

          {/* Stats mini-bar */}
          <div style={{
            display: 'flex', gap: 1, margin: '0 20px', borderRadius: 8, overflow: 'hidden',
            background: 'var(--border)',
          }}>
            {[
              { label: '参与率', value: `${t.engagement}%`, color: 'green' },
              { label: '使用次数', value: String(t.uses), color: 'blue' },
              { label: '创建者', value: t.author, color: 'default' },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, padding: '8px 10px', background: 'var(--surface)' }}>
                <div style={{ fontSize: 8, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: .3 }}>{s.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: s.color !== 'default' ? `var(--${s.color})` : 'var(--t1)', marginTop: 2 }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* ── Interactive Preview ── */}
          <div style={{ padding: '16px 20px 0' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>学生端预览</div>
            <div style={{
              borderRadius: 10, border: '1px solid var(--border)',
              background: 'var(--bg)', overflow: 'hidden',
            }}>
              {/* Mini device bar */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
                borderBottom: '1px solid var(--border)', background: 'var(--surface)',
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red)', opacity: .5 }}></div>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--amber)', opacity: .5 }}></div>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', opacity: .5 }}></div>
                <span style={{ flex: 1, textAlign: 'center', fontSize: 9, color: 'var(--t3)' }}>{t.name}</span>
              </div>
              {PreviewComp ? <PreviewComp /> : <PreviewGeneric icon={catMeta.icon} color={t.color} />}
            </div>
          </div>

          {/* ── Config Parameters ── */}
          <div style={{ padding: '16px 20px 0' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>核心参数</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {meta.configParams.map(p => (
                <div key={p.label} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                  borderRadius: 8, background: 'var(--bg)',
                  border: '1px solid var(--border)',
                }}>
                  <span style={{ fontSize: 11, opacity: .5 }}>{p.icon}</span>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--t3)' }}>{p.label}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t1)' }}>{p.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Data Fields ── */}
          <div style={{ padding: '16px 20px 0' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>数据采集</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {meta.dataFields.map(f => (
                <span key={f} style={{
                  fontSize: 10, fontWeight: 500, padding: '3px 8px', borderRadius: 4,
                  background: 'var(--green-bg)', color: 'var(--green)',
                }}>{f}</span>
              ))}
            </div>
          </div>

          {/* ── AI Behaviors ── */}
          <div style={{ padding: '16px 20px 0' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>AI 能力</div>
            <div style={{
              padding: 12, borderRadius: 8, background: 'var(--purple-bg)',
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              {meta.aiBehaviors.map(b => (
                <div key={b} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11, color: 'var(--purple)', lineHeight: 1.5 }}>
                  <span style={{ flexShrink: 0, marginTop: 1, fontSize: 9 }}>✦</span>
                  {b}
                </div>
              ))}
            </div>
          </div>

          {/* ── Scenarios ── */}
          <div style={{ padding: '16px 20px 0' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>适用场景</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {meta.scenarios.map(s => (
                <span key={s} style={{
                  fontSize: 10, fontWeight: 500, padding: '3px 8px', borderRadius: 4,
                  background: 'var(--surface2)', color: 'var(--t2)',
                }}>{s}</span>
              ))}
            </div>
          </div>

          {/* ── Related Templates ── */}
          {related.length > 0 && !picking && (
            <div style={{ padding: '16px 20px 20px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>同类模板</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {related.map(r => (
                  <div key={r.id} onClick={() => onSelect && onSelect(r)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                      borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)',
                      cursor: 'pointer', transition: 'all .12s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--t3)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                      background: `var(--${r.color}-bg)`, color: `var(--${r.color})`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
                    }}>{catMeta.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600 }}>{r.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--t3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.desc}</div>
                    </div>
                    <span style={{ fontSize: 9, color: 'var(--t3)', flexShrink: 0 }}>{r.engagement}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Project Picker (expanded) ── */}
        {picking && (
          <div style={{
            borderTop: '1px solid var(--border)', flexShrink: 0,
            maxHeight: 260, display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              padding: '10px 20px 8px', display: 'flex', alignItems: 'center', gap: 8,
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--t1)' }}>选择目标项目</span>
              <div style={{ flex: 1 }}></div>
              <span onClick={() => { setPicking(false); setProjSearch(''); }}
                style={{ fontSize: 10, color: 'var(--t3)', cursor: 'pointer' }}>取消</span>
            </div>
            <div style={{ padding: '0 20px 8px', flexShrink: 0 }}>
              <input
                value={projSearch} onChange={e => setProjSearch(e.target.value)}
                placeholder="搜索项目..."
                autoFocus
                style={{
                  width: '100%', padding: '6px 10px', fontSize: 11, fontFamily: 'inherit',
                  border: '1px solid var(--border)', borderRadius: 6,
                  background: 'var(--bg)', outline: 'none', color: 'var(--t1)',
                }}
              />
            </div>
            <div className="scr" style={{ flex: 1, overflowY: 'auto', padding: '0 20px 10px' }}>
              {filteredProjects.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--t3)', padding: '12px 0', textAlign: 'center' }}>无匹配项目</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {filteredProjects.map(p => {
                    const st = window.STATUS_MAP?.[p.status] || { label: p.status, color: 'default' };
                    const colorKeys = ['teal', 'blue', 'purple', 'coral', 'amber', 'green'];
                    const c = colorKeys[p.id.charCodeAt(1) % colorKeys.length];
                    return (
                      <div key={p.id}
                        onClick={() => {
                          onUse(t, p);
                          setPicking(false);
                          setProjSearch('');
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                          borderRadius: 8, border: '1px solid var(--border)',
                          background: 'var(--surface)', cursor: 'pointer',
                          transition: 'all .12s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--t3)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                      >
                        <div style={{
                          width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                          background: `var(--${c}-bg)`, color: `var(--${c})`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700,
                        }}>{p.initial}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 600 }}>{p.title}</span>
                            <Badge color={st.color} style={{ fontSize: 8, padding: '1px 5px' }}>{st.label}</Badge>
                          </div>
                          <div style={{ fontSize: 9, color: 'var(--t3)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.cls} · {p.desc}
                          </div>
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--teal)', fontWeight: 500, flexShrink: 0 }}>＋</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
        }}>
          <Btn variant="ghost" small onClick={onClose}>关闭</Btn>
          <div style={{ flex: 1 }}></div>
          <Btn variant="teal" small onClick={() => setFaved(!faved)}>
            {faved ? '★ 已收藏' : '☆ 收藏'}
          </Btn>
          <Btn variant="primary" small icon={picking ? '↑' : '＋'} onClick={() => setPicking(!picking)}>
            {picking ? '收起' : '添加到项目...'}
          </Btn>
        </div>
      </div>
    </React.Fragment>
  );
}

Object.assign(window, { TplDetailPanel, TPL_META });
