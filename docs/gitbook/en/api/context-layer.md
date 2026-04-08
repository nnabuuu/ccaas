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
