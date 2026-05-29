# Package Layering — Empirical Audit and Conventions

> Authoritative analysis of how the 15 packages in `packages/` actually layer onto each other. Sister doc: [package-refactor-plan.md](./package-refactor-plan.md) — the concrete refactor moves derived from this analysis.
>
> **Why this exists**: as the package count grew (from a handful of foundational pieces in 2024 to 15 packages by mid-2026), the abstraction altitudes drifted apart without a unifying rule. Three packages now ship NestJS bindings without flagging the coupling in their name. A new `@kedge-agentic/ontology` package (designed in `docs/ontology/`) is about to land, and this is the right moment to codify the layering rule it should follow.
>
> **Audience**: engineers who maintain the package layout and reviewers of new packages.

---

## 1. Empirical layer inventory

15 packages exist under `packages/`. Their actual framework coupling, derived from `package.json` `dependencies` + `peerDependencies`:

### 1.1 Foundation layer — framework-free contracts + mechanisms

These are the packages every consumer touches. The convention §2 proposes applies most strictly here.

| Package | Version | Deps | PeerDeps | Coupling verdict | Primary scope |
|---|---|---|---|---|---|
| `@kedge-agentic/common` | 0.2.0 | `zod`, `uuid` | none | **None** | Shared types + Zod event schemas |
| `@kedge-agentic/entity-document` | 0.1.0 | none | none | **None (zero-dep)** | Markdown ↔ block document transforms |
| `@kedge-agentic/agent-runtime` | 0.4.0 | none | none | **None (zero-dep)** | Filesystem/artifact sync mechanism |
| `@kedge-agentic/ontology` *(proposed)* | (unbuilt) | `zod`, `zod-to-json-schema` | none | **None (designed)** | Schema + governance contract layer |
| `@kedge-agentic/context-layer` | 0.1.0 | `entity-document` | **`@nestjs/common`, `@nestjs/core`, class-validator, class-transformer, reflect-metadata** | ⚠ **NestJS-coupled in main entry** | Entity registry + @Picker backing + NestJS Module |

The wart: `context-layer` ships the framework-free `EntityRegistry` / `EntityContextProvider` / `DocumentEditProvider` interfaces *and* the NestJS Module / decorators / controllers from the same `src/index.ts`. Anyone who wants to consume the interfaces also pulls NestJS into their dependency graph transitively. See §3-#1.

### 1.2 Framework-binding packages — explicitly suffixed (the good pattern)

These do exactly what their name says: they bind a framework-free core to a specific framework. The suffix is part of the convention.

| Package | Version | PeerDeps | Wraps | Notes |
|---|---|---|---|---|
| `@kedge-agentic/context-layer-react` | 0.1.0 | `context-layer`, `react`, `react-dom` | context-layer | ✓ The reference example for how to split |
| `@kedge-agentic/react-sdk` | 0.2.0 | `react`, `@tanstack/react-query` | (HTTP client, not a wrapper) | React hooks for ccaas backend |
| `@kedge-agentic/vue-sdk` | 0.3.0 | `vue` | (HTTP client) | Vue composables |
| `@kedge-agentic/chat-interface` | 0.2.0 | `react`, `react-markdown`, `lucide-react` | (UI library) | Extensible chat UI components |

The `-react`/`-sdk` suffixes signal "I am framework-coupled; consume me only if you're in that framework." This convention exists; it's just not consistently applied (see §3).

### 1.3 NestJS-coupled packages without `-nest` suffix — the broader wart

`context-layer` is not alone. Two other packages also peerDepend on NestJS but don't flag it in their name:

| Package | Version | NestJS peerDeps | Same issue as context-layer? |
|---|---|---|---|
| `@kedge-agentic/harness` | 0.1.0 | `@nestjs/common`, `@nestjs/core`, `@nestjs/swagger` | **Yes** — "Harness orchestration framework for iterative agent tasks" |
| `@kedge-agentic/observer-engine` | 0.1.0 | `@nestjs/common`, `@nestjs/core`, `@nestjs/typeorm` | **Yes** — "Event/Observer engine: dispatch events, execute handlers" |

Both are smaller than context-layer (lower consumer-surface impact), but both violate the same proposed convention. The refactor plan addresses context-layer first (highest leverage) and flags these two for follow-up.

### 1.4 Application + experimental + non-workspace packages

