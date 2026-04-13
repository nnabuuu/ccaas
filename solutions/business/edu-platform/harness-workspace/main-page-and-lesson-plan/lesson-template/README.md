# Lesson & Template Harness — Frontend 教案管理 + 模板管理

**状态: 待运行** | **目标: ≥90/100** | **最大迭代: 8 轮**

## 概述

在 edu-platform 前端实现教案 CRUD（含 BlockEditor）和模板管理（含推优）。核心是 BlockEditor — 支持 7 种内容块类型，同时服务于教案编辑（content 可写）和模板编辑（placeholder 模式）。通过 Generator/Evaluator 自动迭代达到生产可用水准。

### 依赖

- **Harness A (backend-api)** 必须先完成 — 提供 20 个 API 端点
- **Harness B (home-page)** 必须先完成 — 提供路由 + TopNav + 设计系统

### 交付物

| 交付物 | 文件路径（相对 `frontend/src/`） | 说明 |
|--------|------|---------|
| BlockEditor | `components/editor/BlockEditor.tsx` | 核心共享组件，7 种 block 类型 |
| Block 组件 | `components/editor/blocks/*.tsx` | 7 个独立 block 类型渲染 |
| BlockTypeSelector | `components/editor/BlockTypeSelector.tsx` | 块类型选择器 |
| RequirementBanner | `components/editor/RequirementBanner.tsx` | 学业要求（teal/amber） |
| 教案列表 | `pages/LessonPlanList.tsx` | 搜索+筛选+分页 |
| 教案编辑器 | `pages/LessonPlanEditor.tsx` | BlockEditor(lesson) + 侧边栏 |
| 模板列表 | `pages/TemplateList.tsx` | 双层 Tab + 卡片 |
| 模板编辑器 | `pages/TemplateEditor.tsx` | BlockEditor(template) + 建议保留 |
| 推优弹窗 | `components/template/PromoteModal.tsx` | 推优提交 |
| 类型定义 | `types/lesson-plan.ts`, `types/template.ts` | TS 类型 |

### 评分维度 (100 分)

| # | Dimension | Weight |
|---|-----------|--------|
| D1 | BlockEditor (7 block types + dual mode) | 30 |
| D2 | Visual Fidelity (3 HTML prototypes) | 25 |
| D3 | CRUD Completeness | 20 |
| D4 | Interaction | 15 |
| D5 | Code Quality | 10 |

## 前置条件

```bash
# 确保在 repo root
cd /path/to/kedge-ccaas

# 确保 Harness A 已完成
cd solutions/business/edu-platform/backend && npm run build

# 确保 Harness B 已完成（TopNav + HomePage 存在）
ls solutions/business/edu-platform/frontend/src/components/layout/TopNav.tsx
ls solutions/business/edu-platform/frontend/src/pages/HomePage.tsx

# 确保前端依赖已安装
cd solutions/business/edu-platform/frontend && npm install
```

## 运行

```bash
cd solutions/business/edu-platform/harness-workspace/main-page-and-lesson-plan/lesson-template

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
# 浏览器访问 http://localhost:5173/lesson-plans → 教案列表
# 浏览器访问 http://localhost:5173/templates → 模板列表
# 确认 / 和 /chat 仍正常
```

## 文件结构

```
lesson-template/
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
