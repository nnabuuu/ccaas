# Jijian Harness Runtime — `@kedge-agentic/harness`

## 一句话

把 overnight-harness-builder 的模式（定义 → 跑 agent → 评估 → 决定继续 → 归档）从 CLI 世界抽象成 CCaaS 平台模块，让 Solution builder 用 session template + output schema 定义业务级的迭代/调查任务。

## 核心转换

| CLI skill | 平台模块 |
|-----------|---------|
| `claude -p` | Jijian session（每步一个 session = 天然 fresh context） |
| bash orchestrator | Orchestrator Service（编排循环） |
| `--allowedTools` | Session template 的 MCP 配置 |
| 文件系统提取分数 | OutputSchema（Solution 预定义结构） |
| progress.md | RunStore（平台级历史记录） |

## Solution builder 做什么

1. 定义 session templates（agent 角色 + MCP tools）
2. 定义 output schemas（结构化输出格式）
3. 注册 HarnessTask（pipeline + eval criteria + exit conditions）
4. 触发执行，监听进度
