# Harness Specification B: Frontend 首页 + 全局导航（v2 设计）

## Task

- **Artifact**: `frontend/src/pages/HomePage.tsx` + `frontend/src/components/layout/Sidebar.tsx` + `frontend/src/components/layout/TopNav.tsx` + 5 个首页子组件 + `frontend/src/styles/design-tokens.css` + 路由改造
- **Current state**: 前端是 React + Vite 的 ChatInterface wrapper（App.tsx），无路由、无传统页面
- **Target audience**: 教师用户（每天首屏体验）；评估者为 AI Evaluator + 视觉比对
- **Goal**: 在现有 frontend 中新增首页及全局导航（响应式 sidebar + top nav），保持 Chat Interface 入口不变，与 HTML 原型像素级一致
- **Dependency**: Harness A（Backend API）提供 5 个数据端点

## Context

edu-platform 前端目前只是一个 ChatInterface + LoginPage 的单页面。本任务新增 react-router-dom 路由系统、响应式双模导航（宽屏 sidebar + 窄屏 top nav）、首页四区块（问候、待办、AI 洞察、周视图+时间线），同时保持 `/chat` 路径下的 ChatInterface 入口不变。

### 参考资料

- HTML 原型：`reference/v2/原型/首页/首页.html`
- PRD：`reference/v2/文档/PRD/PRD-04-首页.md`
- 用户故事：`reference/v2/文档/用户故事/首页.md`
- 设计规范：`reference/v2/文档/设计规范.md`
- 变更记录：`reference/v2/设计包变更记录.md`

### 现有前端结构

```
frontend/
├── src/
│   ├── main.tsx              # React 18 entry
│   ├── App.tsx               # ChatInterface wrapper (useEduAuth + LoginPage + AppShell)
│   ├── components/
│   │   ├── LoginPage.tsx     # 登录/注册
│   │   ├── EduEmptyState.tsx # Chat 空状态
│   │   └── AskUserQuestionRenderer.tsx
│   ├── widgets/              # EduStepWizard, EduReviewPanel, EduMetricDashboard, EduFileCardActions
│   ├── hooks/
│   │   └── useEduAuth.ts     # Token/user/login/register
│   ├── data/
│   │   └── mock-classes.ts   # DEFAULT_CLASS
│   └── index.css
├── package.json              # React 18, Vite, @kedge-agentic/{chat-interface, react-sdk, common}
└── vite.config.ts
```

### Backend API 端点（由 Harness A 提供）

| 端点 | 用途 | 响应格式 |
|------|------|---------|
| `GET /api/dashboard/pending` | 待办事项 | `{ items: [{ type, title, count, deadline, progress, skill_status, link }], total }` |
| `GET /api/dashboard/ai-briefing` | AI 洞察 | `{ insights: [{ summary, suggested_actions: [{ label, prompt }] }], common_actions: [{ label, prompt }] }` |
| `GET /api/context/activity?date=YYYY-MM-DD` | 某日活动 | `{ items: [{ entity_type, entity_id, entity_display_name, action, detail, timestamp }] }` |
| `GET /api/context/activity/weekly-summary` | 本周统计 | `{ lesson_plan_edits, submissions_graded }` |
| `GET /api/context/activity/week-dots?week_start=YYYY-MM-DD` | 7天色点 | `{ days: { [date]: entity_type[] } }` |

## Frozen Constraints

### 不可修改的文件

- `frontend/src/components/LoginPage.tsx` — 登录页冻结
- `frontend/src/widgets/` — 所有现有 widget 冻结
- `frontend/src/hooks/useEduAuth.ts` — 认证 hook 冻结（但可导入使用）
- `solutions/business/edu-platform/backend/` — 后端冻结
- `solutions/business/edu-platform/mcp-server/` — MCP server 冻结
- `solutions/business/edu-platform/skills/` — Skills 冻结

### 可修改的文件

- `frontend/src/App.tsx` — 添加路由包装
- `frontend/src/main.tsx` — 添加 BrowserRouter
- `frontend/src/index.css` — 可添加全局样式
- `frontend/package.json` — 添加 react-router-dom

### 必须遵守的规则（v2 设计规范）

