# Context Layer API

Context Layer 模块的 REST API 端点。所有端点位于 `/context` 路径下，由 Solution 后端提供（不是 CCaaS 核心）。

**基础路径**：`/api/v1/context`（或根据 Solution 配置）

集成指南和概念请参阅 [Context Layer 指南](../guide/context-layer.md)。

---

## GET /context/entity-types

返回所有注册的实体类型和关系树。

**响应**：

```json
{
  "types": [
    {
      "type": "lesson_plan",
      "displayName": "教案",
      "icon": "📝",
      "color": "purple",
      "searchable": true,
      "browsable": true
    }
  ],
  "tree": {
    "roots": ["lesson_plan", "homework"],
    "relations": [
      {
        "parent": "lesson_plan",
        "child": "block",
        "label": "内容块",
        "foreignKey": "lesson_plan_id"
      }
    ]
  }
}
```

**响应字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `types` | `EntityTypeInfo[]` | 所有注册的实体类型 |
| `types[].type` | `string` | 唯一实体类型标识 |
| `types[].displayName` | `string` | 人类可读名称 |
| `types[].icon` | `string` | Emoji 图标 |
| `types[].color` | `string \| null` | 主题颜色 |
| `types[].searchable` | `boolean` | 是否支持搜索 |
| `types[].browsable` | `boolean` | 是否支持浏览 |
| `tree` | `RelationTree` | 实体关系树 |
| `tree.roots` | `string[]` | 顶层实体类型（不作为任何关系的子类型） |
| `tree.relations` | `RelationInfo[]` | 从 ORM 推断的父子关系 |

---

## GET /context/suggest

返回基于活动评分的最近实体，用于 @ picker 的初始视图。

**SLA**：< 50ms（从 Redis 缓存读取）

**查询参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `session_id` | `string` | 否 | 按 session 过滤最近使用 |
| `limit` | `string` | 否 | 最大结果数（默认：`10`） |

**响应**：

```json
{
  "recents": [
    {
      "entityType": "lesson_plan",
      "entityId": "lp_1",
      "displayName": "SSS/SAS 新授课教案",
      "icon": "📝",
      "color": "purple",
      "score": 0.95,
      "breadcrumb": null
    },
    {
      "entityType": "attachment",
      "entityId": "att_2",
      "displayName": "SAS判定条件图.png",
      "icon": "📎",
      "color": null,
      "score": 0.71,
      "breadcrumb": [
        { "type": "lesson_plan", "id": "lp_1", "displayName": "SSS/SAS 新授课教案", "icon": "📝" },
        { "type": "block", "id": "blk_2", "displayName": "SAS 概念讲解", "icon": "📦" }
      ]
    }
  ],
  "cachedAt": "2025-03-14T10:00:00.000Z"
}
```

**响应字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `recents` | `Recommendation[]` | 评分推荐实体 |
| `recents[].entityType` | `string` | 实体类型 |
| `recents[].entityId` | `string` | 实体 ID |
| `recents[].displayName` | `string` | 显示名称 |
| `recents[].icon` | `string` | Emoji 图标 |
| `recents[].color` | `string \| null` | 主题颜色 |
| `recents[].score` | `number` | 活动评分（越高 = 越近/越频繁） |
| `recents[].breadcrumb` | `BreadcrumbItem[] \| null` | 嵌套实体的父路径 |
| `cachedAt` | `string` | 缓存读取的 ISO 8601 时间戳 |

---

## GET /context/browse

按类型浏览实体，可选地限定在父实体范围内进行钻入导航。

**查询参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `entity_type` | `string` | 是 | 要浏览的实体类型 |
| `parent_type` | `string` | 否 | 父实体类型（用于钻入） |
| `parent_id` | `string` | 否 | 父实体 ID（用于钻入） |
| `page` | `string` | 否 | 页码（默认：`1`） |

**响应**：

```json
{
  "items": [
    {
      "entityType": "lesson_plan",
      "entityId": "lp_1",
      "displayName": "SSS/SAS 新授课教案",
      "subtitle": "八年级 · 数学 · 几何",
      "timestamp": "2025-03-14T10:00:00Z",
      "hasChildren": true
    }
  ],
  "total": 12,
  "page": 1
}
```

