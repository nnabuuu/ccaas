# Evaluation Report: v2

## Pre-Gate Results
- tsc (context-layer): **PASS** — 0 errors
- tsc (context-layer-react): **PASS** — 0 errors
- tsc (edu-platform): **PASS** — 0 errors
- tsc (chat-interface): **PASS** — 0 errors
- P1 (core NestJS import): **PASS** — `packages/context-layer/src/core/` has zero `@nestjs` imports
- P2 (backward compatibility): **FAIL** — backend cannot start; unable to verify endpoint responses
- P3 (entity/service modification): **PASS** — no diffs in `lesson-plan/`, `template/`, `curriculum/`
- P5 (provider in solution layer): **PASS** — `lesson-plan.provider.ts`, `template.provider.ts`, `requirement.provider.ts` all in `solutions/business/edu-platform/backend/src/referenceable/providers/`

## Critical Blocker

**The edu-platform backend fails to start.** `ReferenceableModule` injects `EntityRegistry` directly but never imports `ContextLayerModule` (which provides `EntityRegistry` as a NestJS provider). Error:

```
Nest can't resolve dependencies of the ReferenceableModule (?, LessonPlanProvider, TemplateProvider, RequirementProvider).
Please make sure that the argument EntityRegistry at index [0] is available in the ReferenceableModule context.
```

**Root cause**: `referenceable.module.ts` line 2 imports `EntityRegistry` from `@kedge-agentic/context-layer/core` (a plain class), but does not import the `ContextLayerModule` which actually registers `EntityRegistry` as a NestJS provider via `forRoot()`. The module needs to either:
1. Import `ContextLayerModule` in its `imports` array, or
2. The `AppModule` must import `ContextLayerModule.forRoot(...)` so `EntityRegistry` is globally available

Because the backend cannot start, all 12 E2E scenarios fail at runtime. D1 is evaluated via code analysis only (capped at 3/5 per evaluator protocol).

## Per-Dimension Scores

