# Context Layer — @ Reference System

The Context Layer lets chat users mention business entities inline using `@` references. It provides entity discovery (recents, search, drill-down), context injection for AI, and activity-based recommendations.

## Architecture

Three layers, each independently usable:

| Layer | Package | Purpose |
|-------|---------|---------|
| **core** | `@kedge-agentic/context-layer` | Pure TypeScript — EntityRegistry, RecommendEngine, ActivityEmitter |
| **nestjs** | `@kedge-agentic/context-layer` (nestjs subpath) | Thin NestJS shell — module, decorators, controller, interceptor |
| **react** | `@kedge-agentic/context-layer-react` | `<AtPicker />` component + `ContextLayerClient` SDK |

The module runs **inside your Solution process** as an npm package — it does not depend on the CCaaS core backend.

## Quick Start

### 1. Install

```bash
npm install @kedge-agentic/context-layer
```

### 2. Import the Module

```typescript
// app.module.ts
import { ContextLayerModule } from '@kedge-agentic/context-layer/nestjs';

@Module({
  imports: [
    ContextLayerModule.forRoot({
      cacheStore: myRedisAdapter,    // implements CacheStore
      ormAdapter: myTypeOrmAdapter,  // implements OrmAdapter
      browseProvider: myBrowseImpl,  // implements EntityBrowseProvider
    }),
  ],
})
export class AppModule {}
```

### 3. Mark Entities as Referenceable

```typescript
import { Referenceable } from '@kedge-agentic/context-layer/nestjs';

@Referenceable({
  type: 'lesson_plan',
  displayName: 'Lesson Plan',
  icon: '📝',
  color: 'purple',
  abilities: { search: true, browse: true, resolve: true, track: true },
  contextFields: ['title', 'subject', 'grade', 'blocks'],
})
@Controller('lesson-plans')
export class LessonPlanController { /* ... */ }
```

### 4. Frontend: Use AtPicker

```tsx
import { AtPicker } from '@kedge-agentic/context-layer-react';

<AtPicker
  baseUrl="http://localhost:3001/api/v1/context"
  sessionId={currentSessionId}
  open={showPicker}
  onClose={() => setShowPicker(false)}
  onSelect={(ref) => addRefPill(ref)}
/>
```

## Decorator Reference

### @Referenceable(options)

Marks a NestJS controller as a referenceable entity type. Applied at the class level.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `string` | Yes | Unique entity type identifier (e.g. `'lesson_plan'`) |
| `displayName` | `string` | Yes | Human-readable name shown in the picker |
| `icon` | `string` | Yes | Emoji icon for the entity type |
| `color` | `string` | No | Theme color for pills and badges |
| `abilities` | `object` | No | Capabilities: `search`, `browse`, `resolve`, `track` |
| `contextFields` | `string[]` | No | Fields to include when resolving entity context |
| `hideRelations` | `string[]` | No | Relation types to hide from the navigation tree |
| `relationLabels` | `Record<string, string>` | No | Custom labels for inferred relations |
| `recommender` | `object` | No | Custom weights or augment function for recommendations |

**abilities** can be `boolean` or an options object:

```typescript
abilities: {
  search: { queryParam: 'q', endpoint: '/search' },
  browse: { defaultSort: 'updatedAt', filterFields: ['grade'] },
  resolve: { folderPathField: 'path' },
  track: true,
}
```

### @Tracked(action, opts?)

Marks a service method for explicit activity tracking.

```typescript
@Tracked('graded', { entityType: 'homework' })
async gradeSubmission(homeworkId: string) { /* ... */ }
```

| Param | Type | Description |
|-------|------|-------------|
| `action` | `string` | Activity action name (core or custom) |
| `opts.entityType` | `string` | Entity type (required for service methods; auto-inferred on controllers) |

## Entity Registry & Relations

On module initialization, the `RelationInferrer` scans your ORM metadata and builds a relation tree:

- Only `@ManyToOne` relations where **both** sides are `@Referenceable` are kept
- Root entity types are those that never appear as a child in any relation
- Custom labels via `relationLabels`, hidden relations via `hideRelations`

```
[ContextLayer] Inferred relationships:
  lesson_plan <1:N> block       (via block.lesson_plan_id)
  block <1:N> attachment        (via attachment.block_id)
  homework <1:N> submission     (via submission.homework_id)

[ContextLayer] Navigation tree:
  roots: [lesson_plan, homework, requirement]
```

