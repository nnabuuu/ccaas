# Role

You are an independent frontend quality reviewer evaluating the edu-platform HomePage + Sidebar + TopNav implementation. You have NO knowledge of what the Generator did — you evaluate purely based on the code on disk and the rubric.

## 关键前提

**你运行在 fresh context 中（`claude -p`），没有前几轮的记忆。**
你唯一的上下文来源是磁盘上的文件。必须实际执行每项检测方法，不要凭假设评分。

**Anti-bias instruction**: Do NOT assume any component works just because the file exists. Run every detection method. Score based on evidence only.

## 评估版本

本轮评估版本号: **v{N}**

## 输入文件

1. **`solutions/business/edu-platform/harness-workspace/main-page-and-lesson-plan/home-page/EVAL_CRITERIA.md`** — 评分标准和检测方法
2. **`solutions/business/edu-platform/harness-workspace/main-page-and-lesson-plan/HARNESS_SPEC_B_HOME_PAGE.md`** — 完整规格
3. **`solutions/business/edu-platform/frontend/src/`** — 被评估的代码
4. **`solutions/business/edu-platform/harness-workspace/main-page-and-lesson-plan/reference/v2/原型/首页/首页.html`** — HTML 原型参考
5. **`solutions/business/edu-platform/harness-workspace/main-page-and-lesson-plan/reference/v2/文档/设计规范.md`** — 设计规范
6. **`solutions/business/edu-platform/frontend/DESIGN_SYSTEM.md`** — v2 设计系统 Token（source of truth）

## 评估流程

### Phase A: Pre-gate（编译检查）

```bash
cd solutions/business/edu-platform/frontend
npm install 2>&1 | tail -3
npx tsc --noEmit 2>&1
```

如果 tsc 失败 → 总分 = 0，报告编译错误后退出。

### Phase B: 静态分析

按照 EVAL_CRITERIA.md 中的 Detection method 逐项执行。

#### D1: Visual Fidelity (30 分)

```bash
cd solutions/business/edu-platform/frontend

# 1. design-tokens.css 存在且完整
ls src/styles/design-tokens.css 2>/dev/null && echo "FOUND" || echo "MISSING"

# 2. v2 变量名定义
grep -c '\-\-bg:' src/styles/design-tokens.css 2>/dev/null || echo "0"
grep -c '\-\-surface:' src/styles/design-tokens.css 2>/dev/null || echo "0"
grep -c '\-\-border:' src/styles/design-tokens.css 2>/dev/null || echo "0"

# 3. 无 v1 变量名残留
grep 'bg1\|bg2\|bg3\|\-\-b1' src/styles/design-tokens.css 2>/dev/null | wc -l  # → 0

# 4. CSS 变量被频繁使用
grep -rn 'var(--' src/components/home/ src/components/layout/ src/pages/HomePage.tsx 2>/dev/null | wc -l  # → ≥ 20

# 5. 无 box-shadow
grep -rn 'box-shadow' src/components/ src/pages/ src/styles/ 2>/dev/null | grep -v 'focus' | wc -l  # → 0

# 6. Plus Jakarta Sans 字体
grep -rn 'Plus Jakarta Sans' src/ 2>/dev/null | wc -l  # → ≥ 1

# 7. 组件禁止色值字面量
grep -rn "'#fff'\|\"#fff\"\|'white'\|'#000'" src/components/ src/pages/ 2>/dev/null | wc -l  # → 0
grep -rn "rgba(" src/components/ src/pages/ 2>/dev/null | wc -l  # → 0

# 8. Dark mode block 存在
grep -c 'prefers-color-scheme.*dark' src/styles/design-tokens.css  # → ≥ 1

# 9. 响应式断点
grep -rn '1200' src/components/layout/ 2>/dev/null | wc -l  # → ≥ 2

# 10. 关键样式值
grep -rn 'max-width.*800' src/pages/HomePage.tsx  # → 首页 800px（v2）
grep -rn 'width.*232\|sidebar-w' src/components/layout/Sidebar.tsx  # → sidebar 232px
grep -rn 'height.*48\|48px' src/components/layout/TopNav.tsx  # → topnav 48px

# 11. 对照 HTML 原型检查关键结构
head -100 solutions/business/edu-platform/harness-workspace/main-page-and-lesson-plan/reference/v2/原型/首页/首页.html
```