- **参考文档**：`frontend/DESIGN_SYSTEM.md`（设计系统 source of truth）和 `frontend/CLAUDE.md`（Quick Rules）
- **Token 单一来源**：所有 CSS 变量定义在 `design-tokens.css` 一个文件中（含 light + dark mode）
- **组件禁止色值字面量**：组件代码中不得出现 `'white'`、`'#fff'`、`'#000'`、`'rgba(...)'`、hex 值等 → 全部使用 `var(--token)`
- **CSS 变量命名**（v2）：`--bg` / `--surface` / `--surface2` / `--t1` / `--t2` / `--t3` / `--border`（不是 v1 的 `--bg1` / `--bg2` / `--b1`）
- **语义色命名**（v2）：`--blue` / `--blue-bg` / `--green` / `--amber` / `--red` / `--purple` / `--teal` / `--coral`（不是 v1 的 `--info-t` / `--warn-t`）
- **页面底色**：`--bg` = `#f4f3ef`（tinted neutral，不是白色）
- **卡片背景**：`--surface` = `#fbfaf7`（不是纯白 `#fff`）
- **边框**：统一 `1px solid var(--border)`，`--border` = `rgba(28,28,26,.07)`
- **字体**：`"Plus Jakarta Sans", -apple-system, "PingFang SC", sans-serif`（不是系统默认字体）
- **禁止**：box-shadow、渐变、icon font、纯黑 `#000`、纯白 `#fff`、纯灰 `#888`、emoji 功能图标
- **按钮圆角**：6px（不是 v1 的 8px）
- **卡片圆角**：10px（不是 v1 的 12px）
- **导航**：响应式双模——宽屏(≥1200px) sidebar + 窄屏(<1200px) top nav
- **首页 max-width**：800px（不是 v1 的 640px）
- **内容对齐**：左对齐（紧跟 sidebar 右侧），不居中
- Chat 入口（/chat）必须仍然可用
- loading/empty/error 状态必须处理

## Detailed Specification

### 1. 依赖安装

```bash
cd frontend && npm install react-router-dom
```

### 2. 设计系统（CSS 变量 — v2）

创建 `frontend/src/styles/design-tokens.css`：

```css
:root {
  /* 背景 */
  --bg: #f4f3ef;
  --surface: #fbfaf7;
  --surface2: #edece7;

  /* 文字 */
  --t1: #1c1c1a;
  --t2: #5c5b56;
  --t3: #9c9a92;

  /* 边框 */
  --border: rgba(28,28,26,.07);

  /* 语义色 */
  --blue: #1a5fa0;     --blue-bg: #e4eff8;
  --green: #2d6612;    --green-bg: #e6f2dc;
  --amber: #7a4d0e;    --amber-bg: #f6edda;
  --red: #942929;      --red-bg: #f8e6e6;
  --purple: #3a3185;   --purple-bg: #eceafe;
  --teal: #0d5245;     --teal-bg: #ddf1eb;
  --coral: #6b2a14;    --coral-bg: #f7ebe5;

  /* 布局 */
  --sidebar-w: 232px;

  /* 遮罩 */
  --overlay: rgba(0, 0, 0, 0.4);
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1a1a18;
    --surface: #242422;
    --surface2: #2c2c2a;
    --t1: #e8e6dc;
    --t2: #9c9a92;
    --t3: #8a8983;
    --border: rgba(255, 255, 255, 0.10);

    --blue: #85b7eb;     --blue-bg: #042c53;
    --green: #c0dd97;    --green-bg: #173404;
    --amber: #fac775;    --amber-bg: #412402;
    --red: #f09595;      --red-bg: #3d0c0c;
    --purple: #b3aff0;   --purple-bg: #1e1b3a;
    --teal: #7ed4b8;     --teal-bg: #0a2e25;
    --coral: #e8a68c;    --coral-bg: #2e1a12;

    --overlay: rgba(0, 0, 0, 0.6);
  }
}
```

**关键规则**：`design-tokens.css` 是唯一定义色值的地方。组件中**禁止**出现任何色值字面量（`'white'`、`'#fff'`、`rgba()`、hex 值）。所有颜色必须通过 `var(--token)` 引用。

字体在全局样式中设置：