## Recommend Engine

The recommend engine uses Redis sorted sets to maintain per-user, per-session entity scores.

### Activity Actions

Five core actions with built-in score deltas:

| Action | Delta | Description |
|--------|-------|-------------|
| `referenced` | +10 | User explicitly @ referenced the entity |
| `created` | +8 | Entity was created |
| `updated` | +5 | Entity was modified |
| `viewed` | +2 | Entity was viewed/opened |
| `deleted` | -5 | Entity was deleted |

### Extensible Custom Actions

Solutions can define custom actions beyond the 5 core ones:

```typescript
// Type-safe: CoreActivityAction | (string & {})
type ActivityAction = 'referenced' | 'viewed' | 'created' | 'updated' | 'deleted' | (string & {});
```

Custom action deltas are passed to the `RecommendEngine` constructor. When wiring manually or extending `ContextLayerModule`, provide them as the third argument:

```typescript
const recommend = new RecommendEngine(cacheStore, registry, {
  graded: 7,      // Student work was graded
  submitted: 6,   // Assignment was submitted
  shared: 4,      // Entity was shared with colleagues
});
```

### Three-Level Customization

1. **Adjust weights** — Override `DEFAULT_RECOMMEND_WEIGHTS` per entity type via `recommender.weights`
2. **Augment** — Post-process recommendations via `recommender.augment` callback
3. **Override** — Replace the entire recommend engine by providing a custom `RecommendEngine`

## Tool-Based Architecture

{% hint style="info" %}
**Key Design Decision**: The agent fetches entity data on-demand via MCP tools, rather than pre-injecting all referenced entities into the prompt.
{% endhint %}

When a user sends a message with @ references, only **lightweight references** are included in the payload:

```json
{
  "references": [
    { "entityType": "lesson_plan", "entityId": "lp_1", "displayName": "SSS/SAS Lesson Plan" },
    { "entityType": "attachment", "entityId": "att_2", "displayName": "SAS-diagram.png" }
  ]
}
```

The agent decides which entities to fully resolve using 3 MCP tools:

| Tool | Purpose |
|------|---------|
| `resolve_entity` | Fetch full entity data by type + ID |
| `browse_children` | List child entities of a parent |
| `search_entities` | Search across entity types |

## Frontend Integration

### AtPicker Component

The `<AtPicker />` component provides:

- **Recents view** — Activity-scored recent entities
- **Search** — Debounced cross-type search (200ms)
- **Drill-down** — Navigate parent → child via the relation tree
- **Breadcrumb** — Shows entity path for nested items
- **Keyboard navigation** — Arrow keys, Enter to select, Escape to close, ArrowRight to drill

### Inline Ref Pills

Selected entities appear as **inline pills inside the composer input** (flex-wrap layout), consistent with Slack/Discord UX patterns. Each pill shows the entity icon and display name with a remove button.

### ContextLayerClient

Framework-agnostic TypeScript SDK for calling the Context Layer API:

```typescript
import { ContextLayerClient } from '@kedge-agentic/context-layer/client';

const client = new ContextLayerClient(
  'http://localhost:3001/api/v1/context',
  () => getAccessToken(),  // optional: adds Bearer token to requests
);

const types = await client.getEntityTypes();
const { recents } = await client.suggest(sessionId);
const items = await client.browse('lesson_plan');
const results = await client.search('SAS');
const data = await client.resolve('lesson_plan', 'lp_1');
```

## Configuration

### Session Template Shortcuts

Session templates can configure which entity types appear as toolbar shortcuts and which are auto-injected:

```typescript
const sessionTemplate = {
  name: 'Lesson Prep Assistant',
  shortcuts: ['lesson_plan', 'requirement', 'question'],
  autoInject: [
    { entityType: 'lesson_plan', strategy: 'from_trigger' },
  ],
};
```

### Custom Action Weights

Override the default recommend weights per entity type:

```typescript
@Referenceable({
  type: 'lesson_plan',
  // ...
  recommender: {
    weights: {
      session_affinity: 0.5,
      recency: 0.25,
      frequency: 0.1,
      cooccurrence: 0.15,
    },
  },
})
```

For complete API endpoint documentation, see the [Context Layer API Reference](../api/context-layer.md).
