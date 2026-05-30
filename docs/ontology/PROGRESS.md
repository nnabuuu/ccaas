# kedge-ontology — Implementation Progress

> Status tracker for the 5 phases in [kedge-ontology-implementation-plan.md](./kedge-ontology-implementation-plan.md).
> Updated as work lands. Spec lives in the impl plan; this doc tracks status only.

Status emoji legend: 🔵 in progress · ✅ shipped · ⏳ waiting · ❌ blocked / failed · ⏸ paused.

## Phase status

| Phase | Status | Started | Shipped | Final commit | Notes |
|---|---|---|---|---|---|
| 1 — Bootstrap v0.1 (core + Tier 1) | ✅ shipped | 2026-05-29 | 2026-05-29 | `be66d366` | 10-commit sequence landed; 165 tests; framework-free verified by architecture test |
| 2 — context-layer refactor | ✅ shipped | 2026-05-30 | 2026-05-30 | `34a276b6` | 19-commit sequence on branch `phase2-context-layer-refactor` (pushed to `origin/phase2-context-layer-refactor`); 91 tests across 5 files (36 parity baseline + 5 schema accessor + 14 converter + 11 adapter + 25 NestJS integration); **4 code-reviewer passes** (2 on the main refactor, 2 on the integration suite — all 4 ended with zero must-fix); EntityRegistry delegates to OntologyRegistry source-compatibly; integration suite found + fixed pre-existing bug in `ContextLayerModule`'s discovery path (`fix(context-layer)` `2695fbcd`) |
| 3 — live-lesson + bridge | ✅ shipped | 2026-05-30 | 2026-05-30 | (pending push) | 7-commit sequence on branch `phase3-live-lesson-bridge` (cut from `phase2-context-layer-refactor`, not `master`, because Phase 3 depends on Phase 2's `ContextLayerInitService`). Phase 3A (5 commits): workspace dep + ontology module skeleton + GET `/api/v1/ontology/schema` with ETag/304 + `compileActionToToolDefinition` bridge + `ManifestAccessorService` + wire into AppModule. Phase 3B (2 commits): live-lesson ontology defs (4 ObjectTypes + LessonSession manifest + `emit_todo_card` ActionDef + LiveLessonOntologyService registrar) co-located in platform backend + PROGRESS.md update. **User overrode the Chengdu PoC gate** (refactor risk judged smaller than continued drift). 5 deferrals captured in the decisions log: PoC gate, two-process registration architecture, @Referenceable on live-lesson, observer-engine event bridge, e2e spec 17. 26 ontology tests across 4 suites (3 schema + 8 bridge + 10 accessor + 5 registrar integration). 2 code-reviewer passes (pass 2 zero must-fix). Backend typecheck + harness baseline clean. Stop-before-push. |
| 4 — Tier 2 primitives | ⏳ waiting | — | — | — | Gated on a real Solution expressing need for at least one Tier 2 primitive. **1 candidate identified** — see "Phase 4 trigger candidates" below. |
| 5 — Tier 3 primitives | ⏳ waiting | — | — | — | Per-item gated on individual promotion criteria |

## Phase 1 commit log

Within Phase 1's single PR, work is broken into 10 incremental commits, one per module subdirectory. Each row gets its SHA filled in as the commit lands.

| # | Commit subject | SHA | Notes |
|---|---|---|---|
| 1 | feat: bootstrap @kedge-agentic/ontology package skeleton (phase 1, commit 1/10) | `8c6aed39` | package.json / tsconfig.json / vitest.config.ts / README.md / src/index.ts stub / src/__tests__/architecture.test.ts smoke. Root package.json wires `build:ontology` into `build:libs`. |
| 2 | feat: ontology schema primitives — layer 1 (phase 1, commit 2/10) | `abcb3526` | `src/schema/*` (8 primitives + barrel) + `src/types.ts` (cross-layer BoundaryRole). 30 tests across 7 files. Phase 4/5 deferred fields verified compile-time-blocked via @ts-expect-error. |
| 3 | feat: ontology manifest primitives — layer 2 (phase 1, commit 3/10) | `42966864` | `src/manifest/*` 5 files + barrel; integration test 14 cases. SlotTarget objectSet kind / BoundaryPathEntry predicate entries / ManifestDef.notifications all confirmed compile-time-blocked via @ts-expect-error. 44 tests across 8 files. |
| 4 | feat: ontology accessor layer + boundary check — layer 3 (phase 1, commit 4/10) | `3b91e09b` | `src/accessor/*` 4 source files + barrel; 29 tests across 2 files. Two-gate action check; Tier 1 stateEquals + slotBound preconditions evaluated against optional `state` / `boundSlots` snapshots; `named` returns unmet (Phase 4 stub). Dot-path prefix matching for read/write. 73 tests across 10 files. |
| 5 | feat: ontology define helpers (phase 1, commit 5/10) | `36e22d2b` | `src/helpers/define.ts` — 5 helpers as type-narrowing passthroughs. Compile-time gates verified via @ts-expect-error for misnamed meta keys, mis-typed StateDef.initial, ObjectTypeDef.implements (Phase 4), ActionDef.returnType (Phase 5). 83 tests across 11 files. |
| 6 | feat: ontology validators + registration error (phase 1, commit 6/10) | `c55f6322` | `src/schema/validators.ts` + `registration-error.ts` — 11 ValidationCodes covering Tier 1: SEMANTIC_EMPTY, META_KEY_UNKNOWN, WILDCARD_OUTSIDE_ADMIN, STREAM_PAYLOAD_EXCLUSIVE, LINK_TARGET_UNRESOLVED, SLOT_TARGET_UNRESOLVED, DERIVED_FROM_UNRESOLVED, LIFECYCLE_ACTION_UNRESOLVED, PRECONDITION_STATE/SLOT_UNRESOLVED, PRECONDITION_NAMED_UNSUPPORTED. Pure functions taking ValidationContext. 108 tests across 12 files. |
| 7 | feat: ontology registry (phase 1, commit 7/10) | `7ddc3db1` | `src/registry/ontology-registry.ts` — OntologyRegistry class. Two-phase registration (local validation eager / cross-def deferred to validate()/seal()). Read API + queries (getPickableTypes / getTraversableLinks / getManifestsForType / getDisplayName). DUPLICATE_DEFINITION ValidationCode added. Out-of-order registration supported. getSchemaDigest stubbed (commit 8). 133 tests across 14 files. |
| 8 | feat: ontology distribution — serialize + digest (phase 1, commit 8/10) | `24a22e9d` | `src/distribution/{serialize,digest}.ts` — serializeRegistry (Zod → JSON Schema via zod-to-json-schema; lists sorted), canonicalize (recursive key-sort), computeSchemaDigest (sha256). Wires real impl into OntologyRegistry.getSchemaDigest. 145 tests across 15 files. |
| 9 | feat: ontology semantic projection (phase 1, commit 9/10) | `33133e06` | `src/semantic/{project,formats/*}.ts` — projectManifest dispatcher + 3 format adapters (anthropic-tools, mcp-tools, system-prompt). Action visibility via checkBoundary (boundary + allowedRoles); preconditions ignored at projection time (no runtime state). 159 tests across 16 files. |
| 10 | feat: ontology architecture test + phase 1 shipped (phase 1, commit 10/10) | `be66d366` | Beefed-up architecture test (recursive walk of src/: bans @nestjs/*, React/Vue/Svelte, any @kedge-agentic/* import, solutions/* paths; allowlists zod + zod-to-json-schema + node builtins). README → "Phase 1 shipped". PROGRESS.md → Phase 1 ✅ + commit 9 SHA. 165 tests; all subpath .d.ts emitted; framework-free verified. |

## Decisions log

Decisions made during implementation that diverge from or refine the spec/impl-plan. Each entry references the commit that introduced the divergence.

- **2026-05-29, commit 1**: Adopted subpath exports (`@kedge-agentic/ontology/schema`, etc.) matching `agent-runtime`'s pattern, instead of the single-root-`index.ts` re-export described in design spec §2.1. Rationale: consistency with sibling framework-free packages + cleaner consumer imports + better tree-shaking. Catch-all root still exists for convenience.
- **2026-05-29, commit 1**: `AccessBoundary.readable`/`.writable` will ship as `readonly string[]` in Phase 1, not the `BoundaryPathEntry` union shape (`string | { slot, where }`) from design spec §4.4. The union with predicate entries lands in Phase 4 alongside `BoundaryPredicate`. Forward-compatible: callers passing plain strings today work unchanged when the union lands.
- **2026-05-29, commit 1**: Root `package.json` modified (added `build:ontology` script + chained into `build:libs`) — minor scope expansion vs the impl plan's "no file outside packages/ontology/" exit criterion. Necessary to meet the "build:libs includes ontology" exit criterion.

- **2026-05-30, Phase 2 commit `bf2a60f4`**: `EntityRegistry` internally holds an `OntologyRegistry` + a meta sidecar Map (carries the bits `ObjectTypeDef` can't model: full `ReferenceableOptions`, `controllerPath`, `entityClass`). Relations / breadcrumb / providers stay as local Maps because `OntologyRegistry`'s slot/link model is richer than parity requires; bridging those is deferred until a real consumer needs it.

- **2026-05-30, Phase 2 commit `bf2a60f4`**: `ReferenceableOptions` → `ObjectTypeDef` projection uses `z.object({}).passthrough()` as the schema placeholder (real `ReferenceableOptions` has no schema field). Solutions can override later by registering via `defineObjectType` directly.

- **2026-05-30, Phase 2 commit `bf2a60f4`**: `EntityRegistry.register`'s "last write wins" overwrite contract preserved by rebuilding the underlying `OntologyRegistry` from the sidecar on re-register (since `OntologyRegistry` rejects duplicate apiNames by design).

- **2026-05-30, Phase 2 commit `d25bd7b5`**: Pre-existing drift fixed — `EditOperation` type union in `interfaces.ts` was missing two variants (`block_attr_set`, `block_content_set`) that the controller already used. Type now matches the runtime shape; no behavior change.

- **2026-05-30, Phase 2 commit `2695fbcd`**: **Pre-existing bug fix surfaced by integration tests** — `ContextLayerModule` used constructor DI on the dynamic-module class itself for `DiscoveryService` + `Reflector` + `EntityRegistry` + `RelationInferrer`. NestJS does NOT inject dynamic-module class constructors (only `@Injectable()` providers). Result: `discoveryService` was `undefined` at `onModuleInit`, so the `@Referenceable` auto-discovery silently never registered any controller. Recipe-book didn't notice because it uses its own `ContextLayerLocalModule` with manual registration. Fix: extracted discovery + `RelationInferrer.scanAndRegister` into a new `@Injectable() ContextLayerInitService`. Zero observable behavior change for recipe-book; enables `ContextLayerModule.forRoot()`'s auto-discovery path to actually work for any future Solution.

- **2026-05-30, Phase 2 commit `cf1dbd2d`**: Vitest config adds `unplugin-swc` to preserve `design:paramtypes` decorator metadata. esbuild (vitest's default transformer) doesn't emit this even with `emitDecoratorMetadata: true` in tsconfig — silently breaks any NestJS DI under vitest. Required to make the integration suite work.

- **2026-05-30, Phase 2 commit `34a276b6`**: Pass-1 review of the integration suite (3 should-fix + 5 nits) addressed. Notable: dropped the redundant `Reflector` registration from `ContextLayerModule.providers` (Nest's core platform registers `Reflector` globally via `DiscoveryModule`); pinned the default-off interceptor contract with a real HTTP test against `ExplicitTrackingController` (asserting no activity is recorded when `useGlobalInterceptors` isn't called). 91 tests across 5 files. Pass-2 review returned zero must-fix.

- **2026-05-30, Phase 3 branch cut**: Branch `phase3-live-lesson-bridge` cut from `phase2-context-layer-refactor` (not `master`). Original plan said master; reality is Phase 3 depends on Phase 2's `ContextLayerInitService` (for any future `@Referenceable` auto-discovery) and the integration patterns Phase 2 established. Branch order in flight: phase2 → phase4-sliver → phase3 (each independent). Reviewer should rebase phase3 onto master only after phase2 lands.

- **2026-05-30, Phase 3 commit `94e2f450`**: `ToolResult` failure variant extended with optional `unmetPreconditions?: readonly ActionPrecondition[]`. Bridge contract per the impl-plan promises this field on permission-denied results when a precondition drove the denial. Backend types.ts already lived next to consumers of ontology types; the additive change is documented in the commit and has no behavioral side effect (audit pipeline ignores it).

- **2026-05-30, Phase 3 commit `0a25f2f7`**: `SessionsModule.exports` gains `SessionMetadataService`. It was already provided internally but not exported; OntologyModule needs it via DI. No behavior change for existing callers. Documented as a minor out-of-scope edit.

- **2026-05-30, Phase 3 commit `b570b649`**: Live-lesson ontology defs co-located in `packages/backend/src/ontology/live-lesson/` rather than `solutions/business/live-lesson/backend/src/ontology/`. See the Phase 3 deferrals table for the architectural rationale (two-process platform vs. solution).

- **2026-05-30, Phase 3 commit `b570b649`**: ActionDef-routed `emit_todo_card` registered under namespace `creator-actions`, NOT `creator` (the legacy stdio namespace). Both paths coexist while migration plays out. `EventMapperService` trigger-matching by suffix (`<ns>.emit_todo_card` / `<ns>_emit_todo_card`) fires identically for both, so the SSE routing is unchanged. Forward path: retire the stdio path in a later commit once the agent system prompt + e2e cover the ActionDef variant.

- **2026-05-30, Phase 3 plan**: 6 planned Phase 3B commits compressed to 2 (live-lesson ontology + this PROGRESS doc). The plan's commit-6 (`@Referenceable`) and commit-8 (event stream bridge) are deferred per the cross-process barrier; commits 7+9 fold into a single logical "first consumer" commit because the files cohere tightly; commit-10 stays as the integration test inside that consolidated commit; commit-11 (e2e spec 17) deferred. Each remaining commit is still revertible independently.

## Phase 3 commit log

| # | Commit subject | SHA | Notes |
|---|---|---|---|
| 1 | chore(backend): add @kedge-agentic/ontology workspace dep | `c2ee6858` | `packages/backend/package.json` + root `package-lock.json` regen. Dead-code until consumers register. |
| 2 | feat(backend): ontology module skeleton + get /api/v1/ontology/schema | `d4e21c96` | `packages/backend/src/ontology/{ontology.module.ts, ontology.controller.ts, ontology-registry.provider.ts, ontology.controller.spec.ts}`. ETag via `registry.getSchemaDigest()`; If-None-Match → 304 empty body; 200 body = `serializeRegistry(context())`. 3 integration tests (first 200+ETag, 304 on match, ETag-changes-on-mutation). `OptionalAuth` guard overridden in test via `AllowAllGuard`. |
| 3 | feat(backend): action-to-tool-definition bridge | `94e2f450` | `packages/backend/src/ontology/action-to-tool-definition.ts` — `compileActionToToolDefinition(action, handler, manifest, opts?)`. Wraps handler with `checkBoundary` at proxy step 3; denied → `{ok:false, code:'permission_denied', reason, unmetPreconditions}`. `ToolResult` failure variant gains optional `unmetPreconditions?: readonly ActionPrecondition[]` (out-of-scope additive edit, documented). 8 unit + proxy-integration tests (field projection, boundary deny on AccessBoundary.actions / on ActionDef.allowedRoles, unmetPreconditions surface on stateEquals, default 'agent' role, audit row outcome=ok / permission_denied). |
| 4 | feat(backend): manifest-accessor.service | `b03cb685` | NestJS-bound `ManifestAccessor` impl: state cache via SessionMetadataService KV (`manifest.<name>.<field>`), sync getState/setState (writes fire-and-forget persistence), getSlot from caller-provided snapshot, listActions stub (returns `[]` until Manifest.actions enumeration lands), invokeAction → ToolCallerProxy with mapped ActionErrorCode (precondition_unmet vs boundary_denied), subscribe + publish per-session pub/sub. 10 tests including criterion 3 round-trip. |
| 5 | feat(backend): wire ontology module into app module | `0a25f2f7` | `app.module.ts` imports OntologyModule. SessionsModule.exports gains `SessionMetadataService` so OntologyModule's ManifestAccessorService can resolve it externally. 98 tests across ontology + tool-caller suites green. |
| 6 | feat(backend): live-lesson ontology + emit_todo_card actiondef path | `b570b649` | 5 files under `packages/backend/src/ontology/live-lesson/`: object-types (Lesson, ClassroomSession, Student, Resource), lesson-session.manifest (4 slots + events stream + 2 state fields + agent/picker/admin boundaries), emit-todo-card.action (handler returns `{kind:'todo',...}` matching legacy stdio wire shape), live-lesson-ontology.service (registers + seals on `onModuleInit`, compiles via bridge, registers under namespace `creator-actions` so stdio `creator.emit_todo_card` and ActionDef `creator-actions.emit_todo_card` coexist). 5 integration tests covering criterion 2 (boundary + audit + permission_denied path + validation_failed path). |
| 7 | docs: phase 3 progress + decisions log + gitbook ontology-architecture | (pending) | PROGRESS.md → Phase 3 ✅ + commit log + decisions log entries for the 5 deferrals. NEW `docs/gitbook/zh/platform/ontology-architecture.md` per impl-plan §Phase 3 exit criterion. |

## Phase 3 deferrals (captured for follow-up)

These were intentionally deferred during Phase 3 execution and need explicit follow-up:

| Deferral | Reason | Re-visit trigger |
|---|---|---|
| Chengdu PoC gate overridden | Phase 3 was calendar-gated on PoC ship per impl-plan §B-Phase 3. User judged refactor risk < continued drift cost and approved override. | None — decision is final. |
| Live-lesson ontology defs co-located in platform backend (`packages/backend/src/ontology/live-lesson/`) instead of `solutions/business/live-lesson/backend/src/ontology/` | Platform backend (port 3001) owns OntologyRegistry + SolutionToolkitRegistry. Live-lesson backend (port 3007) is a separate NestJS process; cross-process registration has no wire protocol yet. | Add `ontologyModule` field to `solution.json` → SolutionLoaderService dynamically imports + registers each solution's contributions. Plays nicely with the existing skill/MCP loader pattern. |
| `@Referenceable` decorators NOT added to live-lesson controllers | Same cross-process barrier — ContextLayerInitService runs on the platform side and can't discover controllers in a different process. The slot snapshot pattern on `ManifestAccessorService.getAccessorFor({slotBindings})` keeps the surface honest in the meantime. | Same as above (solution.json hook) OR add a remote-discovery handshake at the platform↔solution boot boundary. |
| Observer-engine → `LessonSession.events` stream bridge NOT wired | observer-engine handlers fire inside the live-lesson backend process. Wiring them to the platform backend's ManifestAccessorService.publish() needs a transport (HTTP push, SSE, or shared NATS/Redis bus). | When the first agent flow needs to subscribe to live events (Phase 3.5 / 4 stretch). publish() is already in place on the platform side. |
| E2E spec 17 (ActionDef-routed emit_todo_card) NOT added | The new tool registers under namespace `creator-actions`; the existing creator agent isn't yet prompted to prefer it over the stdio `creator.emit_todo_card`. The integration test in commit 6 covers the bridge → audit round-trip; e2e adds the browser-level assertion. | When `creator.emit_todo_card` is retired and `creator-actions.emit_todo_card` becomes the sole advertised tool, OR when the system prompt explicitly steers the agent to the ActionDef variant. |

## Phase 4 trigger candidates

Concrete Tier 2 use cases identified in existing Solutions. Each row is a real
code/design path that would benefit from the named primitive — recorded here so
that when Phase 4 gating fires (Phase 3 shipped + at least one Solution committed
to consuming it), the implementation order can be driven by demand rather than
spec order.

| Primitive | Solution | Concrete need | Evidence |
|---|---|---|---|
| `ObjectSetDef` | `solutions/business/live-lesson` | "Struggling students" / "at-risk students" / "stuck students" are computed on every 3s teacher-dashboard poll and used as hardcoded filter sets across handlers + UI. Tier 2 lets these become named, agent-visible subsets the picker can reference (`strugglingStudents`, `atRiskStudents`) without re-spelling the filter at each call site. | Quadrant algorithm: `solutions/business/live-lesson/design/student-quadrant-algorithm.md` + `frontend/src/components/teacher/summary/summary-helpers.ts:computeStudentQuadrants()`. Hardcoded subset: `backend/src/adapters/observer-engine/handlers/status-change-handler.ts:22` (`ALERTABLE_STATUSES = ['stuck', 'struggling', 'idle']`). Dashboard health cards: `design/teacher-dashboard-design.md`. Audited 2026-05-30. |
| `InterfaceDef` | — | No clear cross-type query need today; existing polymorphism handled by Zod discriminated unions (observation kinds, answer-key kinds). Would land when a plugin ecosystem or 3rd-party observation types appear. | live-lesson audit 2026-05-30: present but not load-bearing. |
| `BoundaryPredicate` + predicate-scoped `AccessBoundary` | — | No per-row filtering need today — live-lesson scopes all access by `sessionId`; no `teacherId` / `classId` / `tenantId` axis exists. Triggers: multi-teacher concurrent sessions, parent-facing UI, or cross-session analytics. | live-lesson audit 2026-05-30: no current consumer. |
