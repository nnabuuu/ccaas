# Context Layer @ Reference Picker

A harness-driven implementation of the full-stack Context Layer module — from design document to working `@` reference picker with backend entity registry, recommendation engine, and React frontend components.

## Problem

The Context Layer design document (v9) described a complete `@` reference system for chat interfaces — entity registration, activity tracking, smart recommendations, and a multi-mode picker UI — but zero code existed. The challenge was to implement a complex cross-package module with strict architectural constraints.

## Approach

We used the [Harness Engineering](../guide/harness-engineering.md) pattern to iteratively build the module from scratch, with Playwright E2E tests as the primary quality signal.

### Architecture

The Context Layer spans 4 packages with strict import boundaries:

```
packages/
  context-layer/                    # @kedge-agentic/context-layer
    src/
      core/                         # Pure TypeScript — zero NestJS dependency
        entity-registry.ts
        relation-inferrer.ts
        recommend-engine.ts
        context-injector.ts
      client/                       # ContextLayerClient SDK
      nestjs/                       # NestJS thin wrapper
  context-layer-react/              # @kedge-agentic/context-layer-react
    src/
      AtPicker.tsx                  # @ picker component
      components/                   # RecentsSection, DrillDownView, SearchResults, etc.
      hooks/                        # useContextLayer, useSuggest, useBrowse, useSearch
```

### Evaluation Dimensions

| # | Dimension | Weight | Focus |
|---|-----------|--------|-------|
| D1 | Scenario Pass Rate | 35/100 | 13 Playwright E2E tests |
| D2 | Architecture Compliance | 30/100 | Import boundaries, package separation, decorator pattern |
| D3 | TypeScript Correctness | 15/100 | `tsc --noEmit` zero errors, interface alignment with design doc |
| D4 | Performance SLA | 8/100 | Suggest < 50ms, search debounce, drill-down < 200ms |
| D5 | Frontend Interaction Quality | 8/100 | Picker popup, breadcrumb nav, reference pill display |
| D6 | Code Conventions | 4/100 | CCAAS patterns, no redundancy, ESLint clean |

### Frozen Constraints

- `core/` must not import `@nestjs/*` (pure TypeScript, zero framework dependency)
- `ChatInterfaceComposer.tsx` existing code cannot be modified (picker via overlay + context)
- Mock solution must not import from `solutions/business/edu-platform/`
- API response schemas must strictly align with design document Section 7.1
- `@Referenceable` and `@Tracked` decorators: metadata only, zero runtime logic

## Results

| Version | Score | Focus |
|---------|-------|-------|
| v1 | 56/100 | Initial implementation: core modules + NestJS wrapper + basic React components |
| v2 | 59/100 | Architecture fixes: import boundary violations, interface alignment |
| v3 | 67/100 | Frontend polish: picker interactions, breadcrumb navigation |
| v4 | 69/100 | TypeScript fixes, mock solution improvements |
| v5 | 69/100 | Plateau — E2E tests needed running services to progress further |

The harness reached a plateau at 69/100. The primary blocker was D1 (Scenario Pass Rate, 35 pts) — the 13 Playwright E2E tests required running backend services, which the harness agent couldn't fully automate in the evaluation loop.

## Key Deliverables

### Backend (`@kedge-agentic/context-layer`)

- **EntityRegistry**: Register entity types with `@Referenceable` decorator
- **RecommendEngine**: Smart suggestions based on recency, frequency, and relevance
- **ContextInjector**: Automatically inject referenced entities into agent context
- **REST API**: 8 endpoints (suggest, search, browse, drill-down, entity types, etc.)

### Frontend (`@kedge-agentic/context-layer-react`)

- **AtPicker**: Multi-mode picker triggered by `@` in chat input
- **RecentsSection**: Recently referenced entities
- **TypeBrowseSection**: Browse by entity type
- **DrillDownView**: Navigate entity hierarchies with breadcrumb
- **SearchResults**: Real-time search with debounce
- **RefPill**: Inline reference display in chat messages

### Chat Interface Integration

- Overlay-based `@` picker that works with existing `ChatInterfaceComposer`
- `useChatCore()` context integration for reference injection
- No modification to existing chat core code

## Lessons Learned

1. **E2E tests as primary metric**: Weighting E2E at 35% created strong incentive for working end-to-end functionality, but required running services that were hard to automate.
2. **Architecture compliance weight matters**: 30% weight on import boundaries ensured clean separation from the start, preventing the common pattern of "get it working then refactor."
3. **Cross-package tasks are harder**: Unlike single-directory redesigns, this harness needed to coordinate changes across 4 packages — the generator had to manage more complex dependencies.
4. **Plateau signals design issues**: When scores stop improving, it often points to a structural problem in the harness setup (in this case, the E2E test infrastructure).

## Related Documentation

- [Context Layer Guide](../guide/context-layer.md) — Full developer guide for using the Context Layer
- [Context Layer API](../api/context-layer.md) — REST API reference
- [Interactive Prompting](../guide/interactive-prompting.md) — Context injection patterns

## Workspace

Full harness workspace: `harness-workspace/reference-picker-core-module/`
