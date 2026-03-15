# Scheduler Smoke Test

定时任务执行引擎端到端冒烟测试方案。

## 功能概述

最小化 Solution，用于验证 CCAAS 平台的 Scheduler（定时任务调度器）能否按计划触发会话、执行技能并返回结果。不包含 MCP 工具、会话模板或前端，仅通过 `smoke-test.sh` 脚本自动化测试。

## 技能

| 技能 | 说明 |
|------|------|
| `daily-summary` | 每日摘要生成，用于验证定时任务触发和执行链路 |

## 运行测试

```bash
cd solutions/business/scheduler-smoke-test
bash smoke-test.sh
```

> 前提：CCAAS 核心后端已在 `localhost:3001` 运行。
