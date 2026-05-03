/* ════════════════════════════════════════════════
   Template Library Page
   ════════════════════════════════════════════════ */

const CATEGORIES = [
  { id: 'all', label: '全部', icon: '◎' },
  { id: 'choice', label: '选择题', icon: '○' },
  { id: 'fill', label: '填空题', icon: '▭' },
  { id: 'truefalse', label: '判断题', icon: '◇' },
  { id: 'matching', label: '连线题', icon: '⟷' },
  { id: 'sorting', label: '排序题', icon: '↕' },
  { id: 'classify', label: '分类题', icon: '⊞' },
  { id: 'annotate', label: '标注题', icon: '✎' },
  { id: 'poll', label: '投票', icon: '▮' },
  { id: 'discuss', label: '讨论', icon: '◬' },
  { id: 'group', label: '分组活动', icon: '⊡' },
  { id: 'video', label: '视频', icon: '▶' },
  { id: 'reading', label: '阅读', icon: '≡' },
  { id: 'timed', label: '限时任务', icon: '◷' },
  { id: 'peer', label: '互评', icon: '⇆' },
  { id: 'whiteboard', label: '白板', icon: '▢' },
];

const TEMPLATES = [
  { id: 1, name: '单选题 · 基础', cat: 'choice', desc: '单一正确答案，自动批改，支持解析展示', tags: ['自动批改', '即时反馈'], engagement: 94, uses: 328, author: '系统预设', difficulty: '通用', color: 'blue' },
  { id: 2, name: '多选题', cat: 'choice', desc: '多个正确答案，部分得分机制，适合概念辨析', tags: ['部分得分', '辨析'], engagement: 88, uses: 156, author: '系统预设', difficulty: '通用', color: 'blue' },
  { id: 3, name: '图片选择题', cat: 'choice', desc: '选项为图片，适合几何图形、实验器材辨识', tags: ['图片', '视觉'], engagement: 91, uses: 89, author: '王老师', difficulty: '通用', color: 'blue' },
  { id: 4, name: '文本填空', cat: 'fill', desc: '关键词填写，支持多种正确答案和模糊匹配', tags: ['模糊匹配', '关键词'], engagement: 82, uses: 245, author: '系统预设', difficulty: '通用', color: 'teal' },
  { id: 5, name: '数学填空', cat: 'fill', desc: '数值或表达式填写，支持等价表达式判定', tags: ['数学', '表达式'], engagement: 79, uses: 167, author: '系统预设', difficulty: '理科', color: 'teal' },
  { id: 6, name: '完形填空', cat: 'fill', desc: '段落中多处挖空，适合语文和英语课', tags: ['语文', '英语'], engagement: 85, uses: 73, author: '李老师', difficulty: '文科', color: 'teal' },
  { id: 7, name: '判断正误', cat: 'truefalse', desc: '对/错二选一，配合解释理由，加深理解', tags: ['快速', '概念检查'], engagement: 96, uses: 412, author: '系统预设', difficulty: '通用', color: 'green' },
  { id: 8, name: '纠错判断', cat: 'truefalse', desc: '判断后需指出错误位置并改正', tags: ['高阶', '纠错'], engagement: 87, uses: 58, author: '张老师', difficulty: '进阶', color: 'green' },
  { id: 9, name: '条件连线', cat: 'matching', desc: '左列条件连到右列结论，适合判定类知识', tags: ['判定', '对应'], engagement: 92, uses: 134, author: '李老师', difficulty: '通用', color: 'purple' },
  { id: 10, name: '概念配对', cat: 'matching', desc: '术语与定义配对，适合新概念教学', tags: ['定义', '术语'], engagement: 90, uses: 201, author: '系统预设', difficulty: '通用', color: 'purple' },
  { id: 11, name: '图文连线', cat: 'matching', desc: '图片与文字描述配对', tags: ['图片', '视觉'], engagement: 93, uses: 67, author: '王老师', difficulty: '通用', color: 'purple' },
  { id: 12, name: '步骤排序', cat: 'sorting', desc: '将证明或操作步骤拖入正确顺序', tags: ['逻辑', '证明'], engagement: 88, uses: 98, author: '系统预设', difficulty: '通用', color: 'amber' },
  { id: 13, name: '时间线排序', cat: 'sorting', desc: '按时间先后排列事件，适合历史和科学', tags: ['时间线', '历史'], engagement: 85, uses: 45, author: '赵老师', difficulty: '文科', color: 'amber' },
  { id: 14, name: '概念分类', cat: 'classify', desc: '将卡片拖入正确分类桶中', tags: ['分类', '拖拽'], engagement: 91, uses: 112, author: '系统预设', difficulty: '通用', color: 'coral' },
  { id: 15, name: '韦恩图分类', cat: 'classify', desc: '拖入交集和差集区域，理解概念关系', tags: ['韦恩图', '集合'], engagement: 86, uses: 34, author: '周老师', difficulty: '进阶', color: 'coral' },
  { id: 16, name: '图片标注', cat: 'annotate', desc: '在图片上标注关键部位或区域', tags: ['图片', '标注'], engagement: 89, uses: 78, author: '系统预设', difficulty: '通用', color: 'red' },
  { id: 17, name: '文本批注', cat: 'annotate', desc: '对段落文字进行划线和批注', tags: ['阅读', '批注'], engagement: 83, uses: 56, author: '系统预设', difficulty: '文科', color: 'red' },
  { id: 18, name: '即时投票', cat: 'poll', desc: '全班实时投票，柱状图即时展示分布', tags: ['实时', '全班'], engagement: 95, uses: 289, author: '系统预设', difficulty: '通用', color: 'blue' },
  { id: 19, name: '观点倾向', cat: 'poll', desc: '滑动条表达同意程度，可视化班级倾向', tags: ['观点', '连续'], engagement: 92, uses: 67, author: '系统预设', difficulty: '通用', color: 'blue' },
  { id: 20, name: '开放讨论', cat: 'discuss', desc: '学生发表观点，AI 自动归类和总结', tags: ['AI总结', '开放'], engagement: 87, uses: 145, author: '系统预设', difficulty: '通用', color: 'green' },
  { id: 21, name: '辩论站队', cat: 'discuss', desc: '选择立场后阐述理由，双方观点对比', tags: ['辩论', '对比'], engagement: 93, uses: 43, author: '刘老师', difficulty: '进阶', color: 'green' },
  { id: 22, name: '小组协作任务', cat: 'group', desc: '自动分组，组内分工，共同完成任务', tags: ['协作', '分组'], engagement: 90, uses: 87, author: '系统预设', difficulty: '通用', color: 'purple' },
  { id: 23, name: '拼图专家', cat: 'group', desc: 'Jigsaw 模式：每人负责一块，汇总拼接', tags: ['Jigsaw', '深度'], engagement: 85, uses: 29, author: '陈老师', difficulty: '进阶', color: 'purple' },
  { id: 24, name: '视频播放 + 检查点', cat: 'video', desc: '视频中嵌入暂停检查题，确保理解', tags: ['检查点', '视频'], engagement: 91, uses: 178, author: '系统预设', difficulty: '通用', color: 'teal' },
  { id: 25, name: '微课录制', cat: 'video', desc: '教师录制短视频讲解，学生异步观看', tags: ['微课', '异步'], engagement: 84, uses: 56, author: '系统预设', difficulty: '通用', color: 'teal' },
  { id: 26, name: '精读任务', cat: 'reading', desc: '分段阅读，每段设有理解检查和标注', tags: ['精读', '分段'], engagement: 82, uses: 94, author: '系统预设', difficulty: '通用', color: 'amber' },
  { id: 27, name: '资料卡片', cat: 'reading', desc: '多张信息卡翻阅，适合案例学习', tags: ['卡片', '案例'], engagement: 86, uses: 67, author: '系统预设', difficulty: '通用', color: 'amber' },
  { id: 28, name: '限时挑战', cat: 'timed', desc: '倒计时内完成一组题目，紧迫感提升专注', tags: ['倒计时', '挑战'], engagement: 94, uses: 156, author: '系统预设', difficulty: '通用', color: 'red' },
  { id: 29, name: '作品互评', cat: 'peer', desc: '学生匿名互评作品，AI 辅助评分一致性', tags: ['互评', 'AI辅助'], engagement: 81, uses: 38, author: '系统预设', difficulty: '进阶', color: 'coral' },
  { id: 30, name: '协作白板', cat: 'whiteboard', desc: '多人同步白板，自由绘制和标注', tags: ['白板', '协作'], engagement: 88, uses: 72, author: '系统预设', difficulty: '通用', color: 'green' },
];