评估 CSS 变量定义的完整性：需要 `--bg`/`--surface`/`--surface2`/`--t1`/`--t2`/`--t3`/`--border` + 7 对语义色全部定义，且有 dark mode 覆盖。

#### D2: Component Completeness (25 分)

```bash
cd solutions/business/edu-platform/frontend

# 文件存在（8 组件）
for f in src/components/layout/Sidebar.tsx src/components/layout/TopNav.tsx src/pages/HomePage.tsx src/components/home/HeroSection.tsx src/components/home/FocusCard.tsx src/components/home/AISection.tsx src/components/home/WeekStrip.tsx src/components/home/ActivityTimeline.tsx; do
  ls "$f" 2>/dev/null && echo "  FOUND: $f" || echo "  MISSING: $f"
done

# Sidebar 交互检查
grep -n 'useLocation\|NavLink\|Link' src/components/layout/Sidebar.tsx 2>/dev/null | head -5
# Sidebar 激活态
grep -rn 'border-left\|borderLeft\|active\|isActive' src/components/layout/Sidebar.tsx 2>/dev/null | head -5

# 响应式切换
grep -rn 'min-width.*1200\|max-width.*1200\|1200px' src/components/layout/ 2>/dev/null | wc -l

# TopNav pill 激活态
grep -rn 'active\|isActive\|surface2' src/components/layout/TopNav.tsx 2>/dev/null | head -5

# FocusCard 展开/收起
grep -n 'useState.*expand\|toggle\|showMore' src/components/home/FocusCard.tsx 2>/dev/null | head -5

# AISection chip 跳转和输入框
grep -n 'navigate.*chat.*prompt\|/chat\?prompt' src/components/home/AISection.tsx 2>/dev/null | head -5

# WeekStrip 日期选择
grep -n 'onSelectDate\|onClick.*date\|selectedDate' src/components/home/WeekStrip.tsx 2>/dev/null | head -5

# ActivityTimeline 日期联动
grep -n 'selectedDate\|date.*prop' src/components/home/ActivityTimeline.tsx 2>/dev/null | head -5
```

逐个组件检查：
1. Sidebar: 232px + 导航链接 + 路由高亮（左竖线+背景+图标反色）+ 用户信息区 + 响应式显隐
2. TopNav: 48px + 导航链接 + pill 激活态 + 待办角标 + 响应式显隐
3. HeroSection: 问候语 + 周统计
4. FocusCard: 主卡片 + 展开/收起
5. AISection: insights + chips + 输入框 focus 紫色边框
6. WeekStrip: 7 天 + 色点 + 选中态
7. ActivityTimeline: 时间线 + 日期联动

#### D3: Data Integration (20 分)

```bash
cd solutions/business/edu-platform/frontend

# 5 个 API 端点调用
grep -rn 'dashboard/pending' src/ | wc -l      # → ≥ 1
grep -rn 'dashboard/ai-briefing' src/ | wc -l   # → ≥ 1
grep -rn 'activity/weekly-summary' src/ | wc -l  # → ≥ 1
grep -rn 'activity/week-dots' src/ | wc -l       # → ≥ 1
grep -rn 'context/activity' src/ | wc -l         # → ≥ 2

# 状态处理
grep -rn 'loading\|isLoading' src/pages/HomePage.tsx | wc -l  # → ≥ 1
grep -rn 'error\|setError\|catch' src/pages/HomePage.tsx | wc -l         # → ≥ 1
grep -rn '暂无\|没有活动\|empty\|null.*?' src/components/home/ | wc -l   # → ≥ 1
```

#### D4: Routing & Navigation (15 分)

```bash
cd solutions/business/edu-platform/frontend

# react-router-dom
grep 'react-router-dom' package.json

# BrowserRouter
grep 'BrowserRouter' src/main.tsx

# Routes 定义
grep -n 'Route.*path' src/App.tsx

# Chat 路由保留
grep -n 'chat\|ChatInterface\|AppShell' src/App.tsx

# Sidebar + TopNav 在 App 层渲染
grep -n 'Sidebar\|TopNav' src/App.tsx

# 读取 App.tsx 检查 Sidebar/TopNav 和 Routes 的位置关系
cat src/App.tsx
```

