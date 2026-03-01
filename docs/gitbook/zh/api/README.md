# API 概述

即见Agentic 提供 REST API 和 SSE（Server-Sent Events）两种接口，配合 `@kedge-agentic/common` 包提供完整的类型定义。

## 接口模式

即见Agentic 使用 SSE 作为默认传输协议：

```
客户端 ──POST /messages──→ 发送消息
       ←──SSE 事件流──────  接收实时事件（文本、状态、工具活动等）

客户端 ──GET /events────→ 订阅推送频道
       ←──SSE 推送───────  接收后台任务完成通知（跨轮次）
```

**推荐做法**：使用 `@kedge-agentic/react-sdk`，SDK 封装了所有 SSE 连接管理和事件解析。

## 认证

所有 API 请求需通过 API Key 认证：

```bash
# 方式 1：Bearer Token
curl -H "Authorization: Bearer YOUR_API_KEY" ...

# 方式 2：自定义 Header
curl -H "X-API-Key: YOUR_API_KEY" ...

# 方式 3：请求体字段（仅 POST /messages）
{"message": "...", "tenantId": "...", "apiKey": "sk-..."}
```

### API Key Scope

| Scope | 说明 |
|-------|------|
| `skills:read` | 读取 Skill 列表和详情 |
| `skills:write` | 创建和更新 Skill |
| `skills:execute` | 执行 Skill |
| `skills:delete` | 删除 Skill |
| `mcp:read` | 读取 MCP Server 列表 |
| `mcp:write` | 管理 MCP Server |
| `chat` | 发送消息和管理会话 |
| `analytics:read` | 读取分析数据 |
| `admin` | 管理员权限 |

## 章节导航

| 章节 | 内容 |
|------|------|
| [REST API 端点](rest.md) | 所有 HTTP 端点的完整参考 |
| [SSE Transport（推荐）](sse.md) | SSE 事件流协议，端点和事件格式定义 |
| [错误处理](error-handling.md) | 标准化错误响应和重试策略 |
| [@kedge-agentic/common 类型](shared-types.md) | 共享 TypeScript 类型定义 |