```css
body {
  font-family: "Plus Jakarta Sans", -apple-system, "PingFang SC", sans-serif;
  background: var(--bg);
  color: var(--t1);
}
```

在 `main.tsx` 或 `index.css` 中 `@import './styles/design-tokens.css'`。

### 3. 路由结构

改造 `App.tsx`，添加 react-router-dom：

```
/              → HomePage（首页）
/chat          → ChatInterface（现有 AI 对话，整个 AppShell）
/lesson-plans  → placeholder（Harness C 实现）
/templates     → placeholder（Harness C 实现）
```

**关键改动**：
- `main.tsx` 包裹 `<BrowserRouter>`
- `App.tsx` 中：已登录后渲染 `<Sidebar>` + `<TopNav>` + `<Routes>`（响应式显隐）
- `/chat` 路由渲染现有 AppShell（ChatSidebar + ChatInterface）
- `/` 路由渲染 HomePage
- 未登录仍渲染 LoginPage

### 4. 导航组件（响应式双模）

#### 4.1 Sidebar（宽屏 ≥ 1200px）

**文件**: `frontend/src/components/layout/Sidebar.tsx`

左侧固定 sidebar，宽屏可见，窄屏隐藏。

```css
.sidebar {
  position: fixed; top: 0; left: 0; bottom: 0;
  width: 232px;
  background: var(--surface);
  display: none;
}
@media (min-width: 1200px) { .sidebar { display: flex; flex-direction: column; } }
```

**结构**（匹配 v2 设计规范 §5.2）：

```
┌───────────────────────┐
│ 精准教学 (logo 14px 700)│
│ ─────────────────────  │
│ 导航 (section label)    │
│ [🏠] 首页              │
│ [📋] 教案  ← active    │
│ [📊] 课堂              │
│ [📝] 作业  [3]          │
│ [📈] 学情              │
│ [📁] 资源              │
│ ─────────────────────  │
│ 管理 (section label)    │
│ [⚙] 管理              │
│                        │
│ ─────────────────────  │
│ [陈] 陈老师             │
│     数学·八年级         │
└───────────────────────┘
```

**实现要点**：
- 导航项高度 36px，图标 20x20 圆角方块内嵌 12x12 SVG（Lucide 风格线条）
- 激活态：左侧 3px `var(--t1)` 竖线 + `var(--surface2)` 背景 + 图标反色（黑底白 icon）
- Hover 态：`background: var(--surface2)`
- Section label：`font-size: 10px; font-weight: 600; color: var(--t3); text-transform: uppercase; letter-spacing: .5px`
- 红点角标（作业右侧）：`background: var(--red-bg); color: var(--red); font-size: 9px; padding: 1px 4px; border-radius: 4px`
- 底部用户信息：头像（首字圆角方块 28x28, border-radius 6px）+ 姓名 + 角色（`font-size: 11px; color: var(--t3)`）

#### 4.2 TopNav（窄屏 < 1200px）

**文件**: `frontend/src/components/layout/TopNav.tsx`

窄屏水平导航栏，宽屏隐藏。

```css
.topnav {
  height: 48px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  display: flex;
}
@media (min-width: 1200px) { .topnav { display: none; } }
```

**结构**：
```
┌──────────────────────────────────────────────────────────┐
│ 精准教学    首页  教案  课堂  作业[3]  学情  资源  管理     │
└──────────────────────────────────────────────────────────┘
```

**实现要点**：
- Logo: `font-size: 14px; font-weight: 700`，点击回到 `/`
- 链接: `font-size: 13px; font-weight: 500; color: var(--t2)`（注意：v2 非激活色是 `--t2` 不是 `--t3`）
- 激活态: `color: var(--t1)` + `background: var(--surface2)` pill 背景（padding 4px 10px, border-radius 6px）
- 红点角标样式同 sidebar

**路由映射**（sidebar 和 topnav 共用）：
| 链接文字 | 路径 | 备注 |
|---------|------|------|
| 首页 | `/` | — |
| 教案 | `/lesson-plans` | Harness C 实现 |
| 课堂 | — | Phase 2，暂不跳转 |
| 作业 | — | Phase 2，暂不跳转 |
| 学情 | — | Phase 2，暂不跳转 |
| 资源 | — | Phase 2，暂不跳转 |
| 管理 | — | Phase 2，暂不跳转 |

