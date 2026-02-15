# API 概述

即见Agentic 提供 REST API 和 WebSocket 两种接口，配合 `@ccaas/common` 包提供完整的类型定义。

## 接口模式

即见Agentic 使用混合 REST/WebSocket 模式：

```
客户端 ──REST──→ 发送消息/管理资源
       ←─WS───  接收实时事件流
```

1. 客户端通过 REST API 发送消息或管理资源
2. 服务端通过 WebSocket 推送实时事件（文本流、状态变化、工具活动等）
3. REST API 返回操作结果后，后续事件通过 WebSocket 持续推送

## 认证

所有 API 请求需通过 API Key 认证：

```bash
# 方式 1：Bearer Token
curl -H "Authorization: Bearer YOUR_API_KEY" ...

# 方式 2：自定义 Header
curl -H "X-API-Key: YOUR_API_KEY" ...
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
| [WebSocket 事件](websocket.md) | 所有 WebSocket 事件的格式定义 |
| [错误处理](error-handling.md) | 标准化错误响应和重试策略 |
| [@ccaas/common 类型](shared-types.md) | 共享 TypeScript 类型定义 |
