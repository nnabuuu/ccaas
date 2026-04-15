# Context Layer API

REST API endpoints for the Context Layer module. All endpoints are under the `/context` path and are served by the Solution backend (not the CCaaS core).

**Base path**: `/api/v1/context` (or as configured in your Solution)

For integration guide and concepts, see the [Context Layer Guide](../guide/context-layer.md).

---

## GET /context/entity-types

Returns all registered entity types and the relation tree.

**Response**:

```json
{
  "types": [
    {
      "type": "lesson_plan",
      "displayName": "Lesson Plan",
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
        "label": "Content Blocks",
        "foreignKey": "lesson_plan_id"
      }
    ]
  }
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `types` | `EntityTypeInfo[]` | All registered entity types |
| `types[].type` | `string` | Unique entity type identifier |
| `types[].displayName` | `string` | Human-readable name |
| `types[].icon` | `string` | Emoji icon |
| `types[].color` | `string \| null` | Theme color |
| `types[].searchable` | `boolean` | Whether this type supports search |
| `types[].browsable` | `boolean` | Whether this type supports browse |
| `tree` | `RelationTree` | Entity relationship tree |
| `tree.roots` | `string[]` | Top-level entity types (not children of any relation) |
| `tree.relations` | `RelationInfo[]` | Parent-child relations inferred from ORM |

---

## GET /context/suggest

Returns activity-scored recent entities for the @ picker's initial view.

**SLA**: < 50ms (served from Redis cache)

**Query Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `session_id` | `string` | No | Filter recents by session |
| `limit` | `string` | No | Max results (default: `10`) |

**Response**:

```json
{
  "recents": [
    {
      "entityType": "lesson_plan",
      "entityId": "lp_1",
      "displayName": "SSS/SAS Lesson Plan",
      "icon": "📝",
      "color": "purple",
      "score": 0.95,
      "breadcrumb": null
    },
    {
      "entityType": "attachment",
      "entityId": "att_2",
      "displayName": "SAS-diagram.png",
      "icon": "📎",
      "color": null,
      "score": 0.71,
      "breadcrumb": [
        { "type": "lesson_plan", "id": "lp_1", "displayName": "SSS/SAS Lesson Plan", "icon": "📝" },
        { "type": "block", "id": "blk_2", "displayName": "SAS Explanation", "icon": "📦" }
      ]
    }
  ],
  "cachedAt": "2025-03-14T10:00:00.000Z"
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `recents` | `Recommendation[]` | Scored entity recommendations |
| `recents[].entityType` | `string` | Entity type |
| `recents[].entityId` | `string` | Entity ID |
| `recents[].displayName` | `string` | Display name |
| `recents[].icon` | `string` | Emoji icon |
| `recents[].color` | `string \| null` | Theme color |
| `recents[].score` | `number` | Activity score (higher = more recent/frequent) |
| `recents[].breadcrumb` | `BreadcrumbItem[] \| null` | Parent path for nested entities |
| `cachedAt` | `string` | ISO 8601 timestamp of cache read |

---

## GET /context/browse

Browse entities by type, optionally scoped to a parent entity for drill-down navigation.

**Query Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `entity_type` | `string` | Yes | Entity type to browse |
| `parent_type` | `string` | No | Parent entity type (for drill-down) |
| `parent_id` | `string` | No | Parent entity ID (for drill-down) |
| `page` | `string` | No | Page number (default: `1`) |

**Response**:

```json
{
  "items": [
    {
      "entityType": "lesson_plan",
      "entityId": "lp_1",
      "displayName": "SSS/SAS Lesson Plan",
      "subtitle": "Grade 8 · Math · Geometry",
      "timestamp": "2025-03-14T10:00:00Z",
      "hasChildren": true
    }
  ],
  "total": 12,
  "page": 1
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `items` | `BrowseItem[]` | Browseable entities |
| `items[].entityType` | `string` | Entity type |
| `items[].entityId` | `string` | Entity ID |
| `items[].displayName` | `string` | Display name |
| `items[].subtitle` | `string?` | Optional secondary text |
| `items[].timestamp` | `string?` | Last modified timestamp |
| `items[].hasChildren` | `boolean` | Whether this item has child entities to drill into |
| `total` | `number` | Total matching items |
| `page` | `number` | Current page number |

---

## GET /context/search

Search across entity types with a text query.

**Query Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `q` | `string` | Yes | Search query |
| `entity_type` | `string` | No | Filter to a specific entity type |
| `limit` | `string` | No | Max results (default: `20`) |

**Response**:

```json
{
  "results": [
    {
      "entityType": "lesson_plan",
      "entityId": "lp_1",
      "displayName": "SSS/SAS Lesson Plan",
      "subtitle": "Grade 8 · Math",
      "icon": "📝",
      "breadcrumb": null
    },
    {
      "entityType": "attachment",
      "entityId": "att_2",
      "displayName": "SAS-diagram.png",
      "subtitle": null,
      "icon": "📎",
      "breadcrumb": [
        { "type": "lesson_plan", "id": "lp_1", "displayName": "SSS/SAS Lesson Plan", "icon": "📝" },
        { "type": "block", "id": "blk_2", "displayName": "SAS Explanation", "icon": "📦" }
      ]
    }
  ]
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `results` | `SearchResult[]` | Search results across entity types |
| `results[].entityType` | `string` | Entity type |
| `results[].entityId` | `string` | Entity ID |
| `results[].displayName` | `string` | Display name |
| `results[].subtitle` | `string?` | Optional secondary text |
| `results[].icon` | `string` | Emoji icon |
| `results[].breadcrumb` | `BreadcrumbItem[] \| null` | Parent path for nested entities |

---

## GET /context/resolve

Resolve full entity data for context injection. Called when a user selects an entity or when the agent needs entity details.

**Query Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `entity_type` | `string` | Yes | Entity type |
| `entity_id` | `string` | Yes | Entity ID |

**Response**:

```json
{
  "entityType": "lesson_plan",
  "entityId": "lp_1",
  "displayName": "SSS/SAS Lesson Plan",
  "data": {
    "title": "12.2 SSS/SAS New Lesson Plan",
    "subject": "Math",
    "grade": "Grade 8",
    "blocks": [ "..." ]
  },
  "dataHash": "sha256:abc123...",
  "resolvedAt": "2025-03-14T10:00:00.000Z",
  "breadcrumb": null
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `entityType` | `string` | Entity type |
| `entityId` | `string` | Entity ID |
| `displayName` | `string` | Display name |
| `data` | `Record<string, unknown>` | Full entity data (fields determined by `contextFields`) |
| `dataHash` | `string` | Content hash for cache invalidation |
| `resolvedAt` | `string` | ISO 8601 resolve timestamp |
| `breadcrumb` | `BreadcrumbItem[] \| null` | Parent path for nested entities |

---

## POST /context/activity

Record a user activity event for the recommend engine.

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `entityType` | `string` | Yes | Entity type |
| `entityId` | `string` | Yes | Entity ID |
| `entityDisplayName` | `string` | Yes | Display name for cache storage |
| `sessionId` | `string` | Yes | Current session ID |
| `action` | `string` | Yes | Activity action: `referenced`, `viewed`, `created`, `updated`, or `deleted` |

**Response**:

```json
{ "ok": true }
```

---

## GET /context/entity/:type/:id

Retrieve full context for an entity, including structured data, relations, and attachments. Used when the agent needs detailed entity information.

**Path Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `string` | Yes | Entity type (e.g. `lesson_plan`) |
| `id` | `string` | Yes | Entity ID |

**Response**:

```json
{
  "ref": {
    "type": "lesson_plan",
    "id": "lp_1",
    "display_name": "SSS/SAS Lesson Plan",
    "summary": "Grade 8 Math Geometry lesson plan"
  },
  "structured": {
    "title": "12.2 SSS/SAS New Lesson Plan",
    "subject": "Math",
    "grade": "Grade 8"
  },
  "relations": [
    {
      "type": "block",
      "id": "blk_1",
      "display_name": "SSS Explanation",
      "summary": "Triangle congruence criteria"
    }
  ],
  "attachments": [
    {
      "name": "SAS-diagram.png",
      "path": "/uploads/att_2.png",
      "mime_type": "image/png",
      "size_bytes": 204800
    }
  ]
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `ref` | `AtReference` | Entity reference information |
| `ref.type` | `string` | Entity type |
| `ref.id` | `string` | Entity ID |
| `ref.display_name` | `string` | Display name |
| `ref.summary` | `string` | Summary text |
| `structured` | `Record<string, any>` | Structured data (fields determined by Provider) |
| `relations` | `AtReference[]` | Related entities |
| `attachments` | `EntityAttachment[]` | Attached files |
| `attachments[].name` | `string` | File name |
| `attachments[].path` | `string` | File path |
| `attachments[].mime_type` | `string` | MIME type |
| `attachments[].size_bytes` | `number` | File size in bytes |

**Error Responses**:

| Status | Description |
|--------|-------------|
| `404` | No `EntityContextProvider` registered for this entity type |
| `500` | Internal provider error |

---

## GET /context/entity/:type/:id/document

Retrieve the Markdown document representation of an entity. Generated by `DocumentEditProvider.serialize()`, including YAML frontmatter metadata and block content.

**Path Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `string` | Yes | Entity type |
| `id` | `string` | Yes | Entity ID |

**Response**:

```json
{
  "document": "---\ntitle: Fish-Flavored Pork\ncuisine: Sichuan\ndifficulty: medium\n---\n\n# Ingredients\n\n<!-- type:ingredient Pork loin | 300g | sliced ; Wood ear | 50g | soaked -->\n\n## Cooking Steps\n\n1. Slice the pork loin and marinate with cooking wine\n2. Heat oil in wok, stir-fry the pork\n"
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `document` | `string` | Entity document in Markdown format |

{% hint style="info" %}
The document format is generated by `@kedge-agentic/entity-document`'s `serialize()` function. It contains a YAML frontmatter (metadata fields) and Markdown body (serialized block content of various types).
{% endhint %}

**Error Responses**:

| Status | Description |
|--------|-------------|
| `404` | No `EntityContextProvider` registered for this entity type, or provider does not implement `serialize` |
| `500` | Serialization error |

---

## POST /context/entity/:type/:id/edit

Execute edit operations on an entity. Supports 4 operation types, which can be batched in a single request.

**Path Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `string` | Yes | Entity type |
| `id` | `string` | Yes | Entity ID |

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `operations` | `EditOperation[]` | Yes | List of edit operations (max 50) |
| `description` | `string` | No | Description of the edit |

### Operation Types

#### str_replace — Text Replacement

Exact-match and replace text in the serialized document. Use for modifying block content.

```json
{
  "op": "str_replace",
  "old_string": "Pork loin | 300g",
  "new_string": "Pork loin | 500g"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `op` | `"str_replace"` | Operation type |
| `old_string` | `string` | Text to replace (must match exactly) |
| `new_string` | `string` | Replacement text |

#### field_set — Metadata Field Update

Modify an entity's metadata field (only fields returned by `getEditableFields()`).

```json
{
  "op": "field_set",
  "field": "title",
  "value": "New Title"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `op` | `"field_set"` | Operation type |
| `field` | `string` | Field name (must be in the editable fields set) |
| `value` | `string \| number \| boolean` | New value (must be a primitive type) |

#### block_attr_set — Block Attribute Update

Modify attributes of a specific block (e.g. callout color).

```json
{
  "op": "block_attr_set",
  "block_index": 5,
  "attributes": { "color": "warning" }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `op` | `"block_attr_set"` | Operation type |
| `block_index` | `number` | Block index in the document (0-based) |
| `attributes` | `Record<string, any>` | Attribute key-value pairs to set |

#### block_content_set — Block Content Field Update

Modify a specific field within a block's content.

```json
{
  "op": "block_content_set",
  "block_index": 3,
  "field": "items",
  "value": [{ "name": "Eggs", "amount": "3" }]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `op` | `"block_content_set"` | Operation type |
| `block_index` | `number` | Block index in the document (0-based) |
| `field` | `string` | Field name within the block's content |
| `value` | `any` | New value |

### Response

```json
{
  "success": true,
  "document": "---\ntitle: New Title\n---\n\n# Ingredients\n\n<!-- type:ingredient Pork loin | 500g | sliced -->\n"
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | Whether the operation succeeded |
| `error` | `string?` | Error message on failure |
| `document` | `string?` | Updated Markdown document on success |

**Common Errors**:

| error | Cause |
|-------|-------|
| `字段 "status" 不允许通过 field_set 修改` | Attempted to modify a non-editable field |
| `field_set value 必须为原始类型` | value is an object or array instead of a primitive |
| `Old string not found in document` | str_replace old_string not found in the document |
| `已发布的实体不允许编辑` | Provider's validateEdit rejected the operation |

---

## GET /context/shortcuts

Get the user's entity type shortcut preferences for the @ picker toolbar.

**Query Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `session_template` | `string` | No | Session template ID for template-specific shortcuts |

**Response**:

```json
{
  "pinned": ["lesson_plan", "requirement", "question"],
  "hidden": ["submission"]
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `pinned` | `string[]` | Entity types pinned to the toolbar |
| `hidden` | `string[]` | Entity types hidden from the toolbar |

---

## PUT /context/shortcuts

Update the user's shortcut preferences.

**Request Body**:

```json
{
  "pinned": ["lesson_plan", "requirement"],
  "hidden": ["submission", "analytics"]
}
```

**Response**:

```json
{ "ok": true }
```
