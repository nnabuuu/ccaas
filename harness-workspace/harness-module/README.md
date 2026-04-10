# Harness Module — Overnight Harness

构建 `@kedge-agentic/harness` npm 模块的自动化迭代 harness。

## Quick Start

```bash
# 运行 harness
cd harness-workspace/harness-module
bash harness.sh

# 查看进度
cat progress.md
```

## 目标
- 目标分数: 90/100
- 最大迭代: 10 轮
- Artifact: `packages/harness/` + `solutions/mock/harness-demo/`

## 文件说明

| 文件 | 用途 |
|------|------|
| HARNESS_SPEC.md | 完整规格 |
| SPEC.md | Generator 读的冻结目标 |
| EVAL_CRITERIA.md | Evaluator 读的评分标准 |
| prompts/generator.md | Generator agent 指令 |
| prompts/evaluator.md | Evaluator agent 指令 |
| progress.md | 迭代日志 |
| reference/ | 设计文档 + 模板 |
| harness.sh | 编排脚本 |

## 验证（Morning Review）

```bash
# 检查最新分数
tail -3 progress.md

# 检查代码编译
cd packages/harness && npx tsc --noEmit

# 启动 demo 验证
cd solutions/mock/harness-demo && npm run dev
curl http://localhost:3022/harness/tasks
```