function TemplateLibrary() {
  const [search, setSearch] = React.useState('');
  const [activeCat, setActiveCat] = React.useState('all');
  const [selectedTemplate, setSelectedTemplate] = React.useState(null);
  const [viewMode, setViewMode] = React.useState('grid'); // grid | list

  const filtered = TEMPLATES.filter(t => {
    if (activeCat !== 'all' && t.cat !== activeCat) return false;
    if (search && !t.name.includes(search) && !t.desc.includes(search) && !t.tags.some(tag => tag.includes(search))) return false;
    return true;
  });

  const catCounts = React.useMemo(() => {
    const counts = { all: TEMPLATES.length };
    TEMPLATES.forEach(t => { counts[t.cat] = (counts[t.cat] || 0) + 1; });
    return counts;
  }, []);

  return (
    <CreatorShell activePage="templates">
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Left sidebar — categories */}
        <div className="scr" style={{
          width: 200, flexShrink: 0, background: 'var(--surface)',
          borderRight: '1px solid var(--border)', padding: '16px 0',
        }}>
          <div style={{ padding: '0 16px 12px' }}>
            <SectionLabel>交互类型</SectionLabel>
          </div>
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => setActiveCat(cat.id)} style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '7px 16px', fontSize: 12, fontFamily: 'inherit',
              fontWeight: activeCat === cat.id ? 600 : 400,
              color: activeCat === cat.id ? 'var(--t1)' : 'var(--t2)',
              background: activeCat === cat.id ? 'var(--surface2)' : 'transparent',
              border: 'none', cursor: 'pointer', textAlign: 'left',
              borderRadius: 0,
              borderRight: activeCat === cat.id ? '2px solid var(--t1)' : '2px solid transparent',
              transition: 'all .1s',
            }}>
              <span style={{ width: 20, textAlign: 'center', fontSize: 12, opacity: .6 }}>{cat.icon}</span>
              <span style={{ flex: 1 }}>{cat.label}</span>
              <span style={{ fontSize: 10, color: 'var(--t3)' }}>{catCounts[cat.id] || 0}</span>
            </button>
          ))}
          <div style={{ padding: '20px 16px 8px' }}>
            <SectionLabel>快捷筛选</SectionLabel>
          </div>
          <button style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            padding: '7px 16px', fontSize: 12, fontFamily: 'inherit', fontWeight: 400,
            color: 'var(--t2)', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
          }}>
            <span style={{ width: 20, textAlign: 'center', fontSize: 12, opacity: .6 }}>★</span>
            <span>我的收藏</span>
          </button>
          <button style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            padding: '7px 16px', fontSize: 12, fontFamily: 'inherit', fontWeight: 400,
            color: 'var(--t2)', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
          }}>
            <span style={{ width: 20, textAlign: 'center', fontSize: 12, opacity: .6 }}>⟳</span>
            <span>最近使用</span>
          </button>
          <button style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            padding: '7px 16px', fontSize: 12, fontFamily: 'inherit', fontWeight: 400,
            color: 'var(--purple)', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
          }}>
            <span style={{ width: 20, textAlign: 'center', fontSize: 12 }}>✦</span>
            <span>AI 推荐</span>
          </button>
        </div>

        {/* Main content area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* Toolbar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 24px',
            borderBottom: '1px solid var(--border)', flexShrink: 0,
          }}>
            <SearchInput value={search} onChange={setSearch} placeholder="搜索模板名称、标签..." style={{ width: 280 }} />
            <div style={{ flex: 1 }}></div>
            <span style={{ fontSize: 11, color: 'var(--t3)' }}>{filtered.length} 个模板</span>
            <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 'var(--r-input)', overflow: 'hidden' }}>
              <button onClick={() => setViewMode('grid')} style={{
                padding: '4px 8px', border: 'none', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                background: viewMode === 'grid' ? 'var(--surface2)' : 'var(--surface)', color: 'var(--t2)',
              }}>⊞</button>
              <button onClick={() => setViewMode('list')} style={{
                padding: '4px 8px', border: 'none', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                background: viewMode === 'list' ? 'var(--surface2)' : 'var(--surface)', color: 'var(--t2)',
              }}>≡</button>
            </div>
          </div>

          {/* Template Grid/List */}
          <div className="scr" style={{ flex: 1, padding: 24 }}>
            {viewMode === 'grid' ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: 14,
              }}>
                {filtered.map(t => (
                  <TemplateCard key={t.id} template={t} onClick={() => setSelectedTemplate(t)} />
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {filtered.map(t => (
                  <TemplateListItem key={t.id} template={t} onClick={() => setSelectedTemplate(t)} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      <TemplateDetailModal template={selectedTemplate} onClose={() => setSelectedTemplate(null)} />
    </CreatorShell>
  );
}

/* ── Template Card (Grid) ── */
function TemplateCard({ template: t, onClick }) {
  const [hovered, setHovered] = React.useState(false);
  const catMeta = CATEGORIES.find(c => c.id === t.cat) || {};

  return (
    <div onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-card)', padding: 16, cursor: 'pointer',
        transition: 'all .15s',
        boxShadow: hovered ? '0 4px 16px rgba(0,0,0,.06)' : 'none',
        transform: hovered ? 'translateY(-1px)' : 'none',
      }}>
      {/* Preview area */}
      <div style={{
        height: 80, borderRadius: 'var(--r-input)', marginBottom: 12,
        background: `var(--${t.color}-bg)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 24, color: `var(--${t.color})`, opacity: .5,
      }}>
        {catMeta.icon}
      </div>

      <div style={{ display: 'flex', alignItems: 'start', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1, lineHeight: 1.3 }}>{t.name}</span>
      </div>
      <p style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.5, marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {t.desc}
      </p>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
        {t.tags.map(tag => (
          <span key={tag} style={{
            fontSize: 10, padding: '1px 6px', borderRadius: 'var(--r-pill)',
            background: 'var(--surface2)', color: 'var(--t3)',
          }}>{tag}</span>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, color: 'var(--t3)' }}>
        <span>{t.author}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>参与率 {t.engagement}%</span>
          <span>·</span>
          <span>用过 {t.uses} 次</span>
        </span>
      </div>
    </div>
  );
}

/* ── Template List Item ── */
function TemplateListItem({ template: t, onClick }) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px',
        background: hovered ? 'var(--surface)' : 'transparent',
        borderRadius: 'var(--r-input)', cursor: 'pointer', transition: 'all .1s',
      }}>
      <div style={{
        width: 36, height: 36, borderRadius: 'var(--r-input)',
        background: `var(--${t.color}-bg)`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, color: `var(--${t.color})`, flexShrink: 0,
      }}>
        {CATEGORIES.find(c => c.id === t.cat)?.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{t.name}</div>
        <div style={{ fontSize: 11, color: 'var(--t3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.desc}</div>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {t.tags.slice(0, 2).map(tag => (
          <span key={tag} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 'var(--r-pill)', background: 'var(--surface2)', color: 'var(--t3)' }}>{tag}</span>
        ))}
      </div>
      <span style={{ fontSize: 10, color: 'var(--t3)', whiteSpace: 'nowrap' }}>{t.engagement}%</span>
      <Badge color={t.color}>{t.author}</Badge>
    </div>
  );
}

/* ── Template Detail Modal ── */
function TemplateDetailModal({ template: t, onClose }) {
  if (!t) return null;
  const catMeta = CATEGORIES.find(c => c.id === t.cat) || {};

  return (
    <Modal open={!!t} onClose={onClose} width={640} title={null}>
      {/* Header area with colored preview */}
      <div style={{
        padding: 24, background: `var(--${t.color}-bg)`,
        display: 'flex', alignItems: 'center', gap: 20,
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 'var(--r-card)',
          background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, color: `var(--${t.color})`,
        }}>{catMeta.icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 700 }}>{t.name}</span>
            <span onClick={onClose} style={{ marginLeft: 'auto', cursor: 'pointer', color: 'var(--t3)', fontSize: 16 }}>✕</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--t2)', marginTop: 4 }}>{t.desc}</p>
          <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
            {t.tags.map(tag => <Badge key={tag} color={t.color}>{tag}</Badge>)}
            <Badge>{t.difficulty}</Badge>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: 'var(--border)' }}>
        {[
          { label: '平均参与率', value: `${t.engagement}%` },
          { label: '被使用次数', value: t.uses },
          { label: '创建者', value: t.author },
        ].map(s => (
          <div key={s.label} style={{ padding: '12px 20px', background: 'var(--surface)' }}>
            <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Schema preview */}
      <div style={{ padding: 20 }}>
        <SectionLabel style={{ marginBottom: 10 }}>数据采集字段</SectionLabel>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {['学生作答内容', '正确率', '用时', '首次正确率', 'AI 对话轮次'].map(f => (
            <span key={f} style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 'var(--r-input)',
              background: 'var(--green-bg)', color: 'var(--green)',
            }}>{f}</span>
          ))}
        </div>

        <SectionLabel style={{ marginBottom: 10 }}>AI 默认行为</SectionLabel>
        <div style={{
          padding: 12, borderRadius: 'var(--r-input)', background: 'var(--purple-bg)',
          fontSize: 11, color: 'var(--purple)', lineHeight: 1.7,
        }}>
          ✓ 自动批改并给出个性化解析<br/>
          ✓ 正确率低于 70% 时标记为薄弱点<br/>
          ✓ 汇总全班错误分布，课后生成报告
        </div>
      </div>

      {/* Actions */}
      <div style={{
        padding: '14px 20px', borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end',
      }}>
        <Btn variant="ghost" onClick={onClose}>关闭</Btn>
        <Btn variant="primary" icon="＋">添加到课程</Btn>
      </div>
    </Modal>
  );
}

Object.assign(window, { TemplateLibrary, TEMPLATES, CATEGORIES });
