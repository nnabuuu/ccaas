/* ════════════════════════════════════════════════
   Platform Home — Sidebar + Project List + Skills/Connectors
   精准教学平台 · 创作中心
   ════════════════════════════════════════════════ */

/* ── SVG Icon helper ── */
const svgP = { width: 13, height: 13, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none', stroke: 'currentColor', display: 'block' };

function SbIcon({ d }) {
  return <svg viewBox="0 0 24 24" style={svgP} dangerouslySetInnerHTML={{ __html: d }} />;
}

/* ── Navigation config ── */
const NAV = [
  { section: '工作台' },
  { id: 'projects', label: '课程项目', icon: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h8"/>', badge: null },
  { id: 'templates', label: '模板库', icon: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>' },
  { section: '平台能力' },
  { id: 'skills', label: 'AI 技能', icon: '<path d="M12 3l1.5 4.5H18l-3.7 2.7 1.4 4.3L12 11.8l-3.7 2.7 1.4-4.3L6 7.5h4.5z"/><path d="M19 18l.6 1.8H21.4l-1.5 1.1.6 1.8-1.5-1.1-1.5 1.1.6-1.8-1.5-1.1h1.8z"/>', badgeColor: 'purple' },
  { id: 'connectors', label: '连接器 · MCP', icon: '<path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>', badgeColor: 'teal' },
];

/* ── Project data ── */
const PROJECTS_DATA = [
  { id: 'p1', title: 'Ideal Beauty', initial: 'I', subject: '英语', grade: '高一', cls: '高一(3)班', status: 'active', duration: 45, steps: 5, modules: 13, aiModules: 2, lastModified: '2 分钟前', author: '陈老师', desc: 'Unit 3 · 阅读理解 + 批判思维', href: 'creator-v6.html' },
  { id: 'p2', title: 'Literature & Life', initial: 'L', subject: '英语', grade: '高一', cls: '高一(1)班', status: 'active', duration: 45, steps: 5, modules: 12, aiModules: 3, lastModified: '昨天', author: '陈老师', desc: 'Unit 6 · 文学赏析 + 推断能力' },
  { id: 'p3', title: 'Space Exploration', initial: 'S', subject: '英语', grade: '高一', cls: '高一(3)班', status: 'review', duration: 40, steps: 4, modules: 11, aiModules: 2, lastModified: '2 天前', author: '陈老师', desc: 'Unit 4 · 科技话题 + 信息提取' },
  { id: 'p4', title: 'The Great Wall', initial: 'G', subject: '英语', grade: '高一', cls: '高一(1)班', status: 'completed', duration: 40, steps: 4, modules: 10, aiModules: 1, lastModified: '3 天前', author: '陈老师', desc: 'Unit 1 · 文化遗产 + 观点表达' },
  { id: 'p5', title: 'Climate Change', initial: 'C', subject: '英语', grade: '高一', cls: '高一(2)班', status: 'draft', duration: 0, steps: 2, modules: 4, aiModules: 0, lastModified: '1 周前', author: '陈老师', desc: 'Unit 5 · 环境议题 + 议论文结构' },
  { id: 'p6', title: 'Digital Life', initial: 'D', subject: '英语', grade: '高一', cls: '高一(2)班', status: 'draft', duration: 0, steps: 0, modules: 0, aiModules: 0, lastModified: '2 周前', author: '陈老师', desc: 'Unit 7 · 数字素养（未开始）' },
];

const STATUS_MAP = {
  active:    { label: '进行中', color: 'green' },
  completed: { label: '已完成', color: 'teal' },
  review:    { label: '审核中', color: 'blue' },
  draft:     { label: '草稿',   color: 'amber' },
};

/* ════════════════════════════════════════════════
   Sidebar
   ════════════════════════════════════════════════ */
function PlatformSidebar({ activeView, onNavigate }) {
  const connectedCount = (window.CONNECTORS_V6 || []).filter(c => c.status === 'connected').length;
  const totalConnectors = (window.CONNECTORS_V6 || []).length;

  return (
    <nav style={{
      width: 232, flexShrink: 0, background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', padding: '12px 8px',
      gap: 1, height: '100%', overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{ padding: '2px 10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 24, height: 24, borderRadius: 6, background: 'var(--t1)', color: 'var(--surface)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, flexShrink: 0,
        }}>E</div>
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: -.2 }}>精准教学</span>
      </div>

      {/* Nav items */}
      {NAV.map((item, i) => {
        if (item.section !== undefined) {
          return (
            <div key={i} style={{
              fontSize: 9, fontWeight: 600, color: 'var(--t3)',
              textTransform: 'uppercase', letterSpacing: .5,
              padding: '10px 10px 4px', whiteSpace: 'nowrap',
            }}>{item.section}</div>
          );
        }

        const isActive = activeView === item.id;
        return (
          <div key={item.id} onClick={() => onNavigate(item.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 8px', borderRadius: 6,
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
              color: isActive ? 'var(--t1)' : 'var(--t2)',
              background: isActive ? 'var(--surface2)' : 'transparent',
              position: 'relative', whiteSpace: 'nowrap',
              transition: 'all .12s',
            }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--surface2)'; }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
          >
            {/* Active rail */}
            {isActive && <div style={{
              position: 'absolute', left: -8, top: 6, bottom: 6,
              width: 3, background: 'var(--t1)', borderRadius: '0 2px 2px 0',
            }}></div>}

            {/* Icon badge */}
            <div style={{
              width: 22, height: 22, borderRadius: 5, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isActive ? 'var(--t1)' : 'transparent',
              color: isActive ? 'var(--surface)' : 'var(--t2)',
              transition: 'all .12s',
            }}>
              <SbIcon d={item.icon} />
            </div>

            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>

            {/* Contextual badge */}
            {item.id === 'skills' && (
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--purple)' }}>
                {(window.SKILLS_V6 || []).length}
              </span>
            )}
            {item.id === 'connectors' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, color: 'var(--teal)' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--green)' }}></span>
                {connectedCount}/{totalConnectors}
              </span>
            )}
            {item.id === 'projects' && (
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--t3)' }}>{PROJECTS_DATA.length}</span>
            )}
            {item.id === 'templates' && (
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--t3)' }}>{(window.TEMPLATES || []).length}</span>
            )}
          </div>
        );
      })}

      {/* Spacer */}
      <div style={{ flex: 1 }}></div>

      {/* User */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 6px', borderTop: '1px solid var(--border)', marginTop: 6,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6,
          background: 'var(--teal-bg)', color: 'var(--teal)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 600, flexShrink: 0,
        }}>陈</div>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>陈老师</div>
          <div style={{ fontSize: 10, color: 'var(--t3)', whiteSpace: 'nowrap' }}>英语 · 高一</div>
        </div>
      </div>
    </nav>
  );
}

