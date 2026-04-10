# Article Analyzer UI/UX Redesign — Harness Workspace

## 概述

通过 overnight-harness-builder 的 Code Mode 迭代模式，对 `solutions/business/article-analyzer/frontend/` 进行全面 UI/UX 重设计。Generator agent 逐轮改进前端代码，Evaluator agent 从 6 个维度打分，循环到 95 分。

## Artifact

- **Frontend**: `solutions/business/article-analyzer/frontend/` — React + Vite + Tailwind + recharts

## 前置条件

1. 前端功能已完整（article CRUD + run + iteration display）
2. `npx tsc --noEmit` 在修改前应通过
3. 后端在 `localhost:3033` 运行（评估可视化时可选）

## 运行方式

### 启动 harness 迭代

```bash
bash harness-workspace/article-analyzer-ui-redesign/harness.sh
```

### 恢复中断的迭代

```bash
bash harness-workspace/article-analyzer-ui-redesign/harness.sh --resume
```

### 预估成本（不执行）

```bash
bash harness-workspace/article-analyzer-ui-redesign/harness.sh --dry-run
```

## Stitch 设计阶段（运行前可选）

可以先用 Stitch MCP 生成 8 个屏幕设计，导出 HTML 到 `prototypes/` 作为视觉参考：

| 屏幕 | 设备 | 内容 |
|------|------|------|
| S1: Article List (空) | DESKTOP | 空状态 + 插图 + CTA + 导航栏 |
| S2: Article List (有数据) | DESKTOP | 卡片网格 + 状态徽章 + 分数 + 筛选 Chips |
| S3: Article Detail | DESKTOP | 信息卡 + 运行历史表 + 面包屑 |
| S4: Run Progress (进行中) | DESKTOP | Hero score + 进度条 + 管道指示器 |
| S5: Run Progress (完成) | DESKTOP | 最终分数卡 + 图表 + 时间线 + 评分卡 |
| S6: Article Form | DESKTOP | 创建表单 + 验证 + 字数统计 |
| S7: Mobile List | MOBILE | 移动端文章列表 |
| S8: Dark Mode Dashboard | DESKTOP | 暗色模式 RunProgress |

## 运行完成后

### 启动 frontend

```bash
cd solutions/business/article-analyzer/frontend
npm install
npm run dev
# → http://localhost:5292
```

### 验证

```bash
# TypeScript 编译
cd solutions/business/article-analyzer/frontend && npx tsc --noEmit

# 浏览器验证
# 1. Light mode 各页面截图
# 2. Dark mode 切换后截图
# 3. 375px 移动端截图
# 4. 空状态页面截图
```

## 文件说明

| File | Purpose |
|------|---------|
| `SPEC.md` | 6 个 Work Items + 冻结约束 + 文件清单 |
| `EVAL_CRITERIA.md` | 6 维评分标准 + 检测方法 + 惩罚规则 |
| `prompts/generator.md` | Generator agent prompt |
| `prompts/evaluator.md` | Evaluator agent prompt |
| `harness.sh` | Orchestrator 脚本 |
| `progress.md` | 迭代分数走势 |
| `reference/design-tokens.md` | 色板、字体、间距规范 |
| `prototypes/` | Stitch 导出的 HTML 原型 |
| `eval-reports/` | 每轮评估报告 |
| `changelogs/` | 每轮改动记录 |

## 评分标准概览

| # | Dimension | Weight |
|---|-----------|--------|
| D1 | 视觉层级 + 布局 | 20/100 |
| D2 | 加载/错误/空状态 | 15/100 |
| D3 | 数据可视化 + 图表 | 20/100 |
| D4 | 实时反馈 (RunProgress) | 20/100 |
| D5 | 表单 + 交互打磨 | 10/100 |
| D6 | 响应式 + 暗色模式 | 15/100 |

Target: 95/100