### D1: 场景通过率 (Weight: 35/100)
**Score: 1/5**
**Scenarios**: 0/12 passed (runtime), code analysis suggests ~8-9/12 would pass if the DI issue were fixed
- Scenario 1 (EntityContext 获取): FAIL (server won't start) — code logic correct
- Scenario 2 (AtReference summary): FAIL (server won't start) — `buildSummary()` logic looks correct, truncates at 100
- Scenario 3 (Relations): FAIL (server won't start) — LessonPlanProvider correctly builds requirement relation from `lp.requirement`
- Scenario 4 (Template EntityContext): FAIL (server won't start) — TemplateProvider has `block_summary` in structured
- Scenario 5 (Requirement EntityContext): FAIL (server won't start) — RequirementProvider has `name`, `level`, `subject` in structured
- Scenario 6 (Search + summary): FAIL (server won't start) — search returns `AtReference[]` with summary, but E2E tests `data.results` which is `SearchResult[]` not `AtReference[]`. The search endpoint goes through `ContextInjector.search()` which returns `SearchResponse` (not provider search). Provider search is only called from `ContextRouter` via `getEntityContext`, not from the `/context/search` endpoint. **The search summary would likely be empty/missing.**
- Scenario 7 (Apply success): FAIL (server won't start) — `LessonPlanProvider.apply()` logic is present
- Scenario 8 (Apply business rule): FAIL (server won't start) — checks `status === 'published'` correctly
- Scenario 9 (Picker summary): FAIL (server won't start + no index.html served)
- Scenario 10 (Message references): FAIL (server won't start + no index.html served)
- Scenario 11 (Apply button): FAIL (no `apply_action` render component exists anywhere)
- Scenario 12 (Backward compat): FAIL (server won't start) — also, E2E tests send `params: { type: ... }` but controller accepts `entity_type` query param

**Additional E2E/integration issues discovered by code analysis (would cause failures even if DI is fixed):**
1. E2E tests expect server at `localhost:3001` but `main.ts` defaults to port `3011`
2. E2E tests do NOT include the `/api` global prefix that `main.ts` sets
3. Browse endpoint: E2E sends `{ type: 'lesson_plan' }` but controller expects `{ entity_type: ... }`
4. Resolve endpoint: E2E expects `resolveData.entity` but `ResolveResponse` has flat fields (no `entity` wrapper)
5. Search endpoint: provider-level search (returning `AtReference[]` with summary) is not wired into the existing `/context/search` endpoint

**Justification**: Zero scenarios pass at runtime due to DI startup failure. Even with the fix, at least 4-5 scenarios would fail due to port/prefix/query-param mismatches between E2E tests and actual API. Score is 1/5 because no scenario actually passes.
**Suggestion**: Fix `ReferenceableModule` to import `ContextLayerModule` (or ensure `AppModule` imports `ContextLayerModule.forRoot(...)`). Then fix port to 3001, remove `/api` prefix or update E2E base URL, and align query parameter names.

### D2: 架构合规性 (Weight: 25/100)
**Score: 4/5**
**Justification**:
- P1 PASS: `core/` has zero NestJS imports. `ContextRouter`, `EntityRegistry`, all interfaces are pure TypeScript.
- P2 INCONCLUSIVE: Cannot verify backward compatibility at runtime (server won't start). Code analysis: the controller endpoints for existing routes (`entity-types`, `suggest`, `browse`, `search`, `resolve`, `shortcuts`) are unchanged in structure. The response types `EntityTypesResponse`, `BrowseResponse`, `SearchResponse`, `SuggestResponse`, `ResolveResponse` are not modified. **P2 likely passes if the server starts.**
- P3 PASS: No files modified in `lesson-plan/`, `template/`, `curriculum/`.
- P5 PASS: All providers in `solutions/business/edu-platform/backend/src/referenceable/providers/`.
- DB schema: No migrations or entity changes.
- Provider registration in `onModuleInit()` of `ReferenceableModule` — correct pattern.
- `ContextRouter` in `core/` delegates to `EntityRegistry.getProvider()` — clean separation.

Deduction: -1 for the DI integration issue (ReferenceableModule doesn't properly import the module that provides EntityRegistry). This is an architecture boundary issue — the module dependency graph is broken.

**Suggestion**: Add `ContextLayerModule` import to `ReferenceableModule` or (better) ensure `AppModule` imports `ContextLayerModule.forRoot(...)` which exports `EntityRegistry` globally.

### D3: TypeScript 正确性 (Weight: 15/100)
**Score: 5/5**
**Justification**:
- `tsc --noEmit` passes with 0 errors across all 4 packages.
- Interface alignment with design doc is **exact**:
  - `AtReference`: `type`, `id`, `display_name`, `summary` — matches
  - `EntityContext`: `ref`, `structured`, `relations`, `attachments` — matches
  - `EntityAttachment`: `name`, `path`, `mime_type`, `size_bytes` — matches
  - `ApplyAction`: `id`, `target`, `field_path`, `suggested_value`, `description`, `status` (`'pending' | 'applied' | 'outdated'`), `applied_at?` — matches
  - `ApplyRequest`: `entity_id`, `field_path`, `suggested_value`, `action_description`, `session_id` — matches
  - `EntityContextProvider`: `getContext`, `search`, `apply?` — matches

**Suggestion**: None needed. Types are perfectly aligned.

### D4: EntityContext 数据质量 (Weight: 15/100)
**Score: 3/5**
**Justification** (code analysis only — server cannot start):
- **LessonPlan summary**: `buildSummary()` concatenates `class_name`, `subject`, `lesson_type`, '教案', `duration`分钟, `学业要求{code}`. Truncates at 100 chars. Format matches spec: `{class} {subject} {lesson_type} 教案 {duration}分钟`. **Looks correct.**
- **LessonPlan relations**: Builds requirement relation from `lp.requirement` with `type: 'requirement'`, `id`, `display_name: '课标:{code}'`, `summary: requirement.text`. Design doc also expects exercise and skill_run relations, but those entities don't exist in the edu-platform providers (only lesson_plan, template, requirement). **Partial — only requirement relations are present.**
- **Template structured**: Has `block_summary` (filtered section blocks), `name`, `scope`, `lesson_type`, `version`, `usage_count`, `subject`, `blocks`. Matches spec.
- **Template summary**: `{name} ({scope}作用域) {lesson_type}模板 v{version}`. Matches spec format.
- **Requirement structured**: Has `name`, `level`, `subject`, `grade_range`, `sort_order`, `cognitive`, `parent_id`. Matches spec.
- **Requirement summary**: `{subject} {name} ({grade_range}年级)`. Matches spec.
- **Search summary integration**: Provider `search()` methods return `AtReference[]` with summary, BUT the `/context/search` endpoint uses `ContextInjector.search()` which produces `SearchResponse` with `SearchResult[]` — these are NOT `AtReference[]`. The `SearchResult` type has `summary?: string` as optional field, but it's populated from the browse provider, not from the EntityContext provider. **Provider search summaries are not reachable from the `/context/search` endpoint.**

Deductions: -1 for not being able to verify at runtime, -1 for search summary not wired through the main search endpoint.

**Suggestion**: Wire provider-level search into the `/context/search` endpoint, or at minimum ensure `SearchResult.summary` is populated from provider data. Currently the two search paths (provider search via `EntityContextProvider.search()` and endpoint search via `ContextInjector.search()`) are independent.

### D5: 前端交互 (Weight: 10/100)
**Score: 3/5**
**Justification**:
- **Summary in AtPicker**: PRESENT. `AtPicker.tsx` renders summary as a `<div>` with `fontSize: '11px', color: '#888'` below each item in recents, browse, and search results. Uses `data-testid` like `recent-summary-{id}`, `browse-summary-{id}`, `search-summary-{id}`. **Correct.**
- **RefPill color prop**: PRESENT. `RefPill.tsx` accepts `color?: RefPillColor` and maps to a palette. Supports `blue | green | orange | purple | red`. **However:** design doc specifies `teal` for requirements and `gray` for templates — neither is in the palette. **Missing 2 colors.**
- **MentionContext summary**: PRESENT. `MentionRef` interface includes `summary?: string`. `MentionPicker.tsx` passes `summary: entity.summary` from `EntityRef` to `MentionRef`. **Correct.**
- **MentionPicker does NOT use RefPill**: `MentionPicker.tsx` renders inline pills with hardcoded blue color instead of using the exported `RefPill` component. The registered entity color is not used in the chat mention pills. **Inconsistency.**
- **Apply button rendering**: NOT PRESENT. No `apply_action` block renderer, no `ApplyActionButton` component, no `data-testid="apply-action-button"` anywhere in the codebase. **Missing entirely.**
- **data-testid coverage**: Excellent coverage in AtPicker and RefPill.

Deductions: -1 for missing apply button component, -1 for MentionPicker not using RefPill/registered colors.

**Suggestion**: Create an `ApplyActionButton` component that renders `apply_action` content blocks as clickable buttons with `data-testid="apply-action-button"`. Use the `RefPill` component in `MentionPicker` instead of inline rendering, passing the entity's registered color.

## Penalty Deductions
- **P2 (backward compatibility)**: INCONCLUSIVE — server cannot start. Code analysis suggests endpoints are unchanged. **No penalty applied** (benefit of the doubt since P2 is a runtime check and the code structure is correct).
- No other penalties triggered. P1 passes, P3 passes, P5 passes.

## Score Summary
| Dimension | Score | Weighted |
|-----------|-------|----------|
| D1 场景通过率 | 1/5 | 7/35 |
| D2 架构合规性 | 4/5 | 20/25 |
| D3 TS正确性 | 5/5 | 15/15 |
| D4 数据质量 | 3/5 | 9/15 |
| D5 前端交互 | 3/5 | 6/10 |

**Penalties**: 0
**总分: 57/100**

## Bug Classification

### [COMPONENT] — Generator 可修
1. `solutions/business/edu-platform/backend/src/referenceable/referenceable.module.ts:1-34` — `ReferenceableModule` does not import `ContextLayerModule`, causing `EntityRegistry` DI resolution failure. Server cannot start.
2. `solutions/business/edu-platform/backend/src/main.ts:17` — Port defaults to `3011` but E2E tests and SPEC expect `3001`.
3. `solutions/business/edu-platform/backend/src/main.ts:14` — Global prefix `api` is set but E2E tests don't include it in URLs.
4. `packages/chat-interface/src/components/chat/MentionPicker.tsx:82-84` — Hardcoded blue color instead of using `RefPill` component with entity-registered color.
5. `packages/context-layer-react/src/components/RefPill.tsx:3` — `RefPillColor` type missing `teal` and `gray` colors specified in design doc.
6. No `ApplyActionButton` component exists — `apply_action` content block rendering is not implemented.

### [SYSTEM] — 超出范围
1. E2E test query parameters (`type` vs `entity_type`, `id` vs `entity_id`) may be pre-existing mismatches in the test file vs controller design. The E2E test was written to a different API contract than the controller implements.
2. E2E Scenario 12 expects `resolveData.entity` but `ResolveResponse` has flat fields — this may be a pre-existing test/API mismatch.

### [DESIGN] — 需设计决策
1. Provider search (`EntityContextProvider.search()`) vs endpoint search (`/context/search`): these are two independent code paths. Should the endpoint search delegate to providers for entity types that have providers registered? This requires a design decision on whether to augment existing search with provider-sourced summaries.

## Actionable Fix Hints
1. **[D1/D2]** File: `solutions/business/edu-platform/backend/src/app.module.ts` — Expected: `ContextLayerModule.forRoot(...)` in imports — Fix: Import and configure `ContextLayerModule.forRoot()` with the required `CacheStore`, `OrmAdapter`, `EntityBrowseProvider` adapters. This will make `EntityRegistry` available as a provider.
2. **[D1]** File: `solutions/business/edu-platform/backend/src/main.ts:17` — Expected: `process.env.PORT || 3001` — Fix: Change default port to `3001` to match E2E expectations and SPEC.
3. **[D1]** File: `solutions/business/edu-platform/backend/src/main.ts:14` — Expected: No global prefix or update E2E base URL — Fix: Remove `app.setGlobalPrefix('api')` or update E2E `BASE` to `http://localhost:3001/api`.
4. **[D5]** File: Create `packages/chat-interface/src/components/chat/ApplyActionBlock.tsx` — Expected: Component rendering `apply_action` blocks as buttons with `data-testid="apply-action-button"` — Fix: Create a new component that accepts `ApplyAction` and renders a button that calls `POST /context/apply`.
5. **[D5]** File: `packages/context-layer-react/src/components/RefPill.tsx:3` — Expected: `RefPillColor` includes `'teal' | 'gray'` — Fix: Add `teal` and `gray` to the color map and type union.
6. **[D5]** File: `packages/chat-interface/src/components/chat/MentionPicker.tsx:82` — Expected: Use `<RefPill>` component with entity color — Fix: Import and use `RefPill` with `color={entityColor}` instead of inline styling.

## Top 3 Priority Fixes
1. **Highest impact — D1 (all 12 scenarios blocked)**: `app.module.ts` must import `ContextLayerModule.forRoot(...)` to provide `EntityRegistry` as a NestJS provider. Without this, zero scenarios pass. Fix: add `ContextLayerModule.forRoot({ cacheStore: ..., ormAdapter: ..., browseProvider: ... })` to `AppModule.imports`. Also ensure `main.ts` uses port 3001 and remove/align the `/api` prefix.
2. **Second highest — D1 (scenarios 6, 9, 12)**: Align query parameter names between E2E tests and controller. The controller uses `entity_type` but E2E sends `type`. Fix either the controller or the tests — but since controller is frozen (backward compat), the E2E tests may need updating, OR a secondary query param alias should be supported.
3. **Third highest — D5 (scenario 11)**: Create `ApplyActionButton` component. This is the only completely missing feature — all other frontend work (summary display, RefPill color, MentionRef summary) is present in some form.

## What's Working Well
1. **Core/NestJS separation is excellent.** `packages/context-layer/src/core/` is completely NestJS-free. `ContextRouter`, `EntityRegistry`, all interfaces are pure TypeScript. The NestJS controller in `nestjs/` delegates to core classes. This is the exact pattern the architecture requires.
2. **TypeScript interface alignment is perfect.** All 6 spec interfaces (`AtReference`, `EntityContext`, `EntityAttachment`, `ApplyAction`, `ApplyRequest`, `EntityContextProvider`) match the design document exactly, field by field, type by type. The generator should NOT modify these.
