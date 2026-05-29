# `@kedge-agentic/ontology`

Schema + governance contract layer for kedge-ccaas agentic services.

> **Status: Phase 1 shipped (v0.1.0).** Core primitives + Tier 1 are live. Tier 2/3 primitives compile-time-blocked. See [Implementation Progress](../../docs/ontology/PROGRESS.md) for the full commit log and what's deferred to Phases 2–5.

## What's in this package

Framework-free TypeScript primitives for describing:

- **`ObjectTypeDef`** — typed business objects (LessonPlan, Student, Resource) defined by a Zod schema + sidecar metadata
- **`ActionDef`** / **`FunctionDef`** — governed write operations + pure read computations
- **`ManifestDef`** — composed operational contexts: which objects are in scope, what runtime state exists, who can see/do what
- **`AccessBoundary`** — per-role declarations of what's readable / writable / actionable
- **`OntologyRegistry`** — runtime registry + validator + schema digest for distribution
- **Semantic projection** — render registered schemas as Anthropic tool-use / MCP / system-prompt formats for LLM consumption

The Zod schema attached to each `ObjectTypeDef` and `ActionDef` is the source of truth for field shapes; the `PropertyMeta` sidecar carries only governance + presentation hints (searchable, computed, displayRole) that Zod has no concept of.

## What's NOT in this package

- Any concrete domain types (`LessonPlan`, `Student`, etc.) — those live in solution backends per [ADR-0001](../../docs/adr/0001-core-must-not-contain-domain-entities.md).
- NestJS bindings — this package is framework-free per [the layering convention](../../docs/architecture/package-layering.md). The bridge to NestJS lives in `packages/backend/src/ontology/` (lands in Phase 3 of the impl plan).
- Database / persistence — solutions own their own storage; the ontology defines the access protocol, not the data layer.

## Public API

Subpath exports (matches the `agent-runtime` sibling pattern):

| Import path | Contents |
|---|---|
| `@kedge-agentic/ontology` | Catch-all re-export of everything below |
| `@kedge-agentic/ontology/schema` | `PropertyMeta`, `LinkDef`, `ActionDef`, `FunctionDef`, `ObjectTypeDef`, `StreamDef`, `objectRef()`, `LocalizedString` |
| `@kedge-agentic/ontology/manifest` | `SlotDef`, `StateDef`, `AccessBoundary`, `LifecycleDef`, `ManifestDef` |
| `@kedge-agentic/ontology/accessor` | `ManifestAccessor`, `ActionResult`, `BoundaryDecision`, `checkBoundary()` |
| `@kedge-agentic/ontology/registry` | `OntologyRegistry`, `RegistrationError` |
| `@kedge-agentic/ontology/helpers` | `defineObjectType`, `defineAction`, `defineFunction`, `defineManifest`, `defineStateField` |
| `@kedge-agentic/ontology/semantic` | `projectManifest()`, projection format types |
| `@kedge-agentic/ontology/distribution` | `serializeRegistry()`, `computeSchemaDigest()` |

## Phase 1 scope (v0.1.0)

Ships:

- All core primitives + Tier 1: `FunctionDef`, `ActionDef.preconditions`, `LocalizedString`
- Framework-free design (zero NestJS / React / Vue dependencies — verified by architecture test)
- Subpath exports + catch-all root index
- Full validator suite for the Tier 1 rule set
- Three semantic-projection formats (Anthropic tool-use, MCP, system-prompt)

Deferred:

- **Tier 2** (`InterfaceDef`, `ObjectSetDef`, `BoundaryPredicate`, predicate-scoped `AccessBoundary`) → Phase 4
- **Tier 3** (`ValidationRuleMeta`, `StateMachineDef`, `PropertyMeta.classification`/`.redaction`, `NotificationRule`, `ActionDef.returnType`) → Phase 5, per-item gated
- **`AccessBoundary.readable`/`.writable`** ships as `readonly string[]` (the union with predicate entries lands in Phase 4)
- NestJS bridge + REST endpoint + `ManifestAccessor` implementation → Phase 3
- `context-layer` refactor → Phase 2

Attempting to use any deferred primitive (`defineInterface`, `defineObjectSet`, `ObjectTypeDef.implements`, etc.) is a compile-time error.

## Authoritative docs

- **[Design spec](../../docs/ontology/kedge-ontology-design.md)** — the full 3000+ line specification (Chinese: [.zh.md](../../docs/ontology/kedge-ontology-design.zh.md))
- **[Implementation plan](../../docs/ontology/kedge-ontology-implementation-plan.md)** — 5-phase rollout (Chinese: [.zh.md](../../docs/ontology/kedge-ontology-implementation-plan.zh.md))
- **[Gap analysis](../../docs/ontology/kedge-ontology-gap-analysis.md)** — what's deliberately in/out vs Palantir Ontology (Chinese: [.zh.md](../../docs/ontology/kedge-ontology-gap-analysis.zh.md))
- **[Progress tracker](../../docs/ontology/PROGRESS.md)** — phase status + commit log

## Development

```bash
npm install                                        # at repo root
npm run build -w @kedge-agentic/ontology           # build only this package
cd packages/ontology && npm test                   # run vitest
npm run typecheck                                  # repo-wide type-check
npm run build:libs                                 # full lib build chain (includes this)
```
