# Spec — live-lesson-reading-surfaces

## Objective

为 live-lesson solution 前端添加**三端联动英语阅读课堂**：Board（投屏黑板）+ Student（学生端）+ Teacher（教师控制台）+ Demo（指挥官编排器）。基于 Claude Design 原型实现。

### 目标

1. 4 个新页面路由：`/board/:lessonId`、`/student/:lessonId`、`/teacher/:lessonId`、`/demo/:lessonId`
2. Board 黑板面：12 种 block 类型渲染 + 渐进式 reveal + scrubber 导航
3. Student 学生面：step tabs + 5 步任务面板 + 课文面板 + AI 辅助面板
4. Teacher 教师面：ambient band + step rail + hero + 矩阵镜像 + 发言提词 + cue cards + 学生队列
5. Demo 指挥官：conductor bar + 3 iframe + postMessage 同步广播
6. 设计系统迁移：从暗色(#0a0a0b)到暖中性光色(#f4f3ef, Plus Jakarta Sans)
7. 通过 tsc + vite build 构建验证
8. 遗留 math `/lesson/:lessonId` 路由继续工作

### 现状

- live-lesson frontend 运行在 :5283，有 `CourseSelectionPage` 和 `LessonPage`
- 现有 LessonPage 是暗色数学教学系统（BeatCarousel + DynamicBoard + TutoringPanel）
- live-lesson backend 运行在 :3007，提供 `GET /api/lessons` 和 `GET /api/lessons/:id/manifest`
- CCAAS core 运行在 :3001
- MCP server 已 seed 两个课程数据（含 `ideal-beauty-reading` 新课程）
- **Claude Design 原型已完成**：5 个 HTML 文件 + CSS + JS 在 `.herness-workspace/lesson-plan-to-reading/live-lesson-design/project/`

---

## Design References（必须阅读）

以下文件是实现的权威参考。**首轮必须全部读完**。

| What | File Path |
|------|-----------|
| Board 数据 schema | `solutions/business/live-lesson/.herness-workspace/lesson-plan-to-reading/live-lesson-design/project/surfaces/board-data.js` |
| Board 渲染器 | `solutions/business/live-lesson/.herness-workspace/lesson-plan-to-reading/live-lesson-design/project/surfaces/board-renderer.js` |
| 设计 tokens (颜色/字体) | `solutions/business/live-lesson/.herness-workspace/lesson-plan-to-reading/live-lesson-design/project/surfaces/colors_and_type.css` |
| Board 投屏面 HTML | `solutions/business/live-lesson/.herness-workspace/lesson-plan-to-reading/live-lesson-design/project/surfaces/board.html` |
| Student 学生面 HTML | `solutions/business/live-lesson/.herness-workspace/lesson-plan-to-reading/live-lesson-design/project/surfaces/student.html` |
| Teacher 教师面 HTML | `solutions/business/live-lesson/.herness-workspace/lesson-plan-to-reading/live-lesson-design/project/surfaces/teacher.html` |
| Demo 指挥官 HTML | `solutions/business/live-lesson/.herness-workspace/lesson-plan-to-reading/live-lesson-design/project/demo.html` |
| Spacing gap report | `solutions/business/live-lesson/.herness-workspace/lesson-plan-to-reading/live-lesson-design/project/docs/spacing-gap-report.md` |
| 设计原则 & 产品定位 | `solutions/business/live-lesson/.herness-workspace/lesson-plan-to-reading/live-lesson-design/project/README.md` |
| 教案 | `solutions/business/live-lesson/.herness-workspace/lesson-plan-to-reading/ideal-beauty.md` |
| 课程 manifest (JSON) | `solutions/business/live-lesson/data/lessons/ideal-beauty-reading/manifest.json` |

---

## Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/` | CourseSelectionPage | 课程选择（添加 Ideal Beauty 卡片） |
| `/lesson/:lessonId` | LessonPageWrapper | **保留** — 遗留数学课堂 |
| `/board/:lessonId` | BoardPage | **新增** — 投屏黑板面 |
| `/student/:lessonId` | StudentPage | **新增** — 学生端 |
| `/teacher/:lessonId` | TeacherPage | **新增** — 教师控制台 |
| `/demo/:lessonId` | DemoPage | **新增** — 指挥官编排器 |

### CourseSelectionPage 改动

在现有课程列表中，`ideal-beauty-reading` 课程的卡片点击后导航到 `/demo/ideal-beauty-reading`（不是 `/lesson/`）。
用 `lessonType` 字段区分路由目标（`"reading"` → `/demo/`，其他 → `/lesson/`）。

---

## Design System

### 光色主题 (新页面默认)

从 `colors_and_type.css` 提取 token，**使用 CSS custom properties**：

```css
:root {
  /* 暖中性底色 — 不是纯白 */
  --bg: #f4f3ef;
  --surface: #fbfaf7;
  --surface2: #edece7;
  --t1: #1c1c1a;
  --t2: #5c5b56;
  --t3: #9c9a92;
  --border: rgba(28, 28, 26, 0.07);

  /* 语义色对 */
  --blue: #1a5fa0;   --blue-bg: #e4eff8;
  --green: #2d6612;  --green-bg: #e6f2dc;
  --amber: #7a4d0e;  --amber-bg: #f6edda;
  --red: #942929;    --red-bg: #f8e6e6;
  --purple: #3a3185; --purple-bg: #eceafe;
  --teal: #0d5245;   --teal-bg: #ddf1eb;
  --coral: #6b2a14;  --coral-bg: #f7ebe5;

  /* Spacing (4px grid) */
  --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px;
  --sp-5: 20px; --sp-6: 24px; --sp-8: 32px; --sp-10: 40px; --sp-12: 48px;

  /* Radii */
  --r-pill: 3px; --r-input: 6px; --r-input-lg: 8px; --r-card: 10px; --r-card-lg: 12px;

  /* Type scale */
  --fs-hero: 26px; --fs-h1: 22px; --fs-h2: 16px; --fs-h3: 14px;
  --fs-body: 13px; --fs-body-sm: 12px; --fs-meta: 11px; --fs-badge: 10px; --fs-label: 10px;

  --fw-regular: 400; --fw-medium: 500; --fw-semibold: 600; --fw-bold: 700;
  --lh-tight: 1.3; --lh-body: 1.6; --lh-prose: 1.8;

  /* Layout */
  --sidebar-w: 232px; --topbar-h: 48px;

  /* Fonts */
  --font-body: "Plus Jakarta Sans", -apple-system, "PingFang SC", sans-serif;
  --font-hand: "Caveat", cursive;
}
```

### Board 暗色变体 (scoped)

Board 黑板面使用暗色变体，通过 `[data-surface="board"]` 选择器隔离：

```css
[data-surface="board"] {
  --bg: #1c1c1a;
  --surface: #2a2a28;
  --surface2: #3a3a38;
  --t1: rgba(240, 239, 232, 0.85);
  --t2: rgba(240, 239, 232, 0.5);
  --t3: rgba(240, 239, 232, 0.2);
  --border: rgba(240, 239, 232, 0.08);
  --board-accent: #5dcaa5;
}
```

### 字体

- **正文**: Plus Jakarta Sans (Latin) + PingFang SC (CJK)
- **手写**: Caveat (黑板列标题、annotation、student-work)

### 设计原则（来自 README.md §8）

1. **Chalk & Paper 二元视觉语言**（黑板端）：列标题 = 手写体 + 墨线下划线，不是背景填充。颜色 2+1：纸/墨 + 一个语义重点色。
2. **非对称对比**：claim 侧灰化/斜体/引号；evidence 侧墨黑/实心/加粗。
3. **课堂节奏一等公民**：所有 UI 围绕"第几步"组织。

---

## Artifact — File Structure

### 新建文件（~40 个）

```
solutions/business/live-lesson/frontend/src/
├── styles/
│   └── reading-tokens.css              # 光色主题 + board 暗色 + spacing/type/radius tokens
├── types/
│   └── reading.ts                      # ReadingLesson, BoardBlock, Step, Column 等类型
├── hooks/
│   ├── useReadingLesson.ts             # 从 manifest API 加载 reading lesson 数据
│   └── useSurfaceSync.ts              # postMessage send/receive hook
├── components/
│   ├── board/
│   │   ├── BoardStage.tsx              # 主舞台：按 step 分区 + column 布局
│   │   ├── BoardBlock.tsx              # Block 路由：按 kind 分发到具体渲染器
│   │   ├── blocks/
│   │   │   ├── HeadingBlock.tsx
│   │   │   ├── QuoteBlock.tsx
│   │   │   ├── ChipRowBlock.tsx
│   │   │   ├── FlowBlock.tsx
│   │   │   ├── MatrixBlock.tsx
│   │   │   ├── MindmapBlock.tsx
│   │   │   ├── CompareBlock.tsx
│   │   │   ├── AnnotationBlock.tsx
│   │   │   ├── StudentWorkBlock.tsx
│   │   │   ├── FormulaBlock.tsx
│   │   │   ├── ImageBlock.tsx          # placeholder
│   │   │   └── DividerBlock.tsx        # placeholder
│   │   ├── BoardScrubber.tsx           # reveal scrubber (step dots + prev/next/reset/all)
│   │   └── ColumnHeader.tsx            # Caveat 手写体列标题 + 墨线下划线
│   ├── student/
│   │   ├── StudentShell.tsx            # top bar + dock + lower layout
│   │   ├── StepTabs.tsx                # 5 step tab bar
│   │   ├── TaskPanel.tsx               # 每个 step 的任务面板
│   │   ├── TextPanel.tsx               # 课文文本面板 (¶1-8)
│   │   ├── BoardDrawer.tsx             # 可折叠 board 预览 (structure map)
│   │   └── AiPanel.tsx                 # 可折叠 AI 辅助面板
│   ├── teacher/
│   │   ├── TeacherShell.tsx            # ambient band + step rail + body
│   │   ├── AmbientBand.tsx             # 顶部环境带
│   │   ├── StepRail.tsx                # 5 步按钮行
│   │   ├── HeroSection.tsx             # 当前步骤描述 + 统计
│   │   ├── MatrixCard.tsx              # 班级矩阵填充进度
│   │   ├── SpeechLine.tsx              # "say out loud" 台词卡
│   │   ├── CueCards.tsx                # 3 个 cue 卡片
│   │   ├── OverviewSidebar.tsx         # 右侧概览栏（待处理/全部/已解决 tabs）
│   │   └── StudentQueue.tsx            # 学生问题队列
│   └── orchestrator/
│       ├── ConductorBar.tsx            # 指挥官顶栏
│       ├── SurfaceStage.tsx            # featured iframe + filmstrip iframes
│       └── TweaksPanel.tsx             # 布局/外壳/自动推进 设置面板
├── pages/
│   ├── BoardPage.tsx
│   ├── StudentPage.tsx
│   ├── TeacherPage.tsx
│   └── DemoPage.tsx
```

### 修改文件

| File | Change |
|------|--------|
| `src/App.tsx` | 添加 4 个新路由 |
| `src/pages/CourseSelectionPage.tsx` | reading 课程跳转到 `/demo/` |

---

## Sync Protocol

### postMessage 消息合约

```typescript
// 指挥官 → 三端
{ type: 'sync', step: 0..4 }        // 步骤变化 (0-indexed)
{ type: 'reveal', dir: 'next' | 'prev' | 'reset' | 'all' }  // reveal 控制

// 三端 → 指挥官
{ type: 'ready', role: 'student' | 'teacher' | 'board' }     // iframe 就绪
```

### 各面响应 `{type:'sync', step:N}`

| Surface | Behavior |
|---------|----------|
| Board | pointer 跳到 step=(N+1), sub=max → 该 step 全部 block 显示 |
| Student | 切到对应步骤的任务面板，刷新进度 |
| Teacher | step-rail 高亮到 N，hero/matrix/speech 同步更新 |

### Embed Mode

三端支持 `?embed=1` URL 参数，隐藏自带 chrome（lesson-bar、scrubber 等），只保留内容区。Demo 中 iframe 使用 `?embed=1`。

---

## Board 渲染器

### 12 Block 类型

| Kind | Description | Key Data |
|------|-------------|----------|
| `heading` | 全宽 step 标题 | `eyebrow`, `text`, `accent` |
| `quote` | 段落引文 + 高亮 | `paragraph`, `text`, `highlights[]` |
| `chip-row` | 水平标签云 | `items[]{text, note, tone}` |
| `flow` | 水平箭头流程图 | `arrow`, `steps[]{paragraph, label, sub}` |
| `matrix` | 表格 + mark 标记 | `headers[]`, `rows[]{tone, cells[]{text, placeholder, note, mark}}` |
| `mindmap` | 中心节点 + 分支 | `center{label, note}`, `branches[]{label, leaves[]}` |
| `compare` | 非对称对比（claim vs evidence） | `joiner`, `left{label, tone, items[]}`, `right{...}` |
| `annotation` | 教师批注 (note/warning/aha) | `kind`, `text` |
| `student-work` | 学生作品卡 (celebrate/redo/highlight) | `author`, `status`, `text` |
| `formula` | 句型模板 | `expr`, `caption` |
| `image` | 占位 | — |
| `divider` | 占位 | — |

### Progressive Reveal

- 每个 block 有 `reveal: { step: 1..5, sub: 1..N }`
- Board 维护一个 pointer `{step, sub}`，只显示 `reveal.step < pointer.step || (reveal.step === pointer.step && reveal.sub <= pointer.sub)` 的 block
- Scrubber 控制 pointer 前进/后退
- postMessage `{type:'sync', step:N}` 跳到 step=(N+1) 的 max sub

### Columns

- 每个 step 定义自己的 column layout（2 或 3 列）
- column 之间用 dashed 竖线分隔
- column header 用 Caveat 手写体 + 墨线下划线
- block 的 `region` ('L'|'C'|'R') 决定落在哪一列
- `fullBleed: true` 的 block 跨所有列

---

## Key Design Rules

1. **新页面光色主题**：`--bg: #f4f3ef`，不是暗色 `#0a0a0b`
2. **Board 暗色 scoped**：仅 `[data-surface="board"]` 内暗色
3. **CSS custom properties only**：不用 hardcoded colors（index.css 中的 token 除外）
4. **Plus Jakarta Sans**：所有新页面字体
5. **Caveat 手写体**：仅 board 的列标题、annotation、student-work
6. **Spacing tokens**：使用 `--sp-*` 而非魔数
7. **Type scale tokens**：使用 `--fs-*` 而非魔数
8. **Radius tokens**：使用 `--r-*`
9. **遗留页面不动**：LessonPage 保持暗色不变
10. **Port 5283**：frontend dev server 端口不变

---

## Frozen Constraints

| ID | Constraint | Penalty |
|----|------------|---------|
| FC-1 | `solutions/business/live-lesson/mcp-server/src/` NOT modified | D5 = 0 |
| FC-2 | `solutions/business/live-lesson/backend/src/` NOT modified | D5 = 0 |
| FC-3 | `packages/` NOT modified | D1 = 0 |
| FC-4 | `solutions/business/edu-platform/` NOT modified | D1 = 0 |
| FC-5 | `solutions/business/recipe-book/` NOT modified | D1 = 0 |
| FC-6 | Existing `/lesson/:lessonId` route still works | D1 -= 5 |
| FC-7 | Port 5283 for frontend dev server | — |
| FC-8 | React + Vite + TypeScript tech stack | — |

---

## Dependencies

Reading lesson pages share the existing `solutions/business/live-lesson/frontend/package.json` — no new dependencies needed beyond what's already installed (react, react-dom, react-router-dom, vite, typescript).

Google Fonts: `Plus Jakarta Sans` (already in existing pages) + `Caveat` (new, for board handwriting). Load via `@import` in reading-tokens.css or `<link>` in index.html.

---

## Exit Conditions

| Condition | Value |
|-----------|-------|
| Target | 95/100 |
| Pass | 90/100 |
| Max iterations | 8 |
| Diminishing returns | < 3 pts for 2 consecutive iterations |
| Cost cap | $250 |
