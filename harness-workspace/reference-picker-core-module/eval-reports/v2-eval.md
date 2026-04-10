# Evaluation Report: v2

## Pre-Gate Results
- tsc (context-layer): **PASS** — 0 errors
- tsc (context-layer-react): **PASS** — 0 errors
- tsc (mock solution): **PASS** — 0 errors
- P1 (core NestJS import): **PASS** — `grep -rn "from '@nestjs" packages/context-layer/src/core/` returned empty
- P2 (Composer modification): **PASS** — `git diff --name-only` returned empty
- P3 (mock edu-platform import): **PASS** — `grep -rn "from '.*edu-platform" solutions/mock/context-layer-demo/` returned empty
- P5 (decorator purity): **PASS** — `Referenceable` returns `SetMetadata(REFERENCEABLE_KEY, options)`, `Tracked` returns `SetMetadata(TRACKED_KEY, {...})`, zero runtime logic

## Per-Dimension Scores

### D1: 场景通过率 (Weight: 35/100)
**Score: 1/5**
**Scenarios**: 0/13 verified (services not running — static analysis only)

Static analysis assessment of each scenario's likely runtime behavior:
- S1 基本 @ 弹出: LIKELY PASS — recents seeded via MockCacheStore, tree.roots computed by EntityRegistry.computeRoots() yields [lesson_plan, homework, requirement]
- S2 按类型浏览: LIKELY PASS — MockBrowseProvider delegates to MockDataService.getBrowse() with 4 lesson plans
- S3 钻入子资源: LIKELY PASS — drill-down chain works via tree.relations, hasChildren guard correct for blk_3/blk_4 (false)
- S4 三级钻入: LIKELY PASS — block→attachment drill, breadcrumb trail renders correctly
- S5 选中 → pill: LIKELY PASS — handleSelect calls resolve + recordActivity + onSelect, pill rendered in index.html
- S6 多实体引用: LIKELY PASS — duplicate guard in setRefs, pills side-by-side
- S7 搜索: LIKELY PASS — MockDataService.getSearch filters by displayName.toLowerCase().includes(q), "SAS" matches multiple types
- S8 搜索面包屑: LIKELY PASS — MockDataService.buildBreadcrumb('attachment','att_2') returns [lesson_plan→block] chain; ContextInjector enriches with registry breadcrumbs
- S9 工具栏快捷入口: LIKELY PASS — shortcut click sets initialDrillType, picker opens in browse mode
- S10 session template shortcuts: LIKELY PASS — shortcuts seeded per template in MockSetupService
- S11 返回导航: LIKELY PASS — handleBack slices trail, re-fetches browse
- S12 recents 更新: LIKELY PASS — activity POST → ActivityEmitter → RecommendEngine.incrementScore → cache.zincrby; suggest reads from same cache
- S13 自动注入: LIKELY PASS — autoInject URL param triggers resolve + pill creation after entityTypes load

**Justification**: All 13 scenarios appear architecturally sound based on static code tracing. The data flow from API endpoints → core services → mock adapters → seed data is consistent. However, services were not running, so **no runtime verification was possible**. Per eval rules: max 1/5.
**Suggestion**: Start both services (`npm run dev` in mock solution + chat-interface) and run `npx playwright test` to validate. The most likely failure points are timing-sensitive tests (S6, S12, S13) that use `waitForTimeout`.

### D2: 架构合规性 (Weight: 30/100)
**Score: 4/5**

