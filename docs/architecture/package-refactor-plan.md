# Package Refactor Plan

> Companion to [package-layering.md](./package-layering.md). The analysis identifies three inconsistencies; this doc sequences the concrete refactor moves that resolve them, structured to mirror [`docs/ontology/kedge-ontology-implementation-plan.md`](../ontology/kedge-ontology-implementation-plan.md).
>
> **Independence**: this refactor is orthogonal to the ontology rollout. Either work stream can ship first; they don't gate each other.

---

## 1. Context — why this work, why now

The package count grew from a handful (2024) to 15 (mid-2026). Along the way three structural inconsistencies accumulated (see [layering analysis §3](./package-layering.md#3-the-three-inconsistencies-with-severity)):

1. **HIGH**: 3 packages (`context-layer`, `harness`, `observer-engine`) ship NestJS bindings without `-nest` suffix, forcing every transitive consumer to pull NestJS.
2. **MEDIUM**: `ArtifactEditor` (agent-runtime) and `DocumentEditProvider` (context-layer) implement the same `EditOperation` shape without a shared base contract.
3. **LOW**: Package names (`backend` / `agent-runtime` / `ontology`) suggest false altitude-parallelism.

The proposed `@kedge-agentic/ontology` package is about to land. Codifying the layering convention *before* it ships is the cheapest, most-leveraged step — it ensures the new package is born following the rule.

**Outcome targets**:
- Convention is codified and mechanically enforceable (architecture test, future).
- `context-layer` is split into framework-free core + `-nest` bindings; transitive consumers no longer pay the NestJS install cost just to use `EntityRegistry`.
- The `harness` and `observer-engine` warts are scoped for follow-up, not forgotten.
- `EditOperation` duality is resolved by deliberate decision (documented), not by leaving the question open.

---

## 2. Four-phase refactor

Each phase is independently shippable as one PR. Each has explicit rollback. None blocks the ontology rollout.

### Phase 1 — Codify the convention (docs-only)

**Scope:**

- Add a "Package layering" subsection to [`docs/CONVENTIONS.md`](../CONVENTIONS.md) stating the rule from [layering analysis §2](./package-layering.md#2-the-architectural-convention-we-should-commit-to):
  > A workspace package's main entry point (`src/index.ts`) MUST be framework-free, OR the package name MUST carry a framework suffix (`-react`, `-vue`, `-nest`).
- Update root [`CLAUDE.md`](../../CLAUDE.md)'s Package Overview table to add a "Framework coupling" column. One word per row (`none` / `NestJS` / `React` / `Vue` / etc.) — surfaces the convention in the most-read doc.
- Add a "See also" cross-link from [ADR-0001](../adr/0001-core-must-not-contain-domain-entities.md) to the layering analysis doc. The new convention extends ADR-0001's lean-core principle to the broader package set.
- Add a one-line pointer from [`docs/ontology/kedge-ontology-design.md`](../ontology/kedge-ontology-design.md) §1.5 to the layering analysis, explaining why the ontology package is framework-free.

**Out of scope:** Any code changes. Any package renames. Any package splits.

**Exit criteria:**

- `docs/CONVENTIONS.md` "Package layering" section exists and is ≤1 page.
- Root CLAUDE.md table has the "Framework coupling" column populated for all 15 packages.
- Cross-links resolve (path-check each one).
- `git diff packages/ solutions/` is empty (no source code touched).

**Risk:** Zero. Pure documentation.

**Rollback:** Revert the PR; no consumer impact.

**Cost:** 1 PR, ~1 hour of work. Should land first.

---

### Phase 2 — Split `@kedge-agentic/context-layer` into core + `-nest`

The biggest real fix. Resolves [inconsistency #1](./package-layering.md#31-inconsistency-1--nestjs-coupling-in-foundation-packages-high-severity) for the highest-leverage package.

**Scope:**

Create two packages from the current one:

- **`@kedge-agentic/context-layer-core`** (new, framework-free):
  - `src/core/entity-registry.ts` — `EntityRegistry` class
  - `src/core/document-edit-provider.ts` — `DocumentEditProvider` abstract base
  - `src/core/interfaces.ts` — `EntityContextProvider`, `EditOperation`, `EditResult`, `AtReference`, `EntityContext`, `ReferenceableOptions`, `RelationInfo`, all the response/recommend types
  - `package.json`: `dependencies: { "@kedge-agentic/entity-document": "^0.1.0" }`, no peerDeps, no NestJS imports anywhere in source.

- **`@kedge-agentic/context-layer-nest`** (new, NestJS bindings):
  - `src/context-layer.module.ts` — `ContextLayerModule.forRoot()`
  - `src/decorators/referenceable.decorator.ts` — `@Referenceable`
  - `src/decorators/tracked.decorator.ts` — `@Tracked`
  - `src/controllers/context-layer.controller.ts` — the 7 REST endpoints
  - `src/services/*` — `ActivityEmitter`, `RecommendEngine`, `ContextInjector`, `ShortcutManager`, `RelationInferrer`
  - `package.json`: `dependencies: { "@kedge-agentic/context-layer-core": "^0.1.0" }`, `peerDependencies: { "@nestjs/common", "@nestjs/core", "class-validator", "class-transformer", "reflect-metadata" }`.

- **Deprecation strategy**: `@kedge-agentic/context-layer` (the old package) becomes a thin re-export wrapper for one minor version, then is removed. Its `src/index.ts` becomes:
  ```ts
  // Deprecated — split into context-layer-core + context-layer-nest in v0.2.0. Remove in v0.3.0.
  export * from '@kedge-agentic/context-layer-core';
  export * from '@kedge-agentic/context-layer-nest';
  ```
  Consumers can migrate their import paths at leisure.

**Consumer impact:**

- `packages/backend/` — confirmed via audit: does NOT import `context-layer`. Zero changes.
- `packages/context-layer-react/` — imports `context-layer`. Update to `context-layer-core` (it only consumes the framework-free types).
- `solutions/business/recipe-book/` — primary test consumer. Updates: `import` paths from `@kedge-agentic/context-layer` → `@kedge-agentic/context-layer-core` (for `EntityRegistry`, `DocumentEditProvider`) and `@kedge-agentic/context-layer-nest` (for `ContextLayerModule`, `@Referenceable`). Estimated ~10-15 import-line changes.
- `solutions/business/live-lesson/` — verify whether it imports context-layer directly (likely no, per audit) or transitively via context-layer-react (yes). If direct imports exist, same treatment as recipe-book.

**Out of scope:**

- Refactoring the internal logic of any class. Pure file moves + package metadata changes.
- Touching `context-layer-react` beyond the import path update.
- Any change to context-layer's external contracts (interfaces stay identical).

**Exit criteria:**

- `npm test` from the repo root green.
- Recipe-book test suite green (it's the parity benchmark).
- Live-lesson backend `npm test` green; live-lesson e2e (15 specs) green.
- `npm run typecheck` from the repo root green.
- `@kedge-agentic/context-layer-core/package.json` has no NestJS entries in `dependencies` or `peerDependencies`.
- `@kedge-agentic/context-layer-core/src/**/*.ts` has no `@nestjs/*` imports (grep verifiable).
- The deprecated re-export wrapper at `@kedge-agentic/context-layer` still works for one minor version (consumers using old paths see a deprecation warning but don't break).

**Risk:** Medium. Touches a shared package with at least 2 known consumers. Mitigated by:
- **Parity snapshots**: before the move, snapshot `EntityRegistry.getEntityTypes()` output for recipe-book; assert byte-equality post-move.
- **Single-PR atomicity**: split + consumer updates in one PR; either all goes green or all reverts together.
- **Deprecation wrapper buys time**: any consumer we forgot can keep working until v0.3.0.

**Rollback:** Revert the PR. Re-export wrapper means consumers don't break even if we revert mid-migration; they just keep using the old import paths.

**Cost:** 1 PR, moderate (~300 LOC moved between packages, ~10-15 import updates). 1-2 days of work including verification.

**Status note:** This phase's exit criteria match the layering analysis's verification §7 — "Refactor plan Phase 2 has a parity test." The parity snapshot is the verifiable exit criterion, not aspirational.

---

### Phase 3 — Decide and act on the `EditOperation` duality (light touch)

Resolves [inconsistency #2](./package-layering.md#32-inconsistency-2--two-unrelated-editor-abstractions-medium-severity). Two options exist; recommendation is the light one.

**Recommended option — A (documentation-only)**

**Scope:**

Add a subsection to `docs/CONVENTIONS.md` (in the Package layering section from Phase 1) titled "Editor abstractions are intentionally per-altitude". Body:

> The codebase has two editor abstractions: `ArtifactEditor<T>` (in `@kedge-agentic/agent-runtime`, artifact-level, in-memory) and `DocumentEditProvider` (in `@kedge-agentic/context-layer-core`, entity-level, load-edit-save). They share an `EditOperation` discriminated union shape but are NOT polymorphic — they operate at different abstraction altitudes.
>
> If you need a third editor, evaluate which altitude it belongs to:
> - **Artifact-level** (you have an in-memory object/document and want to apply ops to it) → implement `ArtifactEditor<T>`.
> - **Entity-level** (you have an ID and want load+edit+save round-trip) → extend `DocumentEditProvider`.
>
> Do NOT introduce a third sibling without revisiting this decision; the proliferation of editor abstractions is the failure mode this convention prevents.

**Out of scope:** Any code change. Any shared base interface.

**Exit criteria:**

- Subsection lands in CONVENTIONS.md.
- A search for "editor" in the design docs finds this guidance.

**Risk:** Zero. Documentation only.

**Rollback:** Revert.

**Cost:** 1 PR, ~30 min, can fold into Phase 1's PR.

**Alternative — Option B (consolidate, heavy touch)** — *not recommended unless a third editor is in flight*:

Introduce `@kedge-agentic/edit-protocol` (tiny new package) with `EditOperation` union + `Editor<T>` interface. Refactor both `JsonEditProvider` and `DocumentEditProvider` to declare `implements Editor<T>`. The two existing editors keep their internal logic; only the type-level relationship changes.

Reject this option for now because: no third editor is on the horizon; the two existing editors have lived comfortably with separate abstractions; introducing a new shared package adds review/version-bump burden for marginal benefit.

**Promotion criterion**: revisit Option B if a third editor is proposed in design. Don't pre-build the abstraction.

---

### Phase 4 — DEFERRED: `agent-runtime` rename

Resolves [inconsistency #3](./package-layering.md#33-inconsistency-3--package-names-suggest-false-parallelism-low-severity-cosmetic). Recommended action: **don't do this**; mitigate via README clarity instead.

**Why deferred:**

- The package name appears in 20+ files in `packages/backend/` alone (per audit).
- Also referenced in gitbook (`docs/gitbook/zh/platform/runtime-architecture.md`), root CLAUDE.md, ADR-0001-adjacent text, package.json files of consumers.
- Renaming is mechanical (find/replace) but high-touch.
- Benefit is purely cosmetic — the name doesn't actually break anything.

**Mitigation instead** (do this in Phase 1's PR):

Add a one-paragraph "Scope" section at the top of `packages/agent-runtime/README.md` (if not already there) making explicit:

> `@kedge-agentic/agent-runtime` is the *filesystem and artifact sync layer*. It is not a general "agent runtime" — it doesn't run agents, doesn't manage sessions, doesn't bridge to MCP servers. It provides `BaseMaterializer` (project DB-stored skills to a workspace overlay) and `SyncEngine` (deterministic bidirectional sync between agent-written files and Solution-owned data). For session lifecycle, see `packages/backend/src/sessions/`; for the agent process itself, see `packages/backend/src/chat/`.

**Cost:** ~10 minutes, folded into Phase 1's PR.

**When to reopen the rename question:** If a future package introduction creates a third "runtime"-named package, the ambiguity will start to bite. At that point the rename earns its cost.

---

## 3. Breaking-change inventory

| Phase | What breaks for downstream | Required action |
|---|---|---|
| 1 | Nothing — docs-only | None |
| 2 | `@kedge-agentic/context-layer` is deprecated; consumers should migrate imports to `-core` and `-nest`. The old package keeps working for one minor version. | Migrate import paths at leisure; deprecation warning visible from v0.2.0 to v0.3.0 |
| 3 | Nothing — docs-only (Option A recommended) | None |
| 4 | N/A — deferred | N/A |

**Zero hard breaking changes across all phases.** Phase 2 introduces a deprecation that consumers can migrate at their own pace.

---

## 4. Test strategy

### Phase 1 (docs)

- Manual review: convention reads as enforceable; cross-links resolve.

### Phase 2 (context-layer split)

- **Parity snapshot**: before the split, run recipe-book backend tests; capture `EntityRegistry.getEntityTypes()` output as JSON; assert byte-equality post-split.
- **Build integrity**: `npm run build:libs` from repo root completes; `@kedge-agentic/context-layer-core` + `@kedge-agentic/context-layer-nest` both emit `.d.ts`.
- **Recipe-book end-to-end**: full test suite green (this is the primary consumer-side test).
- **Live-lesson end-to-end**: 15 specs in `solutions/business/live-lesson/e2e/specs/` green.
- **Type-purity test**: `grep -rE "from '@nestjs" packages/context-layer-core/src/` returns zero matches.
- **Deprecation-wrapper test**: a synthetic test imports from `@kedge-agentic/context-layer` (the old path); types resolve correctly to the new packages' exports.

### Phase 3 (documentation)

- Manual review: subsection lands and is discoverable from the package READMEs.

### Phase 4 (deferred — no test plan needed yet)

---

## 5. Sequencing notes

### 5.1 PR shape

- **Phase 1**: one PR, docs-only. ~1 hour work, can land same day.
- **Phase 2**: one PR, split + all consumer updates atomic. 1-2 days work. Lands after Phase 1.
- **Phase 3**: folded into Phase 1's PR (it's a CONVENTIONS.md addition; same target file).
- **Phase 4**: deferred indefinitely; README clarification folded into Phase 1's PR.

### 5.2 Dependency order

```
Phase 1 (convention + READMEs + cross-links)
   │  [no blockers]
   │
   ├──> Phase 2 (context-layer split)
   │       [depends on Phase 1 conceptually; Phase 1's convention is what Phase 2 implements]
   │
   ├──> [followup, not yet planned]
   │       harness + observer-engine audit:
   │       (a) audit class-level coupling — are these like context-layer (mixed)
   │           or framework-coupled throughout (just need rename)?
   │       (b) execute: rename to `-nest` OR split like context-layer.
   │       Out of scope for this plan, but flagged.
   │
   └──> Ontology rollout (see docs/ontology/kedge-ontology-implementation-plan.md)
           [INDEPENDENT — can ship before, after, or in parallel with Phase 2]
```

### 5.3 Rollback story per phase

- **Phase 1**: revert PR. No consumer impact.
- **Phase 2**: revert PR. Deprecation wrapper at `@kedge-agentic/context-layer` means consumers still on old import paths keep working even mid-revert.
- **Phase 3**: revert PR. No consumer impact.

### 5.4 What's deliberately deferred

- **Renaming `agent-runtime` → `workspace-sync`**: see Phase 4. Cosmetic; cost outweighs benefit.
- **Auditing + splitting `harness` and `observer-engine`**: known to share the same pattern as `context-layer`. Lower consumer-surface impact (smaller transitive footprint). Scope as separate followup.
- **Introducing `@kedge-agentic/edit-protocol`**: only if a third editor emerges (Phase 3 Option B).
- **Architecture-test linting**: the convention is mechanically testable, but the lint rule itself is a separate work item. Could live in a new `packages/architecture-tests/` or be folded into existing harness checks.
- **Renaming `context-layer` → `context-layer-core`** as the *primary* name (vs keeping the deprecated re-export). Defer until v0.3.0 when the deprecation period expires. Or, longer-term, keep the re-export indefinitely for backwards compat.

---

## 6. Operational checklist before each phase ships

Per [`CLAUDE.md`](../../CLAUDE.md) post-implementation checklist:

1. **Tests**: Phase 1 — no tests (docs-only); Phase 2 — `cd packages/context-layer-core && npm test` + `cd packages/context-layer-nest && npm test` + recipe-book test suite + live-lesson e2e.
2. **Code review**: `code-reviewer` agent on every file in the diff (for Phase 2; trivial for Phase 1/3).
3. **Harness**: `bash scripts/harness-checks.sh`.
4. **Architecture rule verification** (Phase 2 specifically): grep for `@nestjs` imports in `packages/context-layer-core/src/`; must return zero. This is the load-bearing assertion that the split actually achieved framework-freeness.

---

## 7. Open implementation questions

Non-blocking; resolve during build:

1. **Should the `@kedge-agentic/context-layer` deprecation wrapper warn at import time?** Options: (a) silent re-export (lowest friction); (b) `console.warn` in dev (visible reminder); (c) compile-time deprecation comment only (TS shows the strikethrough in IDEs). Recommendation: (c) — IDE strikethrough is enough to nudge migration without runtime noise.

2. **Where does the future architecture-test live?** Options: (a) new `packages/architecture-tests/` workspace package; (b) folded into `bash scripts/harness-checks.sh`; (c) as a CI-only check in `.github/workflows/`. Recommendation: (b) for now (no new package overhead), promote to (a) if the test surface grows.

3. **Phase 2 numbering**: does `@kedge-agentic/context-layer-core` start at version `0.1.0` (fresh) or `0.2.0` (continuing the existing context-layer version line)? Recommendation: `0.2.0` — the split is an evolution, not a fresh start. This also signals to consumers that "0.2.0" is the post-split version everywhere.

---

> **Maintainer's note**: this plan is the executable companion to [package-layering.md](./package-layering.md). When a phase ships, mark its section in this doc with "✓ shipped in PR #N" and update the [layering analysis](./package-layering.md) §3 inconsistency table with the resolved status. Phases beyond Phase 2 are conditional or deferred; reopen by editing this doc rather than starting a new plan.
