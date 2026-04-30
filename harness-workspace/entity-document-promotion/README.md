# entity-document-promotion Harness

将 `@kedge-agentic/entity-document` 从 solution 级工具提升为正式 CCAAS 组件。

## 运行方式

```bash
# 完整运行（最多 8 轮迭代）
bash harness-workspace/entity-document-promotion/harness.sh

# 试运行（不执行，只估算成本）
bash harness-workspace/entity-document-promotion/harness.sh --dry-run

# 从上次中断处恢复
bash harness-workspace/entity-document-promotion/harness.sh --resume

# 设置成本上限
MAX_COST=100 bash harness-workspace/entity-document-promotion/harness.sh
```

## 前置条件

- `claude` CLI 已安装且已认证
- `packages/entity-document` 依赖已安装 (`npm install`)
- `packages/context-layer` 依赖已安装
- `solutions/business/edu-platform/backend` 依赖已安装
- 57 个基线测试通过: `cd packages/entity-document && npx vitest run`

## 目录结构

```
entity-document-promotion/
├── SPEC.md              # 冻结目标（代码变更地图、设计详情、约束）
├── EVAL_CRITERIA.md     # 评分标准（5 维度、4 条惩罚规则）
├── prompts/
│   ├── generator.md     # Generator agent 指令
│   └── evaluator.md     # Evaluator agent 指令
├── harness.sh           # 编排脚本
├── progress.md          # 跨轮次分数追踪
├── changelogs/          # 每轮 changelog
├── eval-reports/        # 每轮评分报告
└── README.md            # 本文件
```

## 退出条件

- 得分 ≥90/100
- 连续 2 轮改善 <3 分
- 达到 8 轮上限
- 超过成本上限

## 晨审检查清单

运行完成后检查：

1. `cat harness-workspace/entity-document-promotion/progress.md` — 分数走势
2. `cd packages/entity-document && npx vitest run` — 测试是否全部通过
3. `cd packages/entity-document && npx tsc --noEmit` — 编译是否干净
4. `git log --grep='entity-document.*promotion' --oneline` — 迭代历史
5. 检查最新 eval report 中的 "What's Working Well" 和 "Priority Fixes"
