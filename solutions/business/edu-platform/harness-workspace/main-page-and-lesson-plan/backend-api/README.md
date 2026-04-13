# Backend API Harness — TypeORM + NestJS Modules

**状态: 待运行** | **目标: ≥90/100** | **最大迭代: 8 轮**

## 概述

在 edu-platform 后端新增 TypeORM 集成 + 6 个 Entity + 4 个模块 + 25 个 REST 端点 + seed 数据。通过 Generator/Evaluator 自动迭代达到生产可用水准。

### 交付物

| 交付物 | 文件路径（相对 `solutions/business/edu-platform/`） | 说明 |
|--------|------|------|
| TypeORM 配置 | `backend/src/typeorm/` | TypeORM + 独立 sqlite 文件 |
| 6 个 Entity | `backend/src/entities/` | LessonPlan, ContentBlock, Template, TemplateBlock, Promotion, Activity |
| LessonPlanModule | `backend/src/lesson-plan/` | 12 端点 CRUD + 业务逻辑 |
| TemplateModule | `backend/src/template/` | 8 端点 CRUD + 推优流程 |
| DashboardModule | `backend/src/dashboard/` | 2 端点：待办 + AI 洞察 |
| ActivityModule | `backend/src/activity/` | 3 端点：时间线 + 周统计 + 色点 |
| Seed 数据 | `backend/src/seed-typeorm.ts` | 3 教案 + 2 模板 + 20 Activity |

### 评分维度 (100 分)

| # | Dimension | Weight |
|---|-----------|--------|
| D1 | Entity & Schema | 20 |
| D2 | API Completeness (25 endpoints) | 25 |
| D3 | Business Logic (Fork/推优/快照/Activity) | 20 |
| D4 | Seed Data | 10 |
| D5 | Integration (TypeORM + better-sqlite3 共存) | 15 |
| D6 | Code Quality (@ApiTags/DTO/错误处理) | 10 |

## 前置条件

```bash
# 确保在 repo root
cd /path/to/kedge-ccaas

# 确保 backend 依赖已安装
cd solutions/business/edu-platform/backend && npm install

# 确保现有 seed 已运行（for auth/curriculum endpoints）
npm run seed 2>/dev/null || true
```

## 运行

```bash
cd solutions/business/edu-platform/harness-workspace/main-page-and-lesson-plan/backend-api

# 完整运行（最多 8 轮）
bash harness.sh

# 从断点恢复
bash harness.sh --resume

# 干运行（估算成本）
bash harness.sh --dry-run
```

## 每轮流程

```
Generator (claude -p)
  → 读 SPEC + HARNESS_SPEC + progress + eval report
  → 修改 backend/src/ 下的文件
  → 自检: npm run build + curl smoke test
  → Git snapshot

Frozen file check
  → 验证 database/curriculum/users/auth/ 未被修改

Validation
  → npm install + npm run build (失败 → 总分 0)

Evaluator (claude -p)
  → 启动后端 → curl 所有端点 → schema 检查
  → 6 维度打分 → eval-reports/vN-eval.md
  → Git snapshot

Exit conditions:
  score ≥ 90 | 连续 2 轮 <3 分提升 | 8 轮 | $100
```

## 晨间检查

```bash
# 查看进度
cat progress.md

# 查看最新 eval
ls -t eval-reports/ | head -1 | xargs cat

# 检查后端是否可构建
cd solutions/business/edu-platform/backend && npm run build

# 快速冒烟
npm run start:dev &
sleep 5
curl -s http://localhost:3011/api/lesson-plans | jq '.total'
curl -s http://localhost:3011/api/templates | jq '.total'
curl -s http://localhost:3011/api/curriculum/subjects | jq 'length'
kill %1
```

## 文件结构

```
backend-api/
├── README.md                    # 本文件
├── SPEC.md                      # 冻结约束 + Work Items
├── EVAL_CRITERIA.md             # 6 维度评分 + 检测脚本
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
