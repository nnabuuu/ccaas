# CCAAS Core API Reference

## 概述

Article Analyzer Solution 通过 CCAAS Core REST API 代理 LLM 调用。不直接调用 Claude API，而是通过 CCAAS Core 的 session 机制管理 agent 生命周期。

## 关键端点

### 1. 发送消息（创建/继续 Session）

```
POST /api/v1/sessions/:sessionId/messages
Content-Type: application/json
Accept: text/event-stream
```

**请求体**:
```json
{
  "tenantId": "default",
  "message": "用户消息内容",
  "enabledSkills": ["article-writer"],
  "autoClose": true,
  "templateName": "article-writer",
  "userId": "system"
}
```

**字段说明**:
- `tenantId` (string, 必须) — 租户 ID
- `message` (string, 必须) — 消息内容
- `enabledSkills` (string[], 可选) — 启用的 skill slugs
- `autoClose` (boolean, 可选) — 处理完成后自动关闭 session
- `templateName` (string, 可选) — session template 名称
- `userId` (string, 可选) — 用户 ID
- `appendSystemPrompt` (string, 可选) — 追加的系统提示
- `afterSeq` (number, 可选) — 重连序号（重放缓冲事件）

**注意**: 如果 sessionId 对应的 session 不存在，会自动创建。

### 2. SSE 事件流格式

响应为 `text/event-stream`，每个事件格式：
```
id: {seq}
data: {"seq":1,"sessionId":"...","timestamp":"...","event":{...}}
```

**关键事件类型**:

| type | 说明 | 字段 |
|------|------|------|
| `text_delta` | LLM 文本流 | `delta: string` |
| `agent_status` | Agent 状态变化 | `status: 'idle'\|'thinking'\|'executing'\|'complete'\|'error'` |
| `token_usage` | Token 统计 | `inputTokens, outputTokens, estimatedCostUsd, model` |
| `tool_activity` | 工具调用 | `toolName, phase: 'start'\|'end', toolOutput` |
| `done` | 流结束 | (无) |

**CcaasSessionProvider 消费流程**:
1. 发 POST 请求，获取 SSE 流
2. 逐行解析 `data:` 行的 JSON
3. 收集所有 `text_delta` 的 `delta` → 拼接为最终文本
4. 收集 `token_usage` 事件的 token 统计
5. 等到 `agent_status` 的 `status === 'idle'` 或收到 `done` 事件 → 结束
6. 返回 `SessionResult { text, tokensUsed, finishReason }`

### 3. 获取 Token 使用量

```
GET /api/v1/sessions/:sessionId/token-usage
```

**响应**:
```json
{
  "events": [...],
  "summary": {
    "totalInputTokens": 5000,
    "totalOutputTokens": 2000,
    "totalCachedTokens": 0,
    "totalReasoningTokens": 0,
    "totalCostUsd": 0.025,
    "requestCount": 1
  }
}
```

### 4. 取消 Session

```
POST /api/v1/sessions/:sessionId/cancel
```

## CcaasSessionProvider 映射

```
SessionProvider 接口          →  CCAAS Core API
─────────────────────────────────────────────────────
createSession(params)         →  生成 UUID，存储 templateId 到内部 Map
sendMessage(sessionId, msg)   →  存储 message 到内部 Map（延迟发送）
waitForCompletion(sessionId)  →  POST /api/v1/sessions/{id}/messages + 消费 SSE
getTokenUsage(sessionId)      →  GET /api/v1/sessions/{id}/token-usage
```

**关键实现细节**:
- `createSession` 不调 CCAAS API，只生成本地 sessionId（UUID）
- `sendMessage` 只在内存中存消息，不发请求
- `waitForCompletion` 才真正发 POST 请求，因为 CCAAS 的发消息和等待是同一个请求
- SSE 流结束后提取文本和 token 统计

## Skill 配置

需要在 CCAAS Core 中预先配置两个 skill：
- `article-writer` — 文章写作 skill
- `article-analyzer` — 文章分析 skill

如果 CCAAS Core 未配置这些 skill，CcaasSessionProvider 应该在 enabledSkills 为空时也能工作（使用默认 skill/无 skill 模式）。

## 环境变量

```
CCAAS_BASE_URL=http://localhost:3001   # CCAAS Core 地址
CCAAS_TENANT_ID=default                # 租户 ID
```