### 5. 页面布局容器

`App.tsx` 中的全局布局：

```css
.main {
  margin-left: 0;
  padding: 32px 24px 80px;
  background: var(--bg);
  min-height: 100vh;
}
@media (min-width: 1200px) {
  .main {
    margin-left: var(--sidebar-w);
    padding: 32px 48px 80px;
  }
}
```

内容区不居中，左对齐：
```css
.content { max-width: 800px; }  /* 首页，不加 margin: 0 auto */
```

### 6. 组件定义（8 个）

#### 6.1 HomePage

**文件**: `frontend/src/pages/HomePage.tsx`

页面容器，单栏布局，max-width 800px，左对齐。

渲染顺序：HeroSection → FocusCard → AISection → WeekStrip → ActivityTimeline

数据获取：`useEffect` 中并行请求 5 个 API，管理 loading/error 状态。

#### 6.2 HeroSection

**文件**: `frontend/src/components/home/HeroSection.tsx`

**Props**: `weeklySummary: { lesson_plan_edits: number; submissions_graded: number } | null`

**渲染**：
```
下午好，陈老师
3 月 17 日 周一 · 本周编辑了 4 份教案，批改了 67 份答卷
```

- 问候语根据当前时间：`< 12` → "早上好"，`< 18` → "下午好"，else → "晚上好"
- 教师姓名从 `useEduAuth()` 获取
- 统计数字用 `<strong>` 加粗
- 本周无活动时只显示日期

**样式**：
- 标题: `font-size: 24-28px; font-weight: 700; color: var(--t1)`
- 副标题: `font-size: 13px; color: var(--t3)`
- margin-bottom: 28px

#### 6.3 FocusCard

**文件**: `frontend/src/components/home/FocusCard.tsx`

**Props**: `pending: { items: PendingItem[]; total: number } | null`

**渲染**：

```
┌─────────────────────────────────────────────────┐
│ ▌ 需要处理                                [去批改] │
│ ▌ 八(2)班 SAS 专项练习 — 32 份待批改              │
│ ▌ 截止明天 · 已提交 32/38 · Skill 已预分析完成      │
└─────────────────────────────────────────────────┘
▼ 还有 2 项待处理
```

- 卡片: `background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 16px 20px`
- 左侧红色竖条: `width: 4px; background: var(--red); border-radius: 2px`
- 标签: `font-size: 10px; color: var(--t3); font-weight: 600; text-transform: uppercase; letter-spacing: .5px`
- 标题: `font-size: 14px; font-weight: 500; color: var(--t1)`
- 元信息: `font-size: 11px; color: var(--t2)`
- 按钮: `padding: 8px 16px; border-radius: 6px; background: var(--t1); color: var(--surface); font-size: 12px`
- "还有 N 项待处理" 可点击展开/收起

**空状态**：pending 为空或 null 时不渲染 FocusCard。

**交互**：
- 点击"去批改"/"去审核" → 跳转到 item.link
- 点击"还有 N 项" → toggle 展开收起
- 展开列表中每项显示标题 + 截止时间，点击整行跳转

#### 6.4 AISection

**文件**: `frontend/src/components/home/AISection.tsx`

**Props**: `briefing: AIBriefing | null`

**渲染**：
```
┌───────────────────────────────────────────────┐
│ [AI图标] AI 助手发现了几件事                      │
│ · 八(2)班 SAS 正确率连续 3 周下降...              │
│ · 课标区级解读更新了 v2.1...                      │
│ · 八(1)班王老师课堂流好评率 92%...                │
│ [分析夹角错因] [对齐课标 v2.1] [查看王老师课堂流]   │
│ [新建教案] [发布作业]                             │
│ [输入框: 或者直接问...         ] [→] 完整对话 ↗    │
└───────────────────────────────────────────────┘
```

**子结构**：
1. **Header**: 紫色 AI 图标（22×22 圆角方块 + SVG）+ 紫色标题
2. **Insight 列表**: 每条前有紫色小圆点（4px, opacity .5），正文 12px
3. **Suggestion Chips**: `background: var(--purple-bg); color: var(--purple); border: 1px solid var(--purple-bg)`
4. **Input Row**: 输入框 + 发送按钮（黑底）+ "完整对话 ↗" 链接

