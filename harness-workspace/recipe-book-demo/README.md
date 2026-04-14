# Recipe Book Demo — Harness Task

从零构建一个完整的 CCAAS 租户 solution，验证 `@kedge-agentic/entity-document` + `@kedge-agentic/context-layer` 的消费体验。

## 目标

让 AI agent 在 `solutions/business/recipe-book/` 下构建一个智能食谱管理平台，包含：

1. **自定义 ingredient 块类型** — TransformRegistry 扩展
2. **Surgical diff 正确性** — str_replace 使用自定义 registry
3. **双路编辑** — RecipeProvider extends DocumentEditProvider
4. **CCAAS 租户接入** — solution.json, Skills, MCP Server, context-layer 本地控制器
5. **Solution 完整性** — NestJS + TypeORM + 种子数据 + 测试

## 参考实现

`solutions/business/edu-platform/` 是标杆。recipe-book 需要达到同等的集成深度。

## 运行

```bash
# Dry run
cd harness-workspace/recipe-book-demo && bash harness.sh --dry-run

# 实际运行
bash harness.sh

# 从上次中断处继续
bash harness.sh --resume
```

## 文件结构

```
harness-workspace/recipe-book-demo/
  README.md              # 本文件
  SPEC.md                # 冻结需求规格
  EVAL_CRITERIA.md       # 5 维评分标准
  harness.sh             # Bash 编排脚本
  prompts/
    generator.md         # Generator agent 指令
    evaluator.md         # Evaluator agent 评分模板
  progress.md            # 分数追踪表
  eval-reports/          # 每轮评估报告（自动生成）
  changelogs/            # 每轮改动日志（自动生成）
```

## 评估维度

| 维度 | 权重 | 内容 |
|------|------|------|
| D1: TransformRegistry 自定义 | 20 | ingredient transform + registry + tests |
| D2: Surgical Diff 正确性 | 20 | str_replace with custom registry |
| D3: Dual Edit Path | 20 | RecipeProvider extends DocumentEditProvider |
| D4: CCAAS 租户接入 | 20 | solution.json, skills, MCP, context-layer |
| D5: Solution 完整性 | 20 | package.json, entity, seed, tests, tsc |

## 冻结约束

- `packages/entity-document/src/**` — 不能修改
- `packages/context-layer/src/core/**` — 不能修改
- `solutions/business/edu-platform/**` — 不能修改
