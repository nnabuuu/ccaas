# @kedge-agentic/context-layer

> Let chat users `@` reference business entities inline. Provides entity discovery, context injection for AI, and activity-based recommendations.

## Package Structure

```
context-layer/
├── src/
│   ├── core/              # Pure TypeScript — no framework dependencies
│   │   ├── interfaces.ts       # All type definitions
│   │   ├── entity-registry.ts  # Entity metadata + relation tree storage
│   │   ├── relation-inferrer.ts # ORM metadata → relation tree
│   │   ├── recommend-engine.ts  # Redis sorted set scoring
│   │   ├── activity-emitter.ts  # Activity event dispatch
│   │   ├── context-injector.ts  # Entity browse/search/resolve orchestration
│   │   ├── document-edit-provider.ts  # Abstract base for entity editing
│   │   └── shortcut-manager.ts  # User shortcut preferences
│   ├── nestjs/            # Thin NestJS integration shell
│   │   ├── context-layer.module.ts      # DynamicModule with forRoot()
│   │   ├── context-layer.controller.ts  # 7 REST endpoints
│   │   ├── context-layer.decorator.ts   # @Referenceable + @Tracked
│   │   └── context-layer.interceptor.ts # Auto activity tracking
│   └── client/            # Framework-agnostic TypeScript SDK
│       ├── context-layer-client.ts      # HTTP client for all endpoints
│       ├── types.ts                     # Re-exported response types
│       └── index.ts                     # Barrel exports
```

## Install

```bash
npm install @kedge-agentic/context-layer
```

## Quick Start

```typescript
// 1. Import the NestJS module
import { ContextLayerModule } from '@kedge-agentic/context-layer/nestjs';

@Module({
  imports: [
    ContextLayerModule.forRoot({
      cacheStore: myRedisAdapter,
      ormAdapter: myTypeOrmAdapter,
      browseProvider: myBrowseImpl,
    }),
  ],
})
export class AppModule {}

// 2. Mark entities
import { Referenceable } from '@kedge-agentic/context-layer/nestjs';

@Referenceable({
  type: 'lesson_plan',
  displayName: 'Lesson Plan',
  icon: '📝',
  abilities: { search: true, browse: true, resolve: true, track: true },
})
@Controller('lesson-plans')
export class LessonPlanController {}
```

## Core Concepts

| Concept | Description |
|---------|-------------|
| **Entity Registry** | Stores metadata for all `@Referenceable` entities and their relation tree |
| **Relations** | Auto-inferred from ORM `@ManyToOne` — only kept when both sides are `@Referenceable` |
| **Activity Tracking** | Interceptor auto-tracks CRUD on `@Referenceable` controllers; `@Tracked` for explicit tracking |
| **Recommend Engine** | Redis sorted sets with incremental scoring (5 core actions + custom `ActivityActionConfig`) |
| **Context Injector** | Orchestrates browse, search, resolve via `EntityBrowseProvider` interface |
| **Document Edit** | Abstract base class for serialize/str_replace/save loop on entity-document backed entities |

## API Summary

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/context/entity-types` | GET | All registered types + relation tree |
| `/context/suggest` | GET | Activity-scored recents (< 50ms) |
| `/context/browse` | GET | Browse by type with drill-down |
| `/context/search` | GET | Cross-type text search |
| `/context/resolve` | GET | Full entity data for context injection |
| `/context/activity` | POST | Record activity event |
| `/context/shortcuts` | GET/PUT | User shortcut preferences |

## Documentation

- [Solution Builder Guide](../../docs/gitbook/en/guide/context-layer.md) — Integration tutorial
- [API Reference](../../docs/gitbook/en/api/context-layer.md) — Endpoint details with request/response schemas
- [React Component](../context-layer-react/README.md) — `<AtPicker />` frontend integration
