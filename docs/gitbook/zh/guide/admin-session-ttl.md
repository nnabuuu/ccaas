# 会话超时配置

会话超时（Session TTL）控制一个 Agent 会话在无活动后保留多长时间。合理配置超时时间可以在用户体验和资源利用之间取得平衡。

---

## 什么是会话 TTL？

**TTL（Time-To-Live）** 是会话在最后一次活动后被自动关闭的时间。超时后平台将释放该会话占用的并发槽位，供其他用户使用。

- **短 TTL（如 5 分钟）**：快速释放资源，适合高并发、短对话场景。
- **长 TTL（如 30 分钟）**：用户离开后仍可继续对话，适合深度分析或复杂任务。

---

## 按套餐的 TTL 上限

不同套餐对应不同的默认 TTL 与最大可配置 TTL：

| 套餐 | 默认 TTL | 最大 TTL |
|------|---------|---------|
| **Free** | 5 分钟（300000ms） | 5 分钟（300000ms） |
| **Starter** | 30 分钟（1800000ms） | 30 分钟（1800000ms） |
| **Business** | 30 分钟（1800000ms） | 30 分钟（1800000ms） |
| **Enterprise** | 30 分钟（1800000ms） | 30 分钟（1800000ms） |

> **Free 套餐限制**：Free 套餐的 TTL 上限为 5 分钟，无法通过配置延长。如需更长的会话时长，请升级至 Starter 或以上套餐。

---

## 配置租户 TTL

通过管理员 API 为指定租户设置自定义 TTL：

```http
PUT /api/v1/tenants/:id
Content-Type: application/json
Authorization: Bearer <admin-api-key>

{
  "sessionTtlMs": 1800000
}
```

**说明：**
- `sessionTtlMs` 单位为毫秒，最小值为 60000（1 分钟）。
- 该值会被自动截断至套餐最大值。例如 Free 套餐传入 `1800000` 会被截断为 `300000`。
- 省略该字段时，TTL 取套餐默认值。

---

## 会话模板 TTL 覆盖

[会话模板](admin-session-templates.md)支持在模板级别设置 TTL，覆盖租户默认值：

```json
{
  "name": "quick-query",
  "template": {
    "description": "短查询模板，使用更短的超时",
    "sessionTtlMs": 120000,
    "enabledSkillSlugs": ["knowledge-search"]
  }
}
```

**注意：**
- 模板 `sessionTtlMs` 同样受套餐上限约束，保存时自动截断。
- 模板 TTL 仅在该模板被应用于会话时生效（Phase 2 功能，即将推出）。

---

## 卡死处理（maxProcessingMs）

当 Agent 进入 `processing` 状态后长时间未完成时（默认 30 分钟），平台会自动强制关闭该会话，防止并发槽位被永久占用。

| 配置项 | 默认值 | 说明 |
|-------|-------|------|
| `workspace.maxProcessingMs` | 1800000（30 分钟） | 超过此时间仍在处理中的会话将被强制关闭 |

此值为服务端硬限制，不可通过租户配置覆盖。

---

## 升级路径

如需更长的会话超时时间：

1. 在管理后台将租户套餐从 `free` 升级至 `starter` 或更高。
2. 升级后，`sessionTtlMs` 将自动重新计算为新套餐的默认值（或您之前设置的值，以较小者为准）。
3. 通过 `PUT /api/v1/tenants/:id` 更新 `sessionTtlMs` 至期望值（不超过套餐上限）。

---

## 相关文档

- [会话模板管理](admin-session-templates.md)
- [核心概念](../concepts.md)
- [定价](../platform/pricing.md)