/* ════════════════════════════════════════════════
   Project Card
   ════════════════════════════════════════════════ */
function ProjectCard({ project }) {
  const [hov, setHov] = React.useState(false);
  const st = STATUS_MAP[project.status] || STATUS_MAP.draft;
  const colorKeys = ['teal', 'blue', 'purple', 'coral', 'amber', 'green'];
  const c = colorKeys[project.id.charCodeAt(1) % colorKeys.length];

  const inner = (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '16px 18px', cursor: 'pointer',
        transition: 'all .12s',
        ...(hov ? { borderColor: 'var(--t3)' } : {}),
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 8, flexShrink: 0,
          background: `var(--${c}-bg)`, color: `var(--${c})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, fontWeight: 700,
        }}>{project.initial}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: -.3 }}>{project.title}</span>
            <Badge color={st.color}>{st.label}</Badge>
          </div>
          <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>{project.desc}</div>
        </div>
      </div>

      {/* Tags */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
        <Badge color="teal">{project.subject}</Badge>
        <Badge>{project.grade}</Badge>
        <Badge color="blue">{project.cls}</Badge>
        {project.duration > 0 && <Badge color="amber">{project.duration}min</Badge>}
      </div>

      {/* Stats footer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: 'var(--t3)' }}>
        {project.steps > 0 && <span>{project.steps} Steps</span>}
        {project.modules > 0 && (
          <React.Fragment>
            <span style={{ opacity: .4 }}>·</span>
            <span>{project.modules} 模块</span>
          </React.Fragment>
        )}
        {project.aiModules > 0 && (
          <React.Fragment>
            <span style={{ opacity: .4 }}>·</span>
            <span style={{ color: 'var(--purple)', fontWeight: 500 }}>{project.aiModules} AI</span>
          </React.Fragment>
        )}
        <div style={{ flex: 1 }}></div>
        <span>{project.author}</span>
        <span style={{ opacity: .4 }}>·</span>
        <span>{project.lastModified}</span>
      </div>
    </div>
  );

  return project.href ? <a href={project.href} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>{inner}</a> : inner;
}

/* ════════════════════════════════════════════════
   Project List View
   ════════════════════════════════════════════════ */
function ProjectListView() {
  const [filter, setFilter] = React.useState('all');
  const [search, setSearch] = React.useState('');

  const filtered = PROJECTS_DATA.filter(p => {
    if (filter !== 'all' && p.status !== filter) return false;
    if (search && !p.title.toLowerCase().includes(search.toLowerCase()) && !p.desc.includes(search)) return false;
    return true;
  });

  const counts = { all: PROJECTS_DATA.length };
  PROJECTS_DATA.forEach(p => { counts[p.status] = (counts[p.status] || 0) + 1; });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Header */}
      <div style={{
        padding: '20px 32px 0', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: -.3 }}>课程项目</span>
          <Badge>{PROJECTS_DATA.length} 个项目</Badge>
        </div>
        <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 16, maxWidth: 480 }}>
          管理和编辑课程项目。每个项目包含教案设计、执行流和观察规则。
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <SearchInput value={search} onChange={setSearch} placeholder="搜索项目..." style={{ width: 240 }} />
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { id: 'all', label: '全部' },
              { id: 'active', label: '进行中' },
              { id: 'draft', label: '草稿' },
              { id: 'review', label: '审核中' },
              { id: 'completed', label: '已完成' },
            ].map(f => (
              <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}
                count={counts[f.id] || 0}
              >{f.label}</Chip>
            ))}
          </div>
          <div style={{ flex: 1 }}></div>
          <Btn variant="primary" small icon="＋">新建项目</Btn>
        </div>
      </div>

      {/* Project grid */}
      <div className="scr" style={{ flex: 1, padding: '0 32px 32px' }}>
        {filtered.length === 0 ? (
          <EmptyState icon="📋" title="暂无匹配项目" subtitle="调整筛选条件或创建新项目" />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 12 }}>
            {filtered.map(p => <ProjectCard key={p.id} project={p} />)}
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   Skills / Connectors Page Wrappers
   ════════════════════════════════════════════════ */
function SkillsPageView({ onShowToast }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div className="scr" style={{ flex: 1, padding: 32 }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <SkillsSubView onShowToast={onShowToast} />
        </div>
      </div>
    </div>
  );
}

function ConnectorsPageView({ onShowToast }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div className="scr" style={{ flex: 1, padding: 32 }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <ConnectorsSubView onShowToast={onShowToast} />
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   Templates View — Full 素材库
   ════════════════════════════════════════════════ */
function TemplatesView({ onShowToast }) {
  const [search, setSearch] = React.useState('');
  const [activeCat, setActiveCat] = React.useState('all');
  const [viewMode, setViewMode] = React.useState('grid');
  const [selectedTemplate, setSelectedTemplate] = React.useState(null);

  const cats = window.CATEGORIES || [];
  const templates = window.TEMPLATES || [];

  const filtered = templates.filter(t => {
    if (activeCat !== 'all' && t.cat !== activeCat) return false;
    if (search && !t.name.includes(search) && !t.desc.includes(search) && !t.tags.some(tag => tag.includes(search))) return false;
    return true;
  });

  const catCounts = React.useMemo(() => {
    const counts = { all: templates.length };
    templates.forEach(t => { counts[t.cat] = (counts[t.cat] || 0) + 1; });
    return counts;
  }, [templates]);

  const handleUse = (t, project) => {
    if (onShowToast && project) onShowToast(`已添加「${t.name}」到「${project.title}」`, 'success');
    setSelectedTemplate(null);
  };

  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      {/* Left — Category sidebar */}
      <div className="scr" style={{
        width: 188, flexShrink: 0, background: 'var(--surface)',
        borderRight: '1px solid var(--border)', padding: '16px 0',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '0 14px 10px' }}>
          <SectionLabel>交互类型</SectionLabel>
        </div>
        {cats.map(cat => {
          const isActive = activeCat === cat.id;
          return (
            <button key={cat.id} onClick={() => setActiveCat(cat.id)} style={{
              display: 'flex', alignItems: 'center', gap: 7, width: '100%',
              padding: '6px 14px', fontSize: 12, fontFamily: 'inherit',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--t1)' : 'var(--t2)',
              background: isActive ? 'var(--surface2)' : 'transparent',
              border: 'none', cursor: 'pointer', textAlign: 'left',
              borderRight: isActive ? '2px solid var(--t1)' : '2px solid transparent',
              transition: 'all .1s',
            }}>
              <span style={{ width: 18, textAlign: 'center', fontSize: 11, opacity: .5 }}>{cat.icon}</span>
              <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cat.label}</span>
              <span style={{ fontSize: 10, color: 'var(--t3)', flexShrink: 0 }}>{catCounts[cat.id] || 0}</span>
            </button>
          );
        })}
        <div style={{ padding: '16px 14px 8px' }}>
          <SectionLabel>快捷筛选</SectionLabel>
        </div>
        {[
          { icon: '★', label: '我的收藏', color: 'var(--t2)' },
          { icon: '⟳', label: '最近使用', color: 'var(--t2)' },
          { icon: '✦', label: 'AI 推荐', color: 'var(--purple)' },
        ].map(q => (
          <button key={q.label} style={{
            display: 'flex', alignItems: 'center', gap: 7, width: '100%',
            padding: '6px 14px', fontSize: 12, fontFamily: 'inherit', fontWeight: 400,
            color: q.color, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
          }}>
            <span style={{ width: 18, textAlign: 'center', fontSize: 11, opacity: .6 }}>{q.icon}</span>
            <span>{q.label}</span>
          </button>
        ))}
      </div>

      {/* Right — Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Header */}
        <div style={{ padding: '20px 28px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: -.3 }}>模板库</span>
            <Badge color="teal">{templates.length} 个模板</Badge>
          </div>
          <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 16, maxWidth: 520 }}>
            浏览和使用预置的交互模板。每个模板定义了一种学生交互类型，可直接添加到课程项目中。
          </div>
        </div>

        {/* Toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '0 28px 12px',
          borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <SearchInput value={search} onChange={setSearch} placeholder="搜索模板名称、标签..." style={{ width: 260 }} />
          <div style={{ flex: 1 }}></div>
          <span style={{ fontSize: 11, color: 'var(--t3)' }}>{filtered.length} 个结果</span>
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
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

        {/* Template grid / list */}
        <div className="scr" style={{ flex: 1, padding: '16px 28px 28px' }}>
          {filtered.length === 0 ? (
            <EmptyState icon="⊞" title="暂无匹配模板" subtitle="调整筛选条件或搜索关键词" />
          ) : viewMode === 'grid' ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 12,
            }}>
              {filtered.map(t => (
                <TplCard key={t.id} t={t} cats={cats} onClick={() => setSelectedTemplate(t)} />
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filtered.map(t => (
                <TplListRow key={t.id} t={t} cats={cats} onClick={() => setSelectedTemplate(t)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail panel (slide-over) */}
      {selectedTemplate && <TplDetailPanel
        t={selectedTemplate} cats={cats} templates={templates}
        onClose={() => setSelectedTemplate(null)}
        onUse={handleUse}
        onSelect={setSelectedTemplate}
      />}
    </div>
  );
}

/* ── Template Card (grid) ── */
function TplCard({ t, cats, onClick }) {
  const [hov, setHov] = React.useState(false);
  const catMeta = cats.find(c => c.id === t.cat) || {};

  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 10, padding: 16, cursor: 'pointer',
        transition: 'all .12s',
        ...(hov ? { borderColor: 'var(--t3)' } : {}),
      }}>
      {/* Preview area */}
      <div style={{
        height: 72, borderRadius: 8, marginBottom: 12,
        background: `var(--${t.color}-bg)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, color: `var(--${t.color})`, opacity: .5,
      }}>
        {catMeta.icon}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1, lineHeight: 1.3 }}>{t.name}</span>
      </div>
      <p style={{
        fontSize: 11, color: 'var(--t2)', lineHeight: 1.6, marginBottom: 10,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        margin: '0 0 10px',
      }}>
        {t.desc}
      </p>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
        {t.tags.map(tag => (
          <span key={tag} style={{
            fontSize: 10, padding: '1px 6px', borderRadius: 4,
            background: 'var(--surface2)', color: 'var(--t3)',
          }}>{tag}</span>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', fontSize: 10, color: 'var(--t3)', gap: 6 }}>
        <span>{t.author}</span>
        <span style={{ opacity: .4 }}>·</span>
        <span>参与率 {t.engagement}%</span>
        <div style={{ flex: 1 }}></div>
        <span>{t.uses} 次使用</span>
      </div>
    </div>
  );
}

/* ── Template List Row ── */
function TplListRow({ t, cats, onClick }) {
  const [hov, setHov] = React.useState(false);
  const catMeta = cats.find(c => c.id === t.cat) || {};

  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px',
        background: hov ? 'var(--surface)' : 'transparent',
        borderRadius: 8, cursor: 'pointer', transition: 'all .1s',
        border: '1px solid transparent',
        ...(hov ? { borderColor: 'var(--border)' } : {}),
      }}>
      <div style={{
        width: 34, height: 34, borderRadius: 8,
        background: `var(--${t.color}-bg)`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, color: `var(--${t.color})`, flexShrink: 0,
      }}>
        {catMeta.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{t.name}</div>
        <div style={{ fontSize: 11, color: 'var(--t3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.desc}</div>
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {t.tags.slice(0, 2).map(tag => (
          <span key={tag} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--surface2)', color: 'var(--t3)' }}>{tag}</span>
        ))}
      </div>
      <span style={{ fontSize: 10, color: 'var(--t3)', whiteSpace: 'nowrap', flexShrink: 0 }}>{t.engagement}%</span>
      <Badge color={t.color}>{t.author}</Badge>
    </div>
  );
}