| Package | Coupling | Notes |
|---|---|---|
| `@kedge-agentic/backend` | NestJS app | It *is* the NestJS service. Name is honest. |
| `@kedge-agentic/admin-next` | React + Refine + Radix UI | Admin dashboard app |
| `@kedge-agentic/exercise-preview` | Effectively none (1 dep) | "Preview platform for exercise type plugins — CLI sandbox, Admin Playground" |
| `@kedge-agentic/vfs-poc` | Zero-dep | **Explicitly an archive**: package.json description says "Design + validation archive… Production code lives in `packages/backend/src/sessions/{workspace,sandbox}/`." Kept as historical reference. |
| `packages/mcp/` (folder) | n/a — not a workspace package | Contains 4 standalone MCP-server subprocesses (`attach-file-server`, `rest-adapter-bridge`, `shared-context-server`, `tool-caller-proxy-server`) — each with its own package.json. Spawned as child processes by the backend. |

These are leaves — they consume the foundation but nothing consumes them transitively. The layering rule still applies to their structure, but their impact on the dependency graph is small.

---

## 2. The architectural convention we should commit to

> ### Convention
>
> **A workspace package's main entry point (`src/index.ts`) MUST be framework-free, OR the package name MUST carry a framework suffix (`-react`, `-vue`, `-nest`).**

Three reasons this rule matters:

1. **Cross-process portability**: Agent processes (Claude Code, OpenCode subprocesses spawned by the backend) consume schemas, types, and contracts from foundation packages. Pulling NestJS into an agent subprocess via a transitive peerDep is a 50 MB+ install footprint penalty for no benefit — the agent doesn't run inside NestJS.

2. **Testability without framework boot**: A framework-free package can be unit-tested in milliseconds; a NestJS-coupled package needs DI container setup, module compilation, and lifecycle wiring. Mixing both in one package forces every test to pay the framework cost.

3. **Honest naming**: When a consumer reads `import { EntityRegistry } from '@kedge-agentic/context-layer'`, they reasonably expect "this is a registry I can use anywhere." Discovering at runtime that pulling this name in transitively requires `reflect-metadata`/`class-transformer` is a trust-erosion event. The suffix makes the constraint visible at the import site.

**The rule is testable.** A future `packages/architecture-tests/` package (or an existing harness) can lint every workspace package's `package.json` and assert that any package with NestJS/React/Vue in `dependencies` or `peerDependencies` has the matching suffix. The convention is mechanically enforceable, not just aspirational.

**Precedent**: `@kedge-agentic/context-layer-react` already follows this rule. The split was made when React bindings were added; the same split should retroactively be made for NestJS bindings.

**Citation lineage**: this convention extends [ADR-0001](../adr/0001-core-must-not-contain-domain-entities.md)'s lean-core principle. ADR-0001 said "core backend must be infrastructure-only, no domain entities." This convention says "foundation packages must be framework-free, no framework lock-in." Same spirit, different scope.

---

## 3. The three inconsistencies, with severity

### 3.1 Inconsistency #1 — NestJS coupling in foundation packages (HIGH severity)

**What's wrong:** `context-layer`, `harness`, and `observer-engine` all peerDepend on `@nestjs/common` + `@nestjs/core` but their names contain no framework suffix. Their `src/index.ts` files ship both framework-free abstractions and NestJS-specific bindings (Module / decorators / controllers) at the same import path.

**Why High severity:**

- It compounds. Every new package that depends on one of these inherits the NestJS coupling. `context-layer-react` already pays this cost (React app pulls NestJS transitively to use the picker). A future `context-layer-vue` would too.
- It makes the foundation layer non-uniform. Engineers reading the package list have to remember "framework-free except for these three" — that's the kind of carve-out that gets violated by the next contributor.
- The fix is mechanical and well-precedented (`-react` suffix exists). Putting it off makes the eventual split bigger.

**Concrete impact:**

- `context-layer`'s `EntityRegistry` is conceptually framework-free (audited: pure TS class with no NestJS imports in the class itself) — but consumers can't get it without the NestJS dependency graph.
- `harness` and `observer-engine` may be NestJS-coupled *throughout* (not yet audited at the class level), in which case the fix is just adding `-nest` to their names; or they may also mix levels like context-layer does, in which case they need full splits. Phase 2 of the refactor scopes to context-layer; harness/observer-engine get a separate scoping pass.

### 3.2 Inconsistency #2 — Two unrelated "editor" abstractions (MEDIUM severity)