**交互**：
- 点击 chip → 导航到 `/chat?prompt=` + chip 对应的 prompt（URL encoded）
- 输入框回车/点击发送 → 导航到 `/chat?prompt=` + 用户输入
- "完整对话 ↗" → 导航到 `/chat`（无 prompt）

**空状态**（无 insights）：标题变为 "AI 助手"，内容为 "暂无新发现。你可以问我任何问题。"

**样式要点**：
- 整体: `background: var(--surface); border: 1px solid var(--border); border-radius: 10px`
- AI 图标底色: `var(--purple-bg)`，图标色: `var(--purple)`
- Chips: `font-size: 11px; padding: 5px 12px; border-radius: 6px`
- 输入框: `border: 1px solid var(--border); border-radius: 8px; font-size: 12px; background: var(--surface2)`
- 输入框 focus: `border-color: rgba(58,49,133,.3)`

#### 6.5 WeekStrip

**文件**: `frontend/src/components/home/WeekStrip.tsx`

**Props**: `weekDots: { days: Record<string, string[]> } | null; selectedDate: string; onSelectDate: (date: string) => void`

**渲染**：
```
  一    二    三    四    五    六   [日]
  10    11    12    13    14    15    17
  ·         ·    ·          ·              ·    ·    ·
```

每天一列：星期名（9px）+ 日期数字（13px）+ 活动色点行

**实体类型→颜色映射**：
| entity_type | CSS 变量 |
|-------------|---------|
| lesson_plan | `var(--purple)` |
| homework / submission | `var(--blue)` |
| session | `var(--green)` |
| requirement | `var(--amber)` |
| classroom_record | `var(--teal)` |
| proposal | `var(--coral)` |

**选中态**：
- 选中日期：`background: var(--t1); color: var(--surface); border-radius: 6px`
- 今天（未选中）：`background: var(--purple-bg); color: var(--purple)`
- 今天且选中：`background: var(--t1); color: var(--surface)`（选中优先）

**交互**：点击某天 → `onSelectDate(dateString)` → 父组件请求该天的 Activity

#### 6.6 ActivityTimeline

**文件**: `frontend/src/components/home/ActivityTimeline.tsx`

**Props**: `activities: ActivityItem[] | null; selectedDate: string; loading: boolean`

**渲染**：
```
今天 · 3 月 17 日
───────────────────────────────────────
● SSS/SAS 新授课教案 更新了内容块 "SAS 判定条件"     15 分钟前
● 八(2)班 SAS 专项练习 收到 32 份提交（共 38 人）      1 小时前
```

**结构**：
- 日期标题: `font-size: 10px; font-weight: 600; color: var(--t3); text-transform: uppercase; letter-spacing: .5px`
- 分隔线: `border-top: 1px solid var(--border)`
- 每条记录: 色点（6px 圆形）+ 实体名（粗体）+ 动作描述 + 时间戳
- 色点颜色与 WeekStrip 相同映射
- 时间: `font-size: 10px; color: var(--t3)`

**空状态**：所选日期无活动 → "这一天没有活动记录"

**交互**：点击某条活动 → 跳转到对应实体页面

### 7. 数据获取策略

HomePage 中使用 `useEffect` 并行请求：

```typescript
useEffect(() => {
  Promise.all([
    fetch(`${SERVER_URL}/api/dashboard/pending`).then(r => r.json()),
    fetch(`${SERVER_URL}/api/dashboard/ai-briefing`).then(r => r.json()),
    fetch(`${SERVER_URL}/api/context/activity/weekly-summary`).then(r => r.json()),
    fetch(`${SERVER_URL}/api/context/activity/week-dots?week_start=${weekStart}`).then(r => r.json()),
    fetch(`${SERVER_URL}/api/context/activity?date=${selectedDate}`).then(r => r.json()),
  ]).then(([pending, briefing, summary, dots, activity]) => {
    // setState...
  });
}, []);
```

切换日期时单独请求 `/context/activity?date=newDate`。

### 8. 文件结构总览

