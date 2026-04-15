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

## GET /context/entity/:type/:id

获取实体的完整上下文信息，包括结构化数据、关系和附件。用于 Agent 需要深入了解实体详情时。

**路径参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | `string` | 是 | 实体类型（如 `lesson_plan`） |
| `id` | `string` | 是 | 实体 ID |

**响应**：

```json
{
  "ref": {
    "type": "lesson_plan",
    "id": "lp_1",
    "display_name": "SSS/SAS 新授课教案",
    "summary": "八年级数学几何课教案"
  },
  "structured": {
    "title": "12.2 SSS/SAS 新授课教案",
    "subject": "数学",
    "grade": "八年级"
  },
  "relations": [
    {
      "type": "block",
      "id": "blk_1",
      "display_name": "SSS 概念讲解",
      "summary": "三角形全等判定"
    }
  ],
  "attachments": [
    {
      "name": "SAS判定条件图.png",
      "path": "/uploads/att_2.png",
      "mime_type": "image/png",
      "size_bytes": 204800
    }
  ]
}
```

**响应字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `ref` | `AtReference` | 实体引用信息 |
| `ref.type` | `string` | 实体类型 |
| `ref.id` | `string` | 实体 ID |
| `ref.display_name` | `string` | 显示名称 |
| `ref.summary` | `string` | 摘要文本 |
| `structured` | `Record<string, any>` | 结构化数据（字段由 Provider 决定） |
| `relations` | `AtReference[]` | 关联实体列表 |
| `attachments` | `EntityAttachment[]` | 附件列表 |
| `attachments[].name` | `string` | 文件名 |
| `attachments[].path` | `string` | 文件路径 |
| `attachments[].mime_type` | `string` | MIME 类型 |
| `attachments[].size_bytes` | `number` | 文件大小（字节） |

**错误响应**：

| 状态码 | 说明 |
|--------|------|
| `404` | 未注册该实体类型的 `EntityContextProvider` |
| `500` | Provider 内部错误 |

---

## GET /context/entity/:type/:id/document

获取实体的 Markdown 文档表示。由 `DocumentEditProvider.serialize()` 生成，包含 frontmatter 元数据和 block 内容。

**路径参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | `string` | 是 | 实体类型 |
| `id` | `string` | 是 | 实体 ID |

**响应**：

```json
{
  "document": "---\ntitle: 鱼香肉丝\ncuisine: 川菜\ndifficulty: medium\n---\n\n# 食材准备\n\n<!-- type:ingredient 猪里脊 | 300g | 切丝 ; 木耳 | 50g | 泡发 -->\n\n## 烹饪步骤\n\n1. 将猪里脊切丝，加入料酒腌制\n2. 热锅冷油，爆炒肉丝\n"
}
```

**响应字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `document` | `string` | Markdown 格式的实体文档 |

{% hint style="info" %}
文档格式由 `@kedge-agentic/entity-document` 的 `serialize()` 函数生成。包含 YAML frontmatter（元数据字段）和 Markdown 正文（各类型 block 的序列化结果）。
{% endhint %}

**错误响应**：

| 状态码 | 说明 |
|--------|------|
| `404` | 未注册该实体类型的 `EntityContextProvider`，或 Provider 未实现 `serialize` |
| `500` | 序列化过程中出错 |

---

## POST /context/entity/:type/:id/edit

对实体执行编辑操作。支持 4 种操作类型，可在单次请求中批量执行。

**路径参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | `string` | 是 | 实体类型 |
| `id` | `string` | 是 | 实体 ID |

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `operations` | `EditOperation[]` | 是 | 编辑操作列表（最多 50 个） |
| `description` | `string` | 否 | 本次编辑的描述 |

### 操作类型

#### str_replace — 文本替换

在序列化文档中精确匹配并替换文本。适用于修改 block 内容。

```json
{
  "op": "str_replace",
  "old_string": "猪里脊 | 300g",
  "new_string": "猪里脊 | 500g"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `op` | `"str_replace"` | 操作类型 |
| `old_string` | `string` | 要替换的原文本（必须精确匹配） |
| `new_string` | `string` | 替换后的新文本 |

#### field_set — 元数据字段设置

修改实体的元数据字段（仅限 `getEditableFields()` 返回的字段）。

```json
{
  "op": "field_set",
  "field": "title",
  "value": "新标题"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `op` | `"field_set"` | 操作类型 |
| `field` | `string` | 字段名（必须在可编辑字段集合中） |
| `value` | `string \| number \| boolean` | 新值（必须为原始类型） |

#### block_attr_set — Block 属性设置

修改指定 block 的属性（如 callout 的 color）。

```json
{
  "op": "block_attr_set",
  "block_index": 5,
  "attributes": { "color": "warning" }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `op` | `"block_attr_set"` | 操作类型 |
| `block_index` | `number` | Block 在文档中的索引（0-based） |
| `attributes` | `Record<string, any>` | 要设置的属性键值对 |

#### block_content_set — Block 内容字段设置

修改指定 block 的 content 中的某个字段。

```json
{
  "op": "block_content_set",
  "block_index": 3,
  "field": "items",
  "value": [{ "name": "鸡蛋", "amount": "3个" }]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `op` | `"block_content_set"` | 操作类型 |
| `block_index` | `number` | Block 在文档中的索引（0-based） |
| `field` | `string` | content 中的字段名 |
| `value` | `any` | 新值 |

### 响应

```json
{
  "success": true,
  "document": "---\ntitle: 新标题\n---\n\n# 食材准备\n\n<!-- type:ingredient 猪里脊 | 500g | 切丝 -->\n"
}
```

**响应字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `success` | `boolean` | 操作是否成功 |
| `error` | `string?` | 失败时的错误信息 |
| `document` | `string?` | 成功时返回更新后的 Markdown 文档 |

**常见错误**：

| error | 原因 |
|-------|------|
| `字段 "status" 不允许通过 field_set 修改` | 尝试修改不可编辑字段 |
| `field_set value 必须为原始类型` | value 传入了对象或数组 |
| `Old string not found in document` | str_replace 的 old_string 未在文档中找到 |
| `已发布的实体不允许编辑` | Provider 的 validateEdit 拒绝了操作 |

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
