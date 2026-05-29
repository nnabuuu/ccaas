# kedge-ontology — Implementation Progress

> Status tracker for the 5 phases in [kedge-ontology-implementation-plan.md](./kedge-ontology-implementation-plan.md).
> Updated as work lands. Spec lives in the impl plan; this doc tracks status only.

Status emoji legend: 🔵 in progress · ✅ shipped · ⏳ waiting · ❌ blocked / failed · ⏸ paused.

## Phase status

| Phase | Status | Started | Shipped | Final commit | Notes |
|---|---|---|---|---|---|
| 1 — Bootstrap v0.1 (core + Tier 1) | 🔵 in progress | 2026-05-29 | — | — | 10-commit sequence in single PR; see commit log below |
| 2 — context-layer refactor | ⏳ waiting | — | — | — | Blocked on Phase 1 |
| 3 — live-lesson + bridge | ⏳ waiting | — | — | — | Gated on Chengdu PoC having shipped (per impl plan §B-Phase 3) |
| 4 — Tier 2 primitives | ⏳ waiting | — | — | — | Gated on a real Solution expressing need for at least one Tier 2 primitive |
| 5 — Tier 3 primitives | ⏳ waiting | — | — | — | Per-item gated on individual promotion criteria |

## Phase 1 commit log

Within Phase 1's single PR, work is broken into 10 incremental commits, one per module subdirectory. Each row gets its SHA filled in as the commit lands.

| # | Commit subject | SHA | Notes |
|---|---|---|---|
| 1 | feat(ontology): phase 1 commit 1 — package skeleton + PROGRESS.md seed | _pending_ | package.json / tsconfig.json / vitest.config.ts / README.md / src/index.ts stub / src/__tests__/architecture.test.ts smoke. Root package.json wires `build:ontology` into `build:libs`. |
| 2 | feat(ontology): phase 1 commit 2 — schema primitives | _pending_ | `src/schema/*` — LocalizedString, PropertyMeta, zod-helpers (objectRef), LinkDef, ActionDef + ActionPrecondition, FunctionDef, ObjectTypeDef, StreamDef + tests |
| 3 | feat(ontology): phase 1 commit 3 — manifest primitives | _pending_ | `src/manifest/*` — SlotDef, StateDef, AccessBoundary, LifecycleDef, ManifestDef + integration test |
| 4 | feat(ontology): phase 1 commit 4 — accessor types + checkBoundary | _pending_ | `src/accessor/*` — ManifestAccessor, ActionResult, BoundaryDecision, checkBoundary (handles Tier 1 preconditions; named-predicates stubbed for Phase 4) |
| 5 | feat(ontology): phase 1 commit 5 — define helpers | _pending_ | `src/helpers/define.ts` — defineObjectType, defineAction, defineFunction, defineManifest, defineStateField (type-narrowing passthroughs) |
| 6 | feat(ontology): phase 1 commit 6 — validators | _pending_ | `src/schema/validators.ts` — Tier 1 rule suite + RegistrationError |
| 7 | feat(ontology): phase 1 commit 7 — registry | _pending_ | `src/registry/*` — OntologyRegistry class with v0.1 methods |
| 8 | feat(ontology): phase 1 commit 8 — distribution | _pending_ | `src/distribution/*` — serializeRegistry + computeSchemaDigest |
| 9 | feat(ontology): phase 1 commit 9 — semantic projection | _pending_ | `src/semantic/*` — projectManifest + three format adapters (anthropic-tools, mcp-tools, system-prompt) |
| 10 | feat(ontology): phase 1 commit 10 — architecture test + final wiring | _pending_ | Full architecture test, root index.ts re-exports, README "Phase 1 complete", PROGRESS.md → ✅ |

## Decisions log

Decisions made during implementation that diverge from or refine the spec/impl-plan. Each entry references the commit that introduced the divergence.

- **2026-05-29, commit 1**: Adopted subpath exports (`@kedge-agentic/ontology/schema`, etc.) matching `agent-runtime`'s pattern, instead of the single-root-`index.ts` re-export described in design spec §2.1. Rationale: consistency with sibling framework-free packages + cleaner consumer imports + better tree-shaking. Catch-all root still exists for convenience.
- **2026-05-29, commit 1**: `AccessBoundary.readable`/`.writable` will ship as `readonly string[]` in Phase 1, not the `BoundaryPathEntry` union shape (`string | { slot, where }`) from design spec §4.4. The union with predicate entries lands in Phase 4 alongside `BoundaryPredicate`. Forward-compatible: callers passing plain strings today work unchanged when the union lands.
- **2026-05-29, commit 1**: Root `package.json` modified (added `build:ontology` script + chained into `build:libs`) — minor scope expansion vs the impl plan's "no file outside packages/ontology/" exit criterion. Necessary to meet the "build:libs includes ontology" exit criterion.