**响应字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `items` | `BrowseItem[]` | 可浏览的实体 |
| `items[].entityType` | `string` | 实体类型 |
| `items[].entityId` | `string` | 实体 ID |
| `items[].displayName` | `string` | 显示名称 |
| `items[].subtitle` | `string?` | 可选的辅助文本 |
| `items[].timestamp` | `string?` | 最后修改时间 |
| `items[].hasChildren` | `boolean` | 是否有子实体可以钻入 |
| `total` | `number` | 匹配的总条目数 |
| `page` | `number` | 当前页码 |

---

## GET /context/search

使用文本查询跨实体类型搜索。

**查询参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `q` | `string` | 是 | 搜索查询 |
| `entity_type` | `string` | 否 | 过滤到特定实体类型 |
| `limit` | `string` | 否 | 最大结果数（默认：`20`） |

**响应**：

```json
{
  "results": [
    {
      "entityType": "lesson_plan",
      "entityId": "lp_1",
      "displayName": "SSS/SAS 新授课教案",
      "subtitle": "八年级 · 数学",
      "icon": "📝",
      "breadcrumb": null
    },
    {
      "entityType": "attachment",
      "entityId": "att_2",
      "displayName": "SAS判定条件图.png",
      "subtitle": null,
      "icon": "📎",
      "breadcrumb": [
        { "type": "lesson_plan", "id": "lp_1", "displayName": "SSS/SAS 新授课教案", "icon": "📝" },
        { "type": "block", "id": "blk_2", "displayName": "SAS 概念讲解", "icon": "📦" }
      ]
    }
  ]
}
```

**响应字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `results` | `SearchResult[]` | 跨实体类型的搜索结果 |
| `results[].entityType` | `string` | 实体类型 |
| `results[].entityId` | `string` | 实体 ID |
| `results[].displayName` | `string` | 显示名称 |
| `results[].subtitle` | `string?` | 可选的辅助文本 |
| `results[].icon` | `string` | Emoji 图标 |
| `results[].breadcrumb` | `BreadcrumbItem[] \| null` | 嵌套实体的父路径 |

---

## GET /context/resolve

解析完整实体数据用于上下文注入。在用户选中实体或 agent 需要实体详情时调用。

**查询参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `entity_type` | `string` | 是 | 实体类型 |
| `entity_id` | `string` | 是 | 实体 ID |

**响应**：

```json
{
  "entityType": "lesson_plan",
  "entityId": "lp_1",
  "displayName": "SSS/SAS 新授课教案",
  "data": {
    "title": "12.2 SSS/SAS 新授课教案",
    "subject": "数学",
    "grade": "八年级",
    "blocks": [ "..." ]
  },
  "dataHash": "sha256:abc123...",
  "resolvedAt": "2025-03-14T10:00:00.000Z",
  "breadcrumb": null
}
```

**响应字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `entityType` | `string` | 实体类型 |
| `entityId` | `string` | 实体 ID |
| `displayName` | `string` | 显示名称 |
| `data` | `Record<string, unknown>` | 完整实体数据（字段由 `contextFields` 决定） |
| `dataHash` | `string` | 内容哈希用于缓存失效 |
| `resolvedAt` | `string` | ISO 8601 解析时间戳 |
| `breadcrumb` | `BreadcrumbItem[] \| null` | 嵌套实体的父路径 |

---

## POST /context/activity

记录用户活动事件用于推荐引擎。

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `entityType` | `string` | 是 | 实体类型 |
| `entityId` | `string` | 是 | 实体 ID |
| `entityDisplayName` | `string` | 是 | 用于缓存存储的显示名称 |
| `sessionId` | `string` | 是 | 当前 session ID |
| `action` | `string` | 是 | 活动动作：`referenced`、`viewed`、`created`、`updated` 或 `deleted` |

**响应**：

```json
{ "ok": true }
```

---

## GET /context/shortcuts

获取用户在 @ picker 工具栏的实体类型快捷偏好。

**查询参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `session_template` | `string` | 否 | Session 模板 ID，用于模板特定的快捷方式 |

**响应**：

```json
{
  "pinned": ["lesson_plan", "requirement", "question"],
  "hidden": ["submission"]
}
```

**响应字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `pinned` | `string[]` | 固定到工具栏的实体类型 |
| `hidden` | `string[]` | 从工具栏隐藏的实体类型 |

---

## PUT /context/shortcuts

更新用户的快捷偏好。

**请求体**：

```json
{
  "pinned": ["lesson_plan", "requirement"],
  "hidden": ["submission", "analytics"]
}
```

**响应**：

```json
{ "ok": true }
```
