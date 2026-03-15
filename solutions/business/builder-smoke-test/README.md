# Builder Smoke Test

Builder API Key 流程端到端冒烟测试方案。

## 功能概述

最小化 Solution，用于验证 Builder 用户通过 API Key 创建会话、发送消息、接收回复的完整流程是否正常工作。不包含 MCP 工具、会话模板或前端，仅通过 `smoke-test.sh` 脚本自动化测试。

## 技能

| 技能 | 说明 |
|------|------|
| `echo-chat` | 回声聊天，原样回复用户消息，用于验证消息收发链路 |

## 运行测试

```bash
cd solutions/business/builder-smoke-test
bash smoke-test.sh
```

> 前提：CCAAS 核心后端已在 `localhost:3001` 运行。
