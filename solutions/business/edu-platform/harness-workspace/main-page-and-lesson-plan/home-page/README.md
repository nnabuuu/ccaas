# Home Page Harness — Frontend 首页 + 全局导航

**状态: 待运行** | **目标: ≥90/100** | **最大迭代: 8 轮**

## 概述

在 edu-platform 前端新增 react-router-dom 路由 + TopNav 全局导航 + 首页四区块（HeroSection + FocusCard + AISection + WeekStrip + ActivityTimeline）+ 设计系统 CSS 变量。通过 Generator/Evaluator 自动迭代达到生产可用水准。

### 依赖

- **Harness A (backend-api)** 必须先完成 — 提供 5 个 API 端点

### 交付物

| 交付物 | 文件路径（相对 `frontend/src/`） | 说明 |
|--------|------|---------|
| 设计系统 | `styles/design-tokens.css` | CSS 变量定义 |
| 全局导航 | `components/layout/TopNav.tsx` | 44px 顶栏 + 路由链接 + 待办角标 |
| 首页容器 | `pages/HomePage.tsx` | 单栏 640px + 5 API 并行请求 |
| 问候区 | `components/home/HeroSection.tsx` | 问候语 + 周统计 |
| 待办区 | `components/home/FocusCard.tsx` | 紧急待办 + 展开/收起 |
| AI 洞察区 | `components/home/AISection.tsx` | Insights + chips + 输入框 |
| 周视图 | `components/home/WeekStrip.tsx` | 7 天色点 + 日期选择 |
| 时间线 | `components/home/ActivityTimeline.tsx` | 当日活动 + 日期联动 |
| 类型定义 | `types/dashboard.ts` | PendingItem, AIBriefing 等 |
| 路由改造 | `App.tsx`, `main.tsx` | BrowserRouter + Routes |

### 评分维度 (100 分)

| # | Dimension | Weight |
|---|-----------|--------|
| D1 | Visual Fidelity | 30 |
| D2 | Component Completeness (7 components) | 25 |
| D3 | Data Integration (5 API calls) | 20 |
| D4 | Routing & Navigation | 15 |
| D5 | Code Quality | 10 |

## 前置条件

```bash
# 确保在 repo root
cd /path/to/kedge-ccaas

# 确保 Harness A 已完成（后端 API 可用）
cd solutions/business/edu-platform/backend && npm run build

# 确保前端依赖已安装
cd solutions/business/edu-platform/frontend && npm install
```

## 运行

```bash
cd solutions/business/edu-platform/harness-workspace/main-page-and-lesson-plan/home-page

# 完整运行（最多 8 轮）
bash harness.sh

# 从断点恢复
bash harness.sh --resume

# 干运行（估算成本）
bash harness.sh --dry-run
```

## 晨间检查

```bash
# 查看进度
cat progress.md

# 查看最新 eval
ls -t eval-reports/ | head -1 | xargs cat

# 检查前端是否可编译
cd solutions/business/edu-platform/frontend && npx tsc --noEmit

# 快速验证
npm run dev &
# 浏览器访问 http://localhost:5173/  → 首页
# 浏览器访问 http://localhost:5173/chat → Chat 仍可用
```

## 文件结构

```
home-page/
├── README.md                    # 本文件
├── SPEC.md                      # 冻结约束 + Work Items
├── EVAL_CRITERIA.md             # 5 维度评分 + 检测脚本
├── harness.sh                   # 编排脚本
├── progress.md                  # 迭代分数表
├── prompts/
│   ├── generator.md             # Generator agent 指令
│   └── evaluator.md             # Evaluator agent 指令
├── eval-reports/                # 每轮评估报告
│   └── vN-eval.md
└── changelogs/                  # 每轮变更记录
    └── vN-changelog.md
```