```
frontend/src/
├── styles/
│   └── design-tokens.css         # v2 设计系统 CSS 变量
├── pages/
│   └── HomePage.tsx              # 首页容器
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx           # 宽屏(≥1200px)左侧固定 sidebar
│   │   └── TopNav.tsx            # 窄屏(<1200px)顶部导航栏
│   └── home/
│       ├── HeroSection.tsx       # 问候 + 周概要
│       ├── FocusCard.tsx         # 待办事项
│       ├── AISection.tsx         # AI 洞察 + chips + 输入
│       ├── WeekStrip.tsx         # 周视图 7 天色点
│       └── ActivityTimeline.tsx  # 当日活动时间线
├── types/
│   └── dashboard.ts              # PendingItem, AIBriefing, ActivityItem 等 TS 类型
└── (existing files unchanged)
```

### 9. 反模式检查清单

以下 v2 设计反模式必须避免（来自设计规范.md "不使用"）：

- [ ] **无 box-shadow** — 全部用 border 替代
- [ ] **无渐变背景** — 纯色 only
- [ ] **无图标字体库** — 用内联 SVG（Lucide 风格线条图标）
- [ ] **无 hover scale** — hover 用 `background: var(--surface2)` 或 `border-color` 变化
- [ ] **无 > 12px 圆角** — 卡片 10px，按钮 6px
- [ ] **无 emoji 功能图标** — 用 SVG
- [ ] **无纯白 `#fff`** — 用 `var(--surface)` = `#fbfaf7`
- [ ] **无纯黑 `#000`** — 用 `var(--t1)` = `#1c1c1a`
- [ ] **无系统默认字体** — 用 Plus Jakarta Sans
- [ ] **无 v1 变量名** — 用 `--bg` / `--surface` / `--border`，不用 `--bg1` / `--bg2` / `--b1`

## Eval Rubric

### Scoring Dimensions (100 pts)

#### D1: Visual Fidelity (Weight: 30/100)

与 HTML 原型 `首页.html`（v2）和 v2 设计规范一致。

| Score | Description |
|-------|-------------|
| 5/5 | v2 CSS 变量全部定义并使用（`--bg/surface/surface2/t1/t2/t3/border` + 7 对语义色）；Sidebar 结构/图标/激活态与原型一致；Top nav 响应切换正确；首页四区块排列正确；Plus Jakarta Sans 字体；页面底色 `#f4f3ef`；卡片背景 `#fbfaf7`；边框 `1px solid rgba(28,28,26,.07)` |
| 4/5 | 整体一致但 1-2 处间距/字号偏差 |
| 3/5 | 布局正确但使用了 v1 变量名或遗漏颜色映射 |
| 2/5 | 只有基本布局，视觉差异明显 |
| 1/5 | 与 v2 原型大幅不同 |

**Detection method**:
1. 检查 `design-tokens.css` 存在且包含 v2 变量名（`--bg`, `--surface`, `--border` 而非 `--bg1`, `--b1`）
2. 检查 `design-tokens.css` 包含 `@media (prefers-color-scheme: dark)` block（dark mode token 覆盖）
3. `grep -rn 'box-shadow' frontend/src/` → 必须 = 0（除 focus outline）
4. `grep -rn 'var(--' frontend/src/components/home/ frontend/src/components/layout/` → 频繁使用 CSS 变量
5. 检查组件无色值字面量：`grep -rn "'#\|\"#\|'white'\|'black'\|rgba(" frontend/src/components/ frontend/src/pages/` → 必须 = 0（只有 design-tokens.css 中允许）
6. 浏览器截图与 v2 `首页.html` 并排比对
7. `grep -rn 'Plus Jakarta Sans' frontend/src/` → 至少 1 处引用
8. 检查 sidebar 在 ≥1200px 可见、top nav 在 <1200px 可见
9. 系统切换 Dark Mode 后验证：深色背景 + 浅色文字 + 语义色对比度正常

#### D2: Component Completeness (Weight: 25/100)

8 个组件全部实现，交互完整。

