# kedge-ontology — Implementation Plan

> Companion to the [design spec](./kedge-ontology-design.md). The spec describes what the package *is*; this doc describes how it lands without breaking existing consumers.

## 1. Context — why this lands now

The design spec was finalized 2026-05-29. The repo already has working primitives that overlap with the proposed package:

- `EntityRegistry` (`packages/context-layer/src/core/entity-registry.ts`) approximates the proposed `OntologyRegistry`.
- `ReferenceableOptions` (`packages/context-layer/src/core/interfaces.ts`) approximates `ObjectTypeDef.picker`.
- `EntityContextProvider` covers the read/edit surface of the proposed `ManifestAccessor`.
- `ToolCallerProxy` (`packages/backend/src/tool-caller/`) already runs the 6-step governance pipeline `ActionDef`s will compile down to.
- Live-lesson already stores a `manifestJson` blob and validates it with `manifest.schema.ts` — the pre-formalization version of `ManifestDef`.

The risk: any change to these primitives ripples into recipe-book, live-lesson, demo-sandbox, and the React/Vue picker consumers. This plan stages the work so that no phase ships breaking changes alone.

**Success looks like:**

- `@kedge-agentic/ontology` is published in the workspace and consumed by `context-layer`.
- One live-lesson `ManifestDef` (`LessonSession`) registers cleanly.
- One live-lesson `ActionDef` (`emit_todo_card` from `creator-mcp-server`) registers via the ontology bridge and continues to function via the existing MCP+SSE flow.
- `GET /api/v1/ontology/schema` returns a stable digest; the frontend `@Picker` can be wired to consume it (not required to in this milestone — wiring is a follow-up).
- All existing tests pass; harness checks pass; `npm run typecheck` is clean across all packages.

---

## 2. Three-phase migration

### Phase 1 — Bootstrap `@kedge-agentic/ontology` (no consumer changes)

**Scope**

- Create `packages/ontology/` with the structure from spec §2.
- Add `zod` (v3, matching the rest of the repo) and `zod-to-json-schema` as runtime dependencies. `zod` is already a transitive dep through `ToolCallerProxy.argsSchema: ZodTypeAny`; promoting it to a direct dep is the codification of the Zod-first refactor.
- Implement schema primitives: `PropertyMeta` + `PropertyMetaMap` (sidecar), `objectRef` / `objectSetRef` (branded Zod helpers), `LinkDef`, `ActionDef` + `ActionPrecondition`, `FunctionDef`, `ObjectTypeDef` (`schema` + `meta`), `StreamDef`, `InterfaceDef`, `ObjectSetDef` + `SetFilter`.
- Implement `helpers/define.ts` — the `defineObjectType<S>`, `defineAction`, `defineFunction`, `defineInterface`, `defineObjectSet`, `defineManifest`, `defineStateField` family. Each is a type-narrowing passthrough; the generic constraint is what catches misspelled `meta` keys at compile time.
- Implement all manifest primitives (`SlotDef`, `StateDef` (Zod-backed), `AccessBoundary` + `BoundaryPathEntry`, `LifecycleDef`, `ManifestDef`).
- Implement `accessor/` types + `checkBoundary` pure function + `BoundaryPredicate` evaluator.
- Implement `OntologyRegistry` with full validation (spec §9.7 — Zod-first revision: drop rules Zod subsumes, add meta-key validity check, add interface structural-conformance check via `.shape` introspection).
- Implement `distribution/serialize.ts` + `digest.ts` (canonicalizes Zod schemas via `zod-to-json-schema` for stable cross-version digests).
- Implement `semantic/project.ts` + three format adapters: `anthropic-tools` and `mcp-tools` are thin wrappers around `zod-to-json-schema(action.params)`; `system-prompt` walks the Zod schema's `.shape` and renders one markdown bullet per field.
- Unit tests for every primitive, the registry, validators, `checkBoundary`, and each projection format.

**Out of scope**

- Any change to existing packages.
- Any NestJS controller / endpoint.
- Schema-bridge from `ActionDef` → `ToolDefinition` (Phase 3).

**Exit criteria**

- `npm run build:libs` includes ontology and emits `.d.ts`.
- `cd packages/ontology && npm test` is green.
- `npm run typecheck` is green from the repo root.
- No file outside `packages/ontology/` is touched.

