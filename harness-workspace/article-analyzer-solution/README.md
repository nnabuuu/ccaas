# Article Analyzer Solution — Harness Workspace

## 概述

通过 overnight-harness-builder 的 Code Mode 迭代模式，构建 `solutions/business/article-analyzer/` solution。Generator agent 逐轮实现并改进 solution 代码，Evaluator agent 打分，循环到 90 分。

## Artifact

- **Backend**: `solutions/business/article-analyzer/backend/` — NestJS + better-sqlite3 + HarnessModule
- **Frontend**: `solutions/business/article-analyzer/frontend/` — React + Vite + Tailwind + recharts

## 运行方式

### 启动 harness 迭代

```bash
bash harness-workspace/article-analyzer-solution/harness.sh
```

### 恢复中断的迭代

```bash
bash harness-workspace/article-analyzer-solution/harness.sh --resume
```

### 预估成本（不执行）

```bash
bash harness-workspace/article-analyzer-solution/harness.sh --dry-run
```

## 运行完成后

### 启动 backend

```bash
cd solutions/business/article-analyzer/backend
npm install
npm run build
npm start
# → http://localhost:3033
```

### 启动 frontend

```bash
cd solutions/business/article-analyzer/frontend
npm install
npm run dev
# → http://localhost:5292
```

## 文件说明

| File | Purpose |
|------|---------|
| `SPEC.md` | Solution 的完整设计规格 |
| `EVAL_CRITERIA.md` | 6 维评分标准 + 检测方法 |
| `prompts/generator.md` | Generator agent prompt |
| `prompts/evaluator.md` | Evaluator agent prompt |
| `harness.sh` | Orchestrator 脚本 |
| `progress.md` | 迭代分数走势 |
| `reference/design-plan.md` | 详细设计方案 |
| `reference/ccaas-api-reference.md` | CCAAS Core API 参考 |
| `eval-reports/` | 每轮评估报告 |
| `changelogs/` | 每轮改动记录 |

## 评分标准概览

| # | Dimension | Weight |
|---|-----------|--------|
| D1 | TypeScript 编译 | 15/100 |
| D2 | HarnessModule 集成 | 20/100 |
| D3 | Article 管理 API | 20/100 |
| D4 | 前端功能 | 20/100 |
| D5 | SQLite 持久化 | 15/100 |
| D6 | 端到端验证 | 10/100 |

Target: 90/100