| Score | Description |
|-------|-------------|
| 5/5 | 8 组件全部存在且功能完整：Sidebar 激活态+用户信息+响应式显隐；TopNav 响应式显隐+激活态 pill；FocusCard 展开/收起；AISection chips 跳转+输入跳转；WeekStrip 日期选择；Timeline 按日切换 |
| 4/5 | 8 组件存在但 1-2 个交互不完整 |
| 3/5 | 6-7 个组件存在 |
| 2/5 | 3-5 个组件 |
| 1/5 | < 3 个组件 |

**Detection method**:
```bash
# 文件存在
ls frontend/src/components/layout/Sidebar.tsx
ls frontend/src/components/layout/TopNav.tsx
ls frontend/src/pages/HomePage.tsx
ls frontend/src/components/home/{HeroSection,FocusCard,AISection,WeekStrip,ActivityTimeline}.tsx

# 响应式切换
grep -rn 'min-width.*1200\|max-width.*1200' frontend/src/components/layout/
```

#### D3: Data Integration (Weight: 20/100)

正确调用 5 个 API，处理 loading/empty/error 状态。

| Score | Description |
|-------|-------------|
| 5/5 | 5 个 API 全部调用、数据正确渲染；loading 显示加载状态；empty 显示空状态；API 错误 graceful degrade |
| 4/5 | API 调用正确但缺少 1 种状态处理 |
| 3/5 | 3-4 个 API 调用正确 |
| 2/5 | 使用硬编码数据 |
| 1/5 | 无 API 调用 |

**Detection method**:
1. 浏览器 Network tab：加载首页时可看到 5 个 API 请求
2. 后端未启动时：首页不白屏
3. 后端无 seed 数据时：FocusCard 不显示
4. 切换 WeekStrip 日期时：Network tab 出现新请求

#### D4: Routing & Navigation (Weight: 15/100)

响应式导航正常，Chat 入口保持可用。

| Score | Description |
|-------|-------------|
| 5/5 | `/` → 首页；`/chat` → ChatInterface 完整可用；Sidebar 和 TopNav 在所有页面可见（响应式）；浏览器刷新不 404；当前路由高亮正确 |
| 4/5 | 路由基本正确但 Chat 有小问题 |
| 3/5 | Chat 入口可用但导航有问题 |
| 2/5 | 路由存在但 Chat 不可用 |
| 1/5 | 无路由 |

**Detection method**:
```bash
# 浏览器测试
# 1. 访问 / → 首页渲染
# 2. 访问 /chat → ChatInterface 渲染（可发消息）
# 3. Sidebar 点击"首页" → URL = /，激活态正确（左侧竖线+背景）
# 4. 缩小窗口 < 1200px → sidebar 消失，top nav 出现
# 5. 刷新 /chat → 仍然渲染 ChatInterface
# 6. 角标显示数字
```

#### D5: Code Quality (Weight: 10/100)

| Score | Description |
|-------|-------------|
| 5/5 | 组件拆分合理（8 个独立组件）；TypeScript 类型完整（dashboard.ts）；无 `any`；CSS 使用 v2 design-tokens 变量；Sidebar 和 TopNav 共享路由配置（不重复定义） |
| 4/5 | 基本规范但有 1-2 处 any |
| 3/5 | TypeScript 但类型不完整 |
| 2/5 | 大量 any |
| 1/5 | 代码结构混乱 |

### Penalty Rules

| Rule | Deduction | Trigger |
|------|-----------|---------|
| 使用 box-shadow | -3/处 | 任何组件使用 box-shadow |
| 硬编码颜色值 | -2/处 | 不使用 CSS 变量直接写色值 |
| Chat 入口不可用 | -15 | `/chat` 路由无法渲染 ChatInterface |
| LoginPage 失效 | -10 | 未登录状态下不显示 LoginPage |
| 使用 v1 变量名 | -5 | 使用 `--bg1`/`--bg2`/`--b1` 而非 v2 变量 |
| 使用纯白 #fff | -3 | 卡片/面板背景使用 `#fff` 而非 `--surface` |
| 无响应式导航 | -10 | 只有 top nav 或只有 sidebar，缺少响应式切换 |
| 内容居中 | -3 | 使用 `margin: 0 auto` 居中内容区 |
| 缺少 dark mode | -10 | `design-tokens.css` 无 `@media (prefers-color-scheme: dark)` block |
| 组件色值字面量 | -2/处 | 组件代码中出现 `'white'`、`'#fff'`、`rgba()` 等色值字面量 |