**Risk**: lowest of the three. Pure addition; no consumer impact.

---

### Phase 2 — Refactor `context-layer` to consume ontology

**Scope**

- `packages/context-layer/package.json` adds `@kedge-agentic/ontology` as a dependency (workspace ref).
- `EntityRegistry` becomes a thin re-export wrapper around `OntologyRegistry`. Its existing public methods (`register`, `setRelations`, `getEntityTypes`, `registerProvider`, etc.) keep their current signatures so recipe-book and live-lesson don't need code changes.
- `ReferenceableOptions` becomes structurally equivalent to a `PickerConfig` projection. Add a converter `referenceableOptionsToPicker(opts): PickerConfig` and `pickerToReferenceableOptions(picker): ReferenceableOptions` for round-trip compat.
- `EntityContextProvider` gets a default adapter that exposes a `ManifestAccessor`-compatible facade for a single-slot manifest (one slot = one entity). This is opt-in; existing call sites are unchanged.
- **Schema introspection bridge**: `EntityRegistry.getEntityTypes()` continues to return the legacy `EntityTypeInfo` shape for back-compat, BUT also exposes `getObjectTypeSchema(typeName): ZodObject | undefined` so downstream consumers (recipe-book, the future schema-driven @Picker) can introspect the Zod schema directly. Recipe-book's existing call sites are unchanged; only *new* code paths use the schema accessor.
- No behavioral change visible to consumers. Tests in `packages/context-layer/` and `solutions/business/recipe-book/` continue to pass without edits.

**Out of scope**

- Live-lesson adoption (Phase 3).
- New REST endpoints (Phase 3).
- The `@Picker` UI swap to ontology-driven rendering (post-Phase 3 follow-up).

**Exit criteria**

- All tests in `packages/context-layer/`, `packages/context-layer-react/`, and `solutions/business/recipe-book/` are green.
- `npm test` from the repo root passes.
- `bash scripts/harness-checks.sh` passes.
- Recipe-book end-to-end picker flow works unchanged in dev (`cd solutions/business/recipe-book && npm run dev`).

**Risk**: medium. Refactoring shared infrastructure. Mitigation: behavioral parity tests added to `packages/context-layer/` *before* the refactor lands (snapshot the existing `EntityRegistry.getEntityTypes()` output for recipe-book and assert equality post-refactor).

---

### Phase 3 — Live-lesson adoption + `ToolCallerProxy` bridge

**Scope**

- New file `packages/backend/src/ontology/action-to-tool-definition.ts` — the bridge in spec §10.2 that compiles an `ActionDef` + handler into a `ToolDefinition` registered with `SolutionToolkitRegistry`.
- New file `packages/backend/src/ontology/manifest-accessor.service.ts` — default `ManifestAccessor` implementation wrapping `ToolCallerProxy` (for actions) + `EntityContextProvider` (for slot reads) + `SessionMetadata` (for runtime state).
- New module `packages/backend/src/ontology/ontology.module.ts` wiring the above, plus:
- New controller `packages/backend/src/ontology/ontology.controller.ts` exposing `GET /api/v1/ontology/schema` with ETag from `OntologyRegistry.getSchemaDigest()`. MUST have `@ApiTags('ontology')` (per project conventions — see `CLAUDE.md`).
- Live-lesson defines its first `ManifestDef`: `solutions/business/live-lesson/backend/src/ontology/lesson-session.manifest.ts`. Slots: `plan`, `class`, `students` (derived), `resources`. Streams: `events` (GLM observation). State: `phase`, `activeResourceIndex`. Boundaries: `agent` (read plan/class, write phase, subscribe events), `picker` (read plan/class/students/resources for @-references), `admin` (`*`).
- Live-lesson re-registers `emit_todo_card` (and only this one for the milestone) as an `ActionDef` via the bridge. The existing MCP stdio server path keeps working — the bridge is purely additive.
- Live-lesson's solution-startup hook calls `OntologyRegistry.registerObjectType()` / `.registerManifest()` after MCP registration.
- Integration test: a session creator-flow call to `emit_todo_card` goes through the bridge, hits `checkBoundary`, writes a `tool_events` audit row, and the SSE `output_update(card)` reaches the frontend unchanged.

