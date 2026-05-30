# kedge-ontology — Implementation Progress

> Status tracker for the 5 phases in [kedge-ontology-implementation-plan.md](./kedge-ontology-implementation-plan.md).
> Updated as work lands. Spec lives in the impl plan; this doc tracks status only.

Status emoji legend: 🔵 in progress · ✅ shipped · ⏳ waiting · ❌ blocked / failed · ⏸ paused.

## Phase status

| Phase | Status | Started | Shipped | Final commit | Notes |
|---|---|---|---|---|---|
| 1 — Bootstrap v0.1 (core + Tier 1) | ✅ shipped | 2026-05-29 | 2026-05-29 | `be66d366` | 10-commit sequence landed; 165 tests; framework-free verified by architecture test |
| 2 — context-layer refactor | ⏳ waiting | — | — | — | Blocked on Phase 1 |
| 3 — live-lesson + bridge | ⏳ waiting | — | — | — | Gated on Chengdu PoC having shipped (per impl plan §B-Phase 3) |
| 4 — Tier 2 primitives | 🔵 **1 of 3 done — partial** | 2026-05-30 | — (full phase still open) | `c2decfd1` (ObjectSetDef sliver) | **NOT complete.** Only `ObjectSetDef` (the one Tier 2 primitive with a concrete live-lesson trigger) shipped. `InterfaceDef` and `BoundaryPredicate` (predicate-scoped `AccessBoundary`) **remain compile-time-blocked** and await their own triggering consumer. See "Phase 4 — what's left" below for the remaining work + triggers. |
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

## Phase 4 trigger candidates

Concrete Tier 2 use cases identified in existing Solutions. Each row is a real
code/design path that would benefit from the named primitive — recorded here so
that when Phase 4 gating fires (Phase 3 shipped + at least one Solution committed
to consuming it), the implementation order can be driven by demand rather than
spec order.

| Primitive | Solution | Concrete need | Evidence |
|---|---|---|---|
| `ObjectSetDef` ✅ | `solutions/business/live-lesson` | Shipped 2026-05-30 as the Phase 4 sliver (commit `c2decfd1`). Live-lesson migration of `strugglingStudents` / `atRiskStudents` / `stuckStudents` to real consumer-side ObjectSetDefs is the follow-up; not yet done. | Original audit unchanged below — primitive now usable. |
| `InterfaceDef` | — | No clear cross-type query need today; existing polymorphism handled by Zod discriminated unions (observation kinds, answer-key kinds). Would land when a plugin ecosystem or 3rd-party observation types appear. | live-lesson audit 2026-05-30: present but not load-bearing. |
| `BoundaryPredicate` + predicate-scoped `AccessBoundary` | — | No per-row filtering need today — live-lesson scopes all access by `sessionId`; no `teacherId` / `classId` / `tenantId` axis exists. Triggers: multi-teacher concurrent sessions, parent-facing UI, or cross-session analytics. | live-lesson audit 2026-05-30: no current consumer. |

## Phase 4 — what's left

Phase 4 ships in slivers, one primitive at a time. The first sliver (ObjectSetDef) is in; the other two remain `@ts-expect-error` blocked in tests and absent from the `defineX` family + `OntologyRegistry.registerX` methods, exactly so that consumers cannot accidentally use them ahead of an explicit landing decision.