### Score Calculation

1. 每个维度: `(score / 5) × weight`
2. 总分 = 基础分 - Penalty 扣分（满分 100）
3. 报告最后一行: `总分: XX/100`

### Thresholds

- **Pass**: 75/100
- **Target**: 90/100

## Agent Architecture

### Generator

- **Role**: React 前端开发者，精通设计还原
- **Perspective**: 你在一个已有 ChatInterface 的前端中添加传统页面。最大风险是路由改造破坏 Chat 入口。注意 v2 设计包的所有变更（变量重命名、sidebar 导航、左对齐布局、新字体、新色值）。
- **Input**: 本 HARNESS_SPEC、v2 HTML 原型（首页.html）、v2 设计规范.md、v2 PRD-04、v2 用户故事/首页.md、现有 frontend/src/ 源码
- **Output**: 新增/修改 frontend/src/ 下的文件
- **Isolation**: 每轮 fresh context

### Evaluator

- **Role**: 独立前端质量审查员 + 视觉比对审查员
- **Perspective**: 打开浏览器并排比对 v2 原型和实际渲染。重点检查 v2 特有要素：sidebar 激活态、tinted neutral 色系、Plus Jakarta Sans 字体、左对齐布局。
- **Input**: EVAL_CRITERIA（本文件 Eval Rubric 部分）、frontend/ 源码、v2 首页.html 原型
- **Output**: eval-reports/vN-eval.md
- **Phase A**: 静态分析（文件存在、v2 变量名、grep box-shadow、grep 纯白）
- **Phase B**: 运行时验证（启动前端 → 浏览器截图比对 → 交互测试 → 响应式测试）

## Exit Conditions

- **Score threshold**: ≥ 90/100
- **Max iterations**: 8 轮
- **Diminishing returns**: 连续 2 轮提升 < 3 分
- **Cost cap**: $100
- **Regression**: 分数下降 > 5 分 → 回滚到最高分版本

## Verification Commands

```bash
# 1. 安装依赖
cd solutions/business/edu-platform/frontend && npm install

# 2. 编译检查
npx tsc --noEmit

# 3. 启动前端（需要后端已运行在 3011）
npm run dev &

# 4. 检查文件存在
ls src/styles/design-tokens.css
ls src/components/layout/Sidebar.tsx
ls src/components/layout/TopNav.tsx
ls src/pages/HomePage.tsx
ls src/components/home/HeroSection.tsx
ls src/components/home/FocusCard.tsx
ls src/components/home/AISection.tsx
ls src/components/home/WeekStrip.tsx
ls src/components/home/ActivityTimeline.tsx

# 5. v2 变量名检查
grep -c '\-\-bg:' src/styles/design-tokens.css       # → ≥ 1
grep -c '\-\-surface:' src/styles/design-tokens.css   # → ≥ 1
grep -c '\-\-border:' src/styles/design-tokens.css    # → ≥ 1
grep 'bg1\|bg2\|bg3\|\-\-b1' src/styles/design-tokens.css # → 应为空（无 v1 变量名）

# 5b. Dark mode block 检查
grep -c 'prefers-color-scheme.*dark' src/styles/design-tokens.css  # → ≥ 1

# 6. 反模式检查
grep -rn 'box-shadow' src/components/ src/pages/ src/styles/ | grep -v 'focus' | wc -l  # → 0
grep -rn "'#fff'\|\"#fff\"\|'white'\|'#000'" src/components/ src/pages/ | wc -l         # → 0
grep -rn "rgba(" src/components/ src/pages/ | wc -l                                       # → 0 (组件中无 rgba)
grep -rn 'Plus Jakarta Sans' src/                                                         # → ≥ 1

# 7. 响应式导航检查
grep -rn '1200' src/components/layout/  # → sidebar/topnav 断点

# 8. 浏览器验证
# 访问 http://localhost:5173/ → 首页渲染（tinted neutral 底色，非白底）
# 访问 http://localhost:5173/chat → Chat 仍可用
# 检查 Network tab → 5 个 API 请求
# 宽屏 → sidebar 可见；窄屏 → top nav 可见
```