**Out of scope**

- Migrating *all* live-lesson MCP tools (only `emit_todo_card` to prove the path).
- Demo-sandbox adoption.
- @Picker UI swap.
- Schema endpoint consumed by the Vue/React picker (follow-up milestone).

**Exit criteria**

- `GET /api/v1/ontology/schema` returns a 200 with a stable ETag from a fresh backend start; second call with `If-None-Match: <etag>` returns 304.
- `emit_todo_card` works in the creator flow (smoke-tested manually: open creator at `:5284`, trigger a todo card from a chat).
- One automated test asserts the bridge calls `checkBoundary` and the proxy still records a `tool_events` row.
- The existing live-lesson e2e suite (15 specs in `solutions/business/live-lesson/e2e/specs/`) is green.
- Documentation: update `docs/gitbook/zh/platform/` with a new "Ontology 架构" page (see §5 below).

**Risk**: highest of the three. New endpoint + bridge + first real `ManifestDef`. Mitigation: phased rollout *within* Phase 3 — first land the bridge in dead-code form (registered but no MCP tool migrated), then migrate `emit_todo_card`. Each step is independently revertible.

---

## 3. Breaking-change inventory

| Phase | What changes for downstream consumers | Required action |
|---|---|---|
| 1 | Nothing | None |
| 2 | `EntityRegistry`'s internal storage shifts to `OntologyRegistry`; public method signatures unchanged. New optional second arg `objectTypeDef?: ObjectTypeDef` on `register()` for new code paths. | None for existing call sites. New code may pass `ObjectTypeDef` for richer schema. |
| 3 | New REST endpoint `/api/v1/ontology/schema` added; no existing endpoint touched. New `OntologyModule` imported in `AppModule`. | None — purely additive. |

There are **no breaking changes** across all three phases. Every old call site continues to work.

---

## 4. Test strategy

### 4.1 Phase 1 (ontology package)