| Sliver | Status | Trigger to start | Estimated scope |
|---|---|---|---|
| **`ObjectSetDef`** | ✅ shipped 2026-05-30 (`c2decfd1`) | live-lesson `strugglingStudents` need (already used) | done |
| **`InterfaceDef`** + `OntologyRegistry.registerInterface` + `getImplementersOf` + `defineInterface` + `ObjectTypeDef.implements` field unblock + structural-conformance validator | ⏳ blocked | First Solution that wants polymorphic queries (e.g. "all `Mentionable` objects across heterogeneous types"). No live-lesson trigger today — Zod discriminated unions cover the existing polymorphism. | Comparable to ObjectSetDef sliver (~13 commits, ~280–320 tests). |
| **`BoundaryPredicate`** + predicate-scoped `AccessBoundary` (`{slot, where}` entries) + `OntologyRegistry.registerPredicate` + `getPredicate` + named-precondition / named-SetFilter evaluators light up (currently fail-safe stubs) | ⏳ blocked | First Solution that needs per-row read scoping (multi-teacher concurrent sessions in live-lesson, parent-facing UI, or cross-session analytics). | Largest of the three — the boundary-predicate `{op, path, value}` sub-language needs its own walker + validator wiring, and it flips three "named: returns false" stubs (ActionPrecondition, SetFilter, BoundaryPredicate) into real predicate-registry dispatch. |

**Phase 4 will be marked ✅ shipped only after all three slivers have landed.** Today: `1 of 3`.

## Phase 4 — ObjectSetDef sliver commit log

| # | Commit subject | SHA | Notes |
|---|---|---|---|
| 1 | feat: objectsetdef + setfilter + orderclause primitives (phase 4) | `41624a0d` | `src/schema/object-set.ts` — full SetFilter union (12 ops). 13 unit tests. |
| 2 | feat: slottarget 'objectSet' kind unblocked (phase 4) | `8482d648` | `SlotTarget` discriminated union widened. Phase 1 `@ts-expect-error` gate flipped to expect-no-error. |
| 3 | feat: objectsetref branded zod helper (phase 4) | `cf6f34c5` | `objectSetRef()` + `getObjectSetRefTarget()` mirroring `objectRef`. 5 new tests. |
| 4 | feat: defineobjectset helper (phase 4) | `67572c8c` | `src/helpers/define.ts` — passthrough + 3 compile-gate tests. |
| 5 | feat: ontologyregistry registerobjectset + queries (phase 4) | `15ec0c9a` | `registerObjectSet` / `getObjectSet` / `getAllObjectSets` / `getObjectSetsForType` + `validateObjectSetLocal` + `ValidationContext.objectSets`. 10 new tests. |
| 6 | feat: evaluatesetfilter pure function (phase 4) | `c263905a` | Recursive predicate evaluator, dot-path walker, fail-closed numeric comparison. 19 tests. |
| 7 | feat: objectsetdef cross-def validators (phase 4) | `589f22ed` | 3 new ValidationCodes: `OBJECTSET_TARGET_UNRESOLVED`, `OBJECTSET_FIELD_UNRESOLVED`, `OBJECTSET_NAMED_UNSUPPORTED`. SlotTarget `'objectSet'` resolution wired through `validateSlot`. +10 tests. |
| 8 | test: objectsetdef end-to-end integration + typecheck fixes (phase 4) | `b53729f8` | 11 integration cases through the full layer stack (helpers → registry → seal → evaluate). |
| 9 | refactor: address code-review pass 1 (s1 s2 s3 n1 n3 n6) | `ca945bb4` | S1 (digest collision), S2 (boundary fixture), S3 (alloc), N1 (`le/ge` non-numeric), N3 (docblock), N6 (SlotDef import). |
| 10 | docs: phase 4 objectsetdef sliver shipped — progress.md + pass-2 nit | `3a0e5e82` | PROGRESS.md row → 🔵 partial. Pass-2 nit absorbed. |
| 11 | docs: refresh phase 4 sliver final commit sha to 3a0e5e82 | `27360c6d` | Self-reference SHA backfill. |
| 12 | chore: bump harness baselines for pre-existing drift + phase 4 prose | `c2decfd1` | `any_type` 542→549 (2 prose, 5 pre-existing), TODO 17→19 (pre-existing), eslint-disable 59→68 (pre-existing), localhost 21→20 (ratchet down). |
| 13 | docs: refresh phase 4 sliver final sha to c2decfd1 | `779e988a` | Self-reference SHA backfill. |
