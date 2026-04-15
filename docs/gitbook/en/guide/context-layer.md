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

## Document Edit Provider

The `DocumentEditProvider` abstract base class simplifies building `EntityContextProvider.serialize()` and `edit()` for entities backed by `@kedge-agentic/entity-document` blocks.

### What It Does

Instead of manually implementing the serialize → str_replace → save loop for each entity type, extend `DocumentEditProvider` and implement 5 abstract methods. The base class handles:

1. **serialize** — loads entity, converts to `EntityDocument`, serializes to Markdown
2. **edit** — applies edit operations, merges blocks back for storage, saves

### 4 Edit Operations

Called via `POST /context/entity/:type/:id/edit`, supports 4 operations:

| Operation | Purpose | Handled By |
|-----------|---------|------------|
| `str_replace` | Exact-match text replacement in the Markdown document | Base class `DocumentEditProvider` |
| `field_set` | Modify metadata fields (frontmatter) | Base class `DocumentEditProvider` |
| `block_attr_set` | Modify a block's attributes (e.g. callout color) | Requires subclass implementation |
| `block_content_set` | Modify a field within a block's content | Requires subclass implementation |

{% hint style="warning" %}
`str_replace` and `field_set` are automatically handled by the base `DocumentEditProvider.edit()`. `block_attr_set` and `block_content_set` require the subclass to override `edit()` — the base class does not provide default handling for these.
{% endhint %}

### Edit Flow

```
Agent calls POST /context/entity/:type/:id/edit
  ↓
Controller parses EditOperationDto[]
  ↓
ContextRouter.editEntity() → Provider.edit()
  ↓
DocumentEditProvider.edit():
  1. loadEntity() to load the entity
  2. validateEdit() to check if editing is allowed
  3. Process operations:
     - field_set → check editableFields, collect metaUpdates
     - str_replace → call strReplace() to update document
  4. mergeBlockForStorage() to merge attributes back into blocks
  5. saveEntity() to persist
  6. Return { success: true, document: updated Markdown }
```

### Abstract Methods

| Method | Returns | Purpose |
|--------|---------|---------|
| `loadEntity(id, userId)` | `Promise<any>` | Load the entity from your data store |
| `saveEntity(id, updates, userId)` | `Promise<void>` | Persist partial updates back to your data store |
| `toEntityDocument(entity)` | `EntityDocument` | Convert loaded entity to an `EntityDocument` (meta + blocks) |
| `getEditableFields()` | `Set<string>` | Which meta fields can be modified via `field_set` |
| `getContentToAttrConfig()` | `ContentToAttrConfig` | Attribute extraction config for `splitBlock`/`mergeBlock` |

### Optional Hook

- `validateEdit(entity, ops)` — Return an `EditResult` to reject the edit before any operations run. Return `null` to allow. Commonly used for status checks (e.g. rejecting edits on published entities).

### ContentToAttrConfig

Controls attribute migration between block serialization and storage. Some attributes are stored in `content` but represented as `attributes` in the document:

```typescript
// callout's color is stored in content, extracted to attributes during serialization
// ingredient's category works the same way
const config: ContentToAttrConfig = {
  callout: ['color'],
  ingredient: ['category'],
};
```

- `splitBlockForDocument(block, config)` — extracts specified fields from content to attributes (before serialization)
- `mergeBlockForStorage(block, config)` — merges fields from attributes back into content (before saving)

### Usage Example

```typescript
import { DocumentEditProvider } from '@kedge-agentic/context-layer';
import type { EntityDocument, ContentToAttrConfig } from '@kedge-agentic/entity-document';

export class LessonPlanEditProvider extends DocumentEditProvider {
  constructor(private repo: LessonPlanRepository) { super(); }

  async loadEntity(id: string, _userId: string) {
    return this.repo.findOneOrFail(id);
  }

  async saveEntity(id: string, updates: any, _userId: string) {
    await this.repo.update(id, updates);
  }

  toEntityDocument(entity: LessonPlan): EntityDocument {
    return {
      meta: { title: entity.title, subject: entity.subject },
      blocks: entity.blocks.map(b => splitBlockForDocument(b, this.getContentToAttrConfig())),
    };
  }

  getEditableFields() {
    return new Set(['title', 'subject', 'duration']);
  }

  getContentToAttrConfig(): ContentToAttrConfig {
    return { callout: ['color'] };
  }

  // Optional: reject edits on published entities
  validateEdit(entity: LessonPlan, ops: EditOperation[]): EditResult | null {
    if (entity.status === 'published') {
      return { success: false, error: 'Published lesson plans cannot be edited' };
    }
    return null;
  }
}
```

The provider is then wired into your `EntityContextProvider` — the `serialize` and `edit` methods are ready to use as-is.

### Custom TransformRegistry

If your entity uses custom block types (e.g. `ingredient`), you need to create a custom `TransformRegistry` and use it in both `serialize()` and `edit()`:

```typescript
import { TransformRegistry } from '@kedge-agentic/entity-document';

const recipeRegistry = TransformRegistry.withDefaults();
recipeRegistry.register('ingredient', ingredientTransform);

export class RecipeProvider extends DocumentEditProvider {
  // override serialize to use custom registry
  async serialize(id: string, userId: string): Promise<string> {
    const entity = await this.loadEntity(id, userId);
    const doc = this.toEntityDocument(entity);
    return serialize(doc, recipeRegistry);
  }

  // override edit to ensure str_replace uses the same registry
  async edit(id: string, ops: EditOperation[], userId: string): Promise<EditResult> {
    // ... call strReplace(doc, old, new, recipeRegistry)
  }
}
```

{% hint style="warning" %}
**Important**: If you use a custom registry, you must override both `serialize()` and `edit()`. The base class `strReplace()` defaults to `defaultRegistry`, and custom block types will lose attributes during round-trip.
{% endhint %}

## Frontend Integration

### AtPicker Component

The `<AtPicker />` component provides:

- **Context entity** — When `contextEntity` is provided, a pinned "当前上下文" section appears at the top of the home view with drill-down support
- **Recents view** — Activity-scored recent entities (requires `sessionId`)
- **Search** — Debounced cross-type search (200ms)
- **Drill-down** — Navigate parent → child via the relation tree
- **Breadcrumb** — Shows entity path for nested items
- **Keyboard navigation** — Arrow keys, Enter to select, Escape to close, ArrowRight to drill

#### Entity Context Awareness

`contextEntity` (what entity you're viewing) and `sessionId` (activity history) are **separate composable concepts**:

| Scenario | contextEntity | sessionId | Picker behavior |
|----------|--------------|-----------|-----------------|
| Split view, first message | recipe | undefined | Pin recipe at top, no recents |
| Split view, ongoing | recipe | session123 | Pin recipe + recents |
| Standalone /chat | undefined | session123 | Recents + type browse |
| Standalone /chat, first msg | undefined | undefined | Only type browse |

The `MentionPicker` wrapper in `@kedge-agentic/chat-interface` adds two additional props:
- `contextEntity` — passed through to AtPicker for the pinned section
- `autoRef` — when `true`, auto-resolves the entity and adds it as a reference pill so the agent receives entity content on every message

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