**What's wrong:** Two packages define an "edit a thing" abstraction with overlapping vocabulary but no shared base contract:

- `@kedge-agentic/agent-runtime` exports `ArtifactEditor<T>` — artifact-level, in-memory edits, `JsonEditProvider` is the concrete impl. Edit ops: `field_set`, `json_patch`, `replace`.
- `@kedge-agentic/context-layer` exports `DocumentEditProvider` — entity-level, load-edit-save, abstract base. Edit ops: `field_set`, `str_replace`. Implements via `entity-document` block serialization.

Both implement an `EditOperation` discriminated union (with overlapping cases). Neither implements an `Editor<T>` interface that would let a generic consumer treat them polymorphically.

**Why Medium (not High):**

- They've coexisted for months without observable harm. The gap is conceptual, not operational.
- Use cases are genuinely different — `ArtifactEditor` operates on in-memory JSON parsed from a file; `DocumentEditProvider` operates on entity rows in a database round-tripped through Markdown. Forcing a shared base risks awkward generalization.
- However: a hypothetical "schema editor" or "config editor" would belong in either bucket. Without a shared contract, each new editor picks one of two paths and the divergence grows.

**Two paths, light vs heavy** — the refactor plan recommends the light one (document the divergence; don't force unification) unless a third editor is on the horizon. See refactor plan Phase 3.

### 3.3 Inconsistency #3 — Package names suggest false parallelism (LOW severity, cosmetic)

**What's wrong:** When the user described the layout as "ccaas-core (agent execution), ontology (business model), agent-runtime (runtime)" — three names that *sound* parallel — the actual packages are at completely different altitudes:

- `backend` (the user's "ccaas-core") is a NestJS application, not a "core abstraction layer." It owns the request lifecycle, HTTP routes, TypeORM adapters, and process management.
- `agent-runtime` is specifically the *filesystem-sync* layer (per its zero-dep + sync-engine scope). It's not "the runtime" in any broader sense — it doesn't run agents, doesn't manage sessions, doesn't bridge to MCP.
- `ontology` (proposed) is a schema + governance contract layer.

The names create a mental image of three peer-level "core / business model / runtime" boxes. Reality is more like:

```
backend (NestJS app + integration adapters)
   uses → agent-runtime (filesystem sync mechanism)
   uses → ontology (schema contract)              [proposed]
   does NOT use → context-layer (which is solution-side picker infra)
```

`backend` consumes the others; the others don't talk to each other. The naming doesn't reveal that hierarchy.

**Why Low:** the names are honest internally — `agent-runtime` accurately describes what's inside it once you read the README. The mismatch only bites at first encounter. A README pass on `agent-runtime` to make the scope obvious in the first paragraph is enough to mitigate.

**Why we shouldn't rename:** the package is referenced in 20+ files in `backend/` alone, plus gitbook, plus root CLAUDE.md, plus ADRs. The rename would touch every one of those. The cost is mechanical but high; the benefit is cosmetic. Refactor plan defers this indefinitely.

---

## 4. Ideal-state package map

After Phase 1+2 of the refactor plan land (convention codified, context-layer split), the foundation layer looks like:

```
shared contracts (framework-free)
├── @kedge-agentic/common              types + Zod event schemas
├── @kedge-agentic/entity-document     document block transforms
├── @kedge-agentic/agent-runtime       filesystem sync mechanism
├── @kedge-agentic/ontology            schema + governance contract  [new]
└── @kedge-agentic/context-layer-core  entity registry + edit providers [renamed/split]

framework bindings (suffix-flagged)
├── @kedge-agentic/context-layer-react React Picker UI
├── @kedge-agentic/context-layer-nest  NestJS Module + decorators + controllers [new]
├── @kedge-agentic/react-sdk           React hooks for backend
├── @kedge-agentic/vue-sdk             Vue composables for backend
└── @kedge-agentic/chat-interface      React chat UI library

NestJS-coupled (suffix-pending fix in follow-up)
├── @kedge-agentic/harness             → likely rename to harness-nest
└── @kedge-agentic/observer-engine     → likely rename to observer-engine-nest

application + experimental
├── @kedge-agentic/backend             the NestJS service
├── @kedge-agentic/admin-next          React admin dashboard
├── @kedge-agentic/exercise-preview    preview platform
└── @kedge-agentic/vfs-poc             archive (kept for history)

non-workspace
└── packages/mcp/*                     4 standalone MCP-server subprocesses
```

The rule that distinguishes layers is mechanical: shared-contract packages have zero (or zod-only) deps; framework-binding packages have framework name in their suffix; applications are leaves.

---

## 5. What we are intentionally NOT changing

Naming explicit non-goals catches scope creep at the planning stage. The following are *not* being addressed by this analysis or the companion refactor plan:

1. **`@kedge-agentic/backend` is not being renamed or split.** It's a NestJS application that holds the request lifecycle, TypeORM adapters, and integration glue. The name accurately reflects what's inside.

2. **`@kedge-agentic/entity-document`'s scope is not being broadened.** It does document transforms; it should keep doing only that. The "two editor abstractions" inconsistency (§3.2) does NOT lead to a recommendation that `DocumentEditProvider` move into `entity-document`.

3. **The proposed `@kedge-agentic/ontology` design (in `docs/ontology/`) is unchanged.** It already follows the convention (designed as framework-free). The bridge code that wires it into NestJS lives in `packages/backend/src/ontology/`, mirroring how `packages/backend/src/sessions/agent-runtime/` bridges agent-runtime into NestJS. That pattern is correct as-is.

4. **`@kedge-agentic/vfs-poc` stays as an archive package.** Its `package.json` description explicitly says production code lives elsewhere. Removing the package would lose the design history; keeping it is the right call.

5. **Solutions in `solutions/business/*` are not being touched.** Solution backends own their own architecture per ADR-0001. The recommendations here are about `packages/`, not solutions.

6. **The `mcp/` subprocesses are not being repackaged as workspace packages.** They're deployed as standalone executables; the workspace doesn't need to know about them at the dependency level.

7. **No rename of `agent-runtime`** (per §3.3). Cost-benefit doesn't justify; README clarification is the proportionate fix.

---

## 6. Relationship to the proposed ontology rollout

The 5-phase ontology rollout (see `docs/ontology/kedge-ontology-implementation-plan.md`) is **independent** of the refactor plan derived from this analysis. Concretely:

- Ontology Phase 1 (bootstrap `@kedge-agentic/ontology` v0.1) does not touch context-layer.
- Ontology Phase 2 (refactor `context-layer` to consume ontology) DOES touch context-layer — but as a code-internal change, not a package-split change. It can run before, after, or in parallel with the refactor plan's Phase 2 (context-layer split).
- Ontology Phase 3+4+5 are gated on Chengdu PoC / Solution demand / promotion criteria; they don't depend on the package split at all.

If both work streams land, context-layer ends up with both: an internal refactor (consuming ontology primitives) and a package split (separating NestJS bindings). These are independently revertible.

The architecture refactor plan's Phase 1 (codify the convention) should ideally land **before** ontology Phase 1, so the new package is born following the rule — but if ontology Phase 1 ships first, no harm done; the design already conforms.

---

## 7. Open questions for the maintainer

Items this analysis surfaced that don't have a single right answer:

1. **Should `harness` and `observer-engine` be audited at the class level for mixed-altitude, or just renamed to `-nest`?** A renaming-only fix is cheap but doesn't fix any actual coupling problem if the packages are NestJS-coupled throughout (in which case the suffix is just honest labeling). A full split, like context-layer's, is more work but produces a framework-free core that other code could consume. Recommendation: audit before deciding. Default to rename-only unless the audit finds extractable framework-free abstractions.

2. **Is `exercise-preview` actually a foundation package, an application, or something else?** Its 1-dependency, zero-peerDep profile suggests foundation; its description ("preview platform for exercise type plugins — CLI sandbox, Admin Playground, public demo") suggests application. The label affects whether it needs to follow the §2 convention. Recommendation: ask the package owner.

3. **Does `packages/mcp/` belong in `packages/` at all?** It contains executable subprocesses, not workspace packages. Other repos handle this with a top-level `services/` or `bin/` directory. Recommendation: leave as-is for now (low-impact), but document the convention so future contributors know which folder is for what.

4. **The §3.2 editor-duality question.** Pick light-touch (document divergence) or heavy-touch (consolidate via shared base). The refactor plan recommends light; revisit when a third editor appears.

---

> **Maintainer's note**: this doc is the source-of-truth for the layering convention. New packages added without a `-react`/`-vue`/`-nest` suffix MUST be framework-free in their main entry point. Audit periodically by `grep -l '@nestjs\|react\|vue' packages/*/package.json`; any hit on a non-suffixed package is a candidate for refactor or rename.
