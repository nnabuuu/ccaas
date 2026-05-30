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
| 4 — Tier 2 primitives | 🔵 partial — ObjectSetDef shipped | 2026-05-30 | 2026-05-30 (ObjectSetDef) | `c2decfd1` | 12-commit sequence on branch `phase4-objectsetdef-sliver`. ObjectSetDef + SetFilter + OrderClause + SlotTarget objectSet kind + objectSetRef helper + defineObjectSet + OntologyRegistry methods + evaluateSetFilter + cross-def validators + canonical-digest inclusion + integration test all shipped. 285 tests across 21 files (+75 from Phase 1 baseline 210). 2 code-reviewer passes (pass 2 zero must-fix). **InterfaceDef + BoundaryPredicate (other Tier 2 items) stay compile-time-blocked**, await separate triggers. |
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
| `ObjectSetDef` | `solutions/business/live-lesson` | "Struggling students" / "at-risk students" / "stuck students" are computed on every 3s teacher-dashboard poll and used as hardcoded filter sets across handlers + UI. Tier 2 lets these become named, agent-visible subsets the picker can reference (`strugglingStudents`, `atRiskStudents`) without re-spelling the filter at each call site. | Quadrant algorithm: `solutions/business/live-lesson/design/student-quadrant-algorithm.md` + `frontend/src/components/teacher/summary/summary-helpers.ts:computeStudentQuadrants()`. Hardcoded subset: `backend/src/adapters/observer-engine/handlers/status-change-handler.ts:22` (`ALERTABLE_STATUSES = ['stuck', 'struggling', 'idle']`). Dashboard health cards: `design/teacher-dashboard-design.md`. Audited 2026-05-30. |
| `InterfaceDef` | — | No clear cross-type query need today; existing polymorphism handled by Zod discriminated unions (observation kinds, answer-key kinds). Would land when a plugin ecosystem or 3rd-party observation types appear. | live-lesson audit 2026-05-30: present but not load-bearing. |
| `BoundaryPredicate` + predicate-scoped `AccessBoundary` | — | No per-row filtering need today — live-lesson scopes all access by `sessionId`; no `teacherId` / `classId` / `tenantId` axis exists. Triggers: multi-teacher concurrent sessions, parent-facing UI, or cross-session analytics. | live-lesson audit 2026-05-30: no current consumer. |