**Layer analysis:**
- **core/** (8 files): Zero framework imports. All services are pure TS classes accepting interfaces (CacheStore, OrmAdapter, EntityBrowseProvider). ✓
- **nestjs/** (6 files): Only imports from `../core/`. Controller, Interceptor, Module correctly wrap core services with NestJS decorators. ✓
- **client/** (3 files): Only type re-exports from `../core/interfaces.js`. ContextLayerClient uses native `fetch()`. ✓
- **context-layer-react/** (4 files + 1 component): Imports types from `@kedge-agentic/context-layer/client`. No direct core or nestjs imports. ✓
- **chat-interface/**: Only 2 new files (MentionPicker.tsx, MentionContext.tsx). No existing files modified. ✓
- **mock solution**: Uses `ContextLayerModule.forRoot()` with 3 adapters. No edu-platform imports. ✓

**Issues found:**
1. **Dead file** `solutions/mock/context-layer-demo/src/controllers/context-demo.controller.ts` — v2 changelog says "deleted" but file still exists (1931 bytes). Not imported by app.module.ts.
2. **MockDataService duplication** — `mock-data.service.ts` re-declares 6 interfaces (EntityTypeInfo, RelationInfo, BreadcrumbItem, BrowseItem, RecentItem, SearchResultItem) that already exist in `@kedge-agentic/context-layer`. MockBrowseProvider already imports from the package, so these could be shared.
3. **MockDataService dead methods** — `getSuggest()`, `getEntityTypes()`, `getShortcuts()`, `recordActivity()` are never called in v2 (ContextLayerModule handles all API routes). These are remnants of v1's standalone controller.
4. **Dual MockDataService instances** — `app.module.ts` creates one via `new MockDataService()` (for browseProvider) and a second via DI (for MockSetupService). Both have identical hardcoded data so this works, but it's architecturally sloppy.

**Justification**: Core layering is clean — the four-layer separation (core/nestjs/client/react) is well-executed and matches the design doc Section 2.2. The major v2 improvement (mock using `ContextLayerModule.forRoot()`) is the right architectural pattern. Deducted 1 point for dead code and duplication.
**Suggestion**: Delete `controllers/context-demo.controller.ts`. Remove unused methods from MockDataService. Import types from `@kedge-agentic/context-layer` instead of re-declaring them.

### D3: TypeScript 正确性 (Weight: 15/100)
**Score: 5/5**

**tsc results**: 0 errors across all 3 packages.

**Interface alignment against design doc Section 3 + 7.1:**

| Interface | Design Doc | Implementation | Status |
|-----------|-----------|----------------|--------|
| ReferenceableOptions | type, displayName, icon, abilities, contextFields, hideRelations, relationLabels, recommender | All present + `color?: string` extension | ✓ |
| ActivityRecord | userId, tenantId, entityType, entityId, entityDisplayName, sessionId, sessionTemplateId, action, source, timestamp | All present, exact match | ✓ |
| EntityTypesResponse | `{ types: EntityTypeInfo[], tree: RelationTree }` | Exact match | ✓ |
| SuggestResponse | `{ recents: [...], cachedAt: '...' }` (Section 7.1) | `{ recents: Recommendation[], cachedAt: string }` | ✓ |
| BrowseResponse | `{ items: [...], total, page }` (Section 7.1) | `{ items: BrowseItem[], total: number, page: number }` | ✓ |
| SearchResponse | `{ results: [...] }` | `{ results: SearchResult[] }` | ✓ |
| ResolveResponse | `{ entityType, entityId, displayName, data, dataHash, resolvedAt, breadcrumb }` | Exact match | ✓ |
| ShortcutsResponse | `{ pinned: [...], hidden: [...] }` | `{ pinned: string[], hidden: string[] }` | ✓ |

**Note**: SPEC.md summary table says SuggestResponse should have `recommended: RecommendedItem[]`, but design doc Section 7.1 (the authoritative source per frozen constraint #4) shows only `recents` and `cachedAt`. Implementation correctly follows the design doc.

**Core service interfaces** (CacheStore, OrmAdapter, EntityBrowseProvider, ActivityQueue) are well-designed and properly abstract framework-specific concerns.

**Justification**: Zero compilation errors and strong alignment with the authoritative design doc. The `color` extension to ReferenceableOptions is a reasonable addition that doesn't violate the spec.
**Suggestion**: None — this dimension is solid.

### D4: 性能 SLA (Weight: 8/100)
**Score: 3/5**

**Static analysis (no runtime measurement):**
- **Search debounce**: 200ms in `AtPicker.tsx:96` and `index.html:293` via `setTimeout` ✓
- **Suggest API path**: Controller → RecommendEngine.getTopN → MockCacheStore.zrevrange (in-memory Map sort) → should be < 50ms ✓
- **Browse API path**: Controller → ContextInjector.browse → MockBrowseProvider → MockDataService.getBrowse (array lookup) → should be < 200ms ✓
- **N+1 pattern**: RecommendEngine.getTopN does N sequential `hget` calls for entity info, where N = limit (default 10). With in-memory cache this is negligible, but with real Redis this would be N round-trips.

**Justification**: Code patterns are correct (debounce present, in-memory operations fast). Cannot verify actual timing without running services. The N+1 `hget` pattern in RecommendEngine could be a concern with real Redis.
**Suggestion**: Use `HMGET` (batch) instead of N individual `hget` calls in RecommendEngine.getTopN. Add `hmget` to CacheStore interface.

### D5: 前端交互质量 (Weight: 8/100)
**Score: 3/5**

**Static analysis (no visual verification):**
- **Slide-up animation**: `@keyframes atPickerSlideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }` with `0.15s ease-out` ✓
- **Breadcrumb navigation**: Trail array builds correctly; back button slices trail; breadcrumb shows `← [parent] › [current]` ✓
- **Ref pill format**: `icon + displayName + × button` in both RefPill.tsx and index.html ✓
- **Multiple pills**: Side-by-side flex layout with count indicator ✓

**Issues found:**
1. **MentionPicker.tsx does NOT render AtPicker** — it only renders ref pills. The actual picker rendering is missing from chat-interface integration. The demo page (index.html) has its own inline AtPicker, but `packages/chat-interface/` lacks the connection.
2. **No keyboard navigation** — no arrow key support in picker items, no Escape to close (only programmatic close via onClose)

**Justification**: Core interactions are implemented correctly with animation. The main gap is the incomplete chat-interface integration — MentionPicker.tsx is a pill-only component that doesn't actually mount the AtPicker overlay. Users looking at the chat-interface package alone wouldn't get a working picker.
**Suggestion**: MentionPicker.tsx should conditionally render `<AtPicker>` (from context-layer-react) when `pickerOpen` is true. Add Escape key handling to close the picker.

### D6: 代码规范 (Weight: 4/100)
**Score: 4/5**

**Checks:**
- Controller `@ApiTags`: `@ApiTags('context')` present on ContextLayerController ✓
- File naming: All kebab-case ✓
- Variable naming: All camelCase ✓
- TODO/FIXME: None found (grep across all 3 packages) ✓
- ESLint: Not configured for these new packages (no `.eslintrc`)

**Issues:**
1. **Dead file**: `controllers/context-demo.controller.ts` (1931 bytes) still exists
2. **Dead code in MockDataService**: 4 unused methods (~60 lines)
3. **Inline type declarations in mock-data.service.ts**: 6 interfaces re-declared instead of imported

**Justification**: Naming and structural conventions are followed correctly. The controller has proper Swagger annotation. Deducted for dead code.
**Suggestion**: Delete `controllers/context-demo.controller.ts`. Remove dead methods from MockDataService. Import shared types.

## Penalty Deductions
- P1 (core NestJS import): NOT triggered
- P2 (Composer modification): NOT triggered
- P3 (mock edu-platform import): NOT triggered
- P4 (API schema mismatch): NOT triggered — all response schemas align with design doc Section 7.1
- P5 (decorator runtime logic): NOT triggered — pure SetMetadata

**Total penalties: 0**

## Score Summary
| Dimension | Score | Weighted |
|-----------|-------|----------|
| D1 场景通过率 | 1/5 | 7/35 |
| D2 架构合规性 | 4/5 | 24/30 |
| D3 TS正确性 | 5/5 | 15/15 |
| D4 性能SLA | 3/5 | 4.8/8 |
| D5 前端交互 | 3/5 | 4.8/8 |
| D6 代码规范 | 4/5 | 3.2/4 |

**Penalties**: -0
**总分: 59/100**

## Bug Classification

### [COMPONENT] — Generator 可修
1. **Dead file not deleted** — `solutions/mock/context-layer-demo/src/controllers/context-demo.controller.ts` still exists despite v2 changelog claiming deletion
2. **MockDataService dead code** — `getSuggest()`, `getEntityTypes()`, `getShortcuts()`, `recordActivity()` methods are unused in v2 architecture
3. **MockDataService duplicate types** — 6 interfaces re-declared that exist in `@kedge-agentic/context-layer`
4. **MentionPicker incomplete** — `MentionPicker.tsx` renders pills only, doesn't mount `<AtPicker>` overlay
5. **N+1 hget in RecommendEngine** — Sequential `cache.hget()` calls in `getTopN()` loop (10 round-trips per suggest)
6. **MockDataService.roots stale** — Hardcoded roots array includes child types; dead code since EntityRegistry.computeRoots() handles this

### [SYSTEM] — 超出范围
1. **Services not running** — D1 capped at 1/5 because mock backend and chat-interface dev servers weren't started. All 13 scenarios appear correct via static analysis.

### [DESIGN] — 需设计决策
1. **SPEC.md vs design doc discrepancy** — SPEC.md says SuggestResponse should have `recommended: RecommendedItem[]`, but design doc Section 7.1 only shows `recents` + `cachedAt`. Implementation follows design doc (correct per frozen constraint #4), but SPEC.md needs updating.
2. **AtPickerProvider bypasses ContextLayerClient** — Inlines raw `fetch()` calls instead of using the ContextLayerClient SDK. This means the SDK's auth injection, error handling, and type safety aren't used by the primary consumer.

## Actionable Fix Hints

1. **[D6]** File: `solutions/mock/context-layer-demo/src/controllers/context-demo.controller.ts` — Expected: deleted — Fix: `rm solutions/mock/context-layer-demo/src/controllers/context-demo.controller.ts && rmdir solutions/mock/context-layer-demo/src/controllers`

2. **[D6]** File: `solutions/mock/context-layer-demo/src/seed/mock-data.service.ts:89` — Expected: no `roots` field — Fix: Remove `private roots = [...]` and all dead methods (`getSuggest`, `getEntityTypes`, `getShortcuts`, `recordActivity`)

3. **[D5]** File: `packages/chat-interface/src/components/chat/MentionPicker.tsx:22-76` — Expected: renders `<AtPicker>` when `pickerOpen` — Fix: Import `AtPicker` from `@kedge-agentic/context-layer-react` and render conditionally

4. **[D4]** File: `packages/context-layer/src/core/recommend-engine.ts:46-57` — Expected: batch hget — Fix: Add `hmget` to CacheStore interface, use batch retrieval in `getTopN()`

5. **[D6]** File: `solutions/mock/context-layer-demo/src/seed/mock-data.service.ts:1-55` — Expected: import types from `@kedge-agentic/context-layer` — Fix: Replace inline type declarations with `import type { ... } from '@kedge-agentic/context-layer'`

## Top 3 Priority Fixes

1. **[D1 — highest impact, +28 pts potential]** Start services and run E2E tests. Static analysis shows all 13 scenarios should pass. The mock backend compiles cleanly (tsc 0 errors) and the demo page (index.html) has complete inline UI. Fix: `cd solutions/mock/context-layer-demo && npm run dev` + run Playwright. If any test fails, it's likely a timing issue (adjust `waitForTimeout` values).

2. **[D5 — +3.2 pts potential]** Complete MentionPicker.tsx chat-interface integration. Currently renders pills only — needs to mount `<AtPicker>` from context-layer-react. This is the gap between "demo works" and "chat-interface integration works". File: `packages/chat-interface/src/components/chat/MentionPicker.tsx`.

3. **[D2/D6 — +2 pts potential]** Clean up dead code: delete `context-demo.controller.ts`, remove unused MockDataService methods and duplicate type declarations, remove stale `roots` array.

## What's Working Well

1. **Core/NestJS layering** — The four-layer architecture (core → nestjs → client → react) is cleanly executed. Core services are pure TS with zero framework dependencies. The `ContextLayerModule.forRoot()` pattern with adapter injection (CacheStore, OrmAdapter, EntityBrowseProvider) is a textbook DynamicModule implementation that enables solution-specific customization without framework coupling.

2. **Interface design fidelity** — All response types (`EntityTypesResponse`, `SuggestResponse`, `BrowseResponse`, `SearchResponse`, `ResolveResponse`) exactly match the design doc Section 7.1. The `EntityRegistry.getBreadcrumb()` implementation correctly traces parent chains through the cache, and `ContextInjector` properly enriches browse/search results with hasChildren and breadcrumbs. The decorator-driven metadata scanning in `onModuleInit()` is correctly implemented.