- **Unit**: per-primitive serialization round-trip, validator coverage (one test per rule in spec §9.7).
- **Property-based**: registry `getSchemaDigest()` is order-independent (register in 2+ orders, assert identical digest). Includes Zod-schema canonicalization stability — equivalent Zod schemas constructed differently (e.g. `z.object({...})` vs `z.object({...}).strict()`) must produce equivalent digest contributions if and only if they round-trip identically through `zod-to-json-schema`.
- **Projection golden**: snapshot tests for §11.2–11.4 examples; the projected output for the `LessonPlan` ObjectTypeDef must match the markdown / JSON in the spec verbatim. Snapshot inputs are the Zod schemas from spec §11.1; outputs are byte-for-byte JSON / Markdown. (Catches drift between docs and code AND between Zod and `zod-to-json-schema` updates.)
- **Schema-sanity**: for every `defineObjectType` call, every key in `meta` must be a key in `z.infer<typeof schema>`. The generic constraint catches it at compile time; the validator catches it at runtime; this test asserts both gates fire on a deliberately-broken example.
- **Architecture test**: `packages/ontology/test/architecture.test.ts` asserts the package imports zero solution-domain types and zero NestJS — enforces the "framework-agnostic primitives" claim of spec §1.5. (Note: `zod` and `zod-to-json-schema` ARE allowed; they're the schema layer.)

### 4.2 Phase 2 (context-layer refactor)

- **Parity**: snapshot `EntityRegistry.getEntityTypes()` output for recipe-book before refactor, assert equality after.
- **Round-trip**: `referenceableOptionsToPicker → pickerToReferenceableOptions` is identity for all registered live-lesson + recipe-book types.
- **Integration**: full recipe-book test suite + `packages/context-layer-react` `AtPicker` rendering tests pass unchanged.

### 4.3 Phase 3 (live-lesson + bridge)

- **Unit**: `actionToToolDefinition` produces a `ToolDefinition` whose `argsSchema.parse(validPayload)` succeeds and whose handler invokes `checkBoundary`.
- **Integration**: register one `ActionDef` via the bridge, invoke through `ToolCallerProxyService.invoke()`, assert (a) `tool_events` row written, (b) `checkBoundary` called with correct manifest+role, (c) handler dispatched.
- **End-to-end**: live-lesson's `solutions/business/live-lesson-creator/scripts/poc-smoke.sh` continues to pass.
- **HTTP**: `GET /api/v1/ontology/schema` returns expected body shape; ETag-conditional GET behaves correctly (200 / 304 / 200 after registration change).

---

## 5. Sequencing notes

### 5.1 PR shape

One PR per phase. Each PR includes:

- Code + tests for the phase.
- Updated docs in `docs/gitbook/zh/` where applicable (Phase 3 adds a "Ontology 架构" page under `docs/gitbook/zh/platform/`; the design spec already lives at `docs/ontology/kedge-ontology-design.md`).
- Updated `CLAUDE.md` references where applicable (root + `packages/backend/`).
- A note in `docs/CHANGES_2026-05.md` (or `06.md` if the work spills into June) describing the user-visible impact.

### 5.2 Dependency order

Phase 1 → Phase 2 → Phase 3. No parallelization possible within a phase boundary (Phase 2 cannot start until ontology package exists; Phase 3 needs both the package and the consumed `EntityRegistry` shape from Phase 2).

Within Phase 1, the schema primitives, manifest primitives, and accessor types can be built in parallel — they're separate files with no inter-dependencies until the registry imports them all.

### 5.3 Rollback story per phase

- **Phase 1**: trivially reversible. Delete the package directory; no consumer is affected.
- **Phase 2**: revert the `context-layer` PR. The new optional arg on `EntityRegistry.register` is non-breaking even when removed, since no production caller uses it yet.
- **Phase 3**: revert the live-lesson `ActionDef` registration (one-line change in solution-startup) and the `OntologyModule` import in `AppModule`. The schema endpoint becomes a 404; existing MCP path was never touched, so `emit_todo_card` continues to work the original way.

### 5.4 What's *deliberately* deferred to a later milestone

- `@Picker` UI rendering driven by `OntologyRegistry.getPickableTypes()`. Currently it reads `EntityRegistry`; after Phase 2 those are the same data, but swapping the React component to consume the new shape is a separate UX-impacting change that deserves its own design pass.
- Migrating the remaining live-lesson MCP tools (`emit_questions_card`, `emit_verify_card`) to `ActionDef`. Pattern is identical to `emit_todo_card`; do it once the bridge has been live for a sprint without regressions.
- Demo-sandbox adoption. The sandbox is the canonical e2e for the runtime layer; adding ontology to it is valuable but not on the critical path for the education-bureau PoC.
- A NestJS `@OntologyAction()` decorator for ergonomic action registration (today: explicit `registerToolkit()` call in solution startup). Decorator is sugar; defer until the verbose form has shipped and we know the friction points.

---

## 6. Operational checklist before each phase ships

Per `CLAUDE.md` post-implementation checklist:

1. **Tests**: `cd packages/backend && npx jest --no-coverage` plus the package-specific suite (`cd packages/ontology && npm test` for Phase 1; `cd packages/context-layer && npm test` for Phase 2; `cd solutions/business/live-lesson/backend && npm test` for Phase 3).
2. **Code review**: `code-reviewer` agent on every file in the diff.
3. **Harness**: `bash scripts/harness-checks.sh`.

If any of the three fails, do not ship the phase — fix and re-run from step 1.

---

## 7. Open implementation questions *(non-blocking for spec; resolve during build)*

These are *implementation* choices, not design decisions. They don't gate the spec but should be resolved during the relevant phase:

- **Phase 1**: do we use Zod internally to define + validate `PropertyDef` etc., or hand-roll? Recommendation: hand-roll, to keep zero runtime deps; Zod is only used at the bridge in Phase 3 when generating `argsSchema` for `ToolDefinition`.
- **Phase 2**: should `EntityRegistry`'s in-process singleton remain, or do we switch to NestJS DI? Recommendation: keep singleton — `EntityRegistry` is already used outside NestJS contexts (the React `AtPicker` reads it). DI would force a Nest dependency that the package shouldn't have.
- **Phase 3**: where does the *custom-role mapping table* (spec §10.3 last row) live — on `solution.json`, in code, or in the `OntologyRegistry`? Recommendation: in the registry, registered alongside `ManifestDef`s, so it travels with the schema endpoint payload. Avoid `solution.json` changes for now.