/* ════════════════════════════════════════════════
   Toasts (lightweight)
   ════════════════════════════════════════════════ */
function PlatformToasts({ toasts }) {
  if (toasts.length === 0) return null;
  const iconMap = { success: '✓', warn: '⚠', info: '→' };
  return (
    <div className="v6-toast-wrap">
      {toasts.map(t => (
        <div key={t.id} className={`v6-toast ${t.type || 'info'}`}>
          <span style={{ fontSize: 10, fontWeight: 700 }}>{iconMap[t.type] || '→'}</span>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════
   Main App
   ════════════════════════════════════════════════ */
function PlatformHome() {
  const [activeView, setActiveView] = React.useState('projects');
  const [toasts, setToasts] = React.useState([]);

  const showToast = React.useCallback((msg, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 2400);
  }, []);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <PlatformSidebar activeView={activeView} onNavigate={setActiveView} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        {activeView === 'projects' && <ProjectListView />}
        {activeView === 'templates' && <TemplatesView onShowToast={showToast} />}
        {activeView === 'skills' && <SkillsPageView onShowToast={showToast} />}
        {activeView === 'connectors' && <ConnectorsPageView onShowToast={showToast} />}
      </div>
      <PlatformToasts toasts={toasts} />
    </div>
  );
}

Object.assign(window, { PlatformHome });