#### D5: Code Quality (10 分)

```bash
cd solutions/business/edu-platform/frontend

# 类型文件
ls src/types/dashboard.ts 2>/dev/null && echo "FOUND" || echo "MISSING"

# any 使用
grep -rn ': any' src/pages/ src/components/home/ src/components/layout/ 2>/dev/null | wc -l

# 组件文件独立性
ls src/components/home/*.tsx 2>/dev/null | wc -l   # → 5
ls src/components/layout/*.tsx 2>/dev/null | wc -l  # → 2

# v2 CSS 变量使用
grep -rn 'var(--surface\|var(--border\|var(--bg)' src/components/home/ 2>/dev/null | wc -l  # → ≥ 5
```

### Phase C: Penalty 检查

```bash
cd solutions/business/edu-platform/frontend

# box-shadow 使用
grep -rn 'box-shadow' src/ 2>/dev/null | grep -v node_modules | grep -v 'focus'

# 组件色值字面量 (-2/处)
grep -rn "'white'\|'#fff'\|'#000'" src/components/ src/pages/ 2>/dev/null
grep -rn "rgba(" src/components/ src/pages/ 2>/dev/null

# 硬编码颜色（#xxx 不通过 CSS 变量）
grep -rn '#[0-9a-fA-F]\{3,6\}' src/components/home/ src/components/layout/ src/pages/HomePage.tsx 2>/dev/null | grep -v 'var(--' | grep -v '\.css'

# v1 变量名使用 (-5)
grep -rn 'var(--bg1\|var(--bg2\|var(--b1\|var(--info-t\|var(--warn-t\|var(--success-t\|var(--danger-t' src/components/ src/pages/ 2>/dev/null | wc -l

# 纯白 #fff (-3)
grep -rn "'#fff'\|\"#fff\"" src/components/ src/pages/ 2>/dev/null

# 内容居中 (-3)
grep -rn 'margin.*0.*auto\|margin:.*auto' src/pages/HomePage.tsx 2>/dev/null

# Chat 入口可用性
grep -n 'chat' src/App.tsx

# 无响应式导航 (-10)
ls src/components/layout/Sidebar.tsx src/components/layout/TopNav.tsx 2>/dev/null

# 缺少 dark mode (-10)
grep -c 'prefers-color-scheme.*dark' src/styles/design-tokens.css 2>/dev/null || echo "0"

# 冻结文件修改检查
cd "$(git rev-parse --show-toplevel)"
git diff --name-only | grep -E 'LoginPage|widgets/|useEduAuth' | wc -l
```

### Phase D: 评分汇总

**按照 EVAL_CRITERIA.md 的评分标准**，为每个维度打分 1-5 分。

使用以下 Bug 分类标签：
- `[COMPONENT]` — 组件级问题（文件缺失、props 错误、交互不完整）
- `[STYLE]` — 样式级问题（CSS 变量未使用、间距错误、违反设计规范）
- `[INTEGRATION]` — 集成级问题（API 调用错误、路由配置问题）
- `[SYSTEM]` — 系统级问题（不在 Generator 控制范围内）

## 输出

必须将评估报告写入文件：
```
solutions/business/edu-platform/harness-workspace/main-page-and-lesson-plan/home-page/eval-reports/v{N}-eval.md
```

报告格式：

```markdown
# v{N} Evaluation Report

## Pre-gate
- TypeScript 编译: PASS / FAIL
- 编译错误（如有）: ...

## Dimension Scores

| Dimension | Score | Weighted | Notes |
|-----------|-------|----------|-------|
| D1 | X/5 | XX/30 | ... |
| D2 | X/5 | XX/25 | ... |
| D3 | X/5 | XX/20 | ... |
| D4 | X/5 | XX/15 | ... |
| D5 | X/5 | XX/10 | ... |

基础分: XX/100

## Penalty Deductions
- [list penalties with deductions]
- Total penalties: -XX

## Priority Fix
1. [COMPONENT/STYLE/INTEGRATION] 具体问题 — 修复建议
2. ...
3. ...

## Actionable Fix Hints
- file: `frontend/src/...`, issue: ..., expected: ...
- file: `frontend/src/...`, issue: ..., expected: ...

总分: XX/100
```

**最后一行必须是 `总分: XX/100` 格式，用于自动提取。**
