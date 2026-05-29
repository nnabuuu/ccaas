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

## 2. Five-phase migration

> **Why five phases, not the original three?** The original plan was written before Tier 2 + Tier 3 primitives were SPEC-merged. Once they were, the original "Phase 1: bootstrap everything" implicitly grew to ~3× its intended scope. Splitting Phase 1 into a v0.1 core (this Phase 1) and a per-tier follow-up (Phases 4 and 5) keeps each phase shippable in one PR and preserves the original "promotion criteria still apply for IMPLEMENTATION" intent — only the SPEC was graduated early. See [gap analysis Tier 3 section](./kedge-ontology-gap-analysis.md#tier-3---✓-merged-into-design-spec-2026-05-29) for the promotion criteria reference.

### Phase 1 — Bootstrap `@kedge-agentic/ontology` v0.1 (core + Tier 1, no consumer changes)

This is the minimum-viable package that recipe-book and live-lesson can consume after Phase 2. **Tier 1 items (FunctionDef, ActionDef.preconditions, LocalizedString) ship here** because they fix conceptual errors in the base primitives — they're foundational, not optional extensions.

**Scope**

- Create `packages/ontology/` with the structure from spec §2.
- Add `zod` (v3, matching the rest of the repo) and `zod-to-json-schema` as runtime dependencies. `zod` is already a transitive dep through `ToolCallerProxy.argsSchema: ZodTypeAny`; promoting it to a direct dep is the codification of the Zod-first refactor.
- Implement **core + Tier 1** schema primitives only: `LocalizedString`, `PropertyMeta` + `PropertyMetaMap` (sidecar, without classification/redaction fields — those are Phase 5), `objectRef` (branded Zod helper; `objectSetRef` waits for Phase 4), `LinkDef`, `ActionDef` + `ActionPrecondition` (Tier 1; without `returnType` field — that's Phase 5), `FunctionDef` (Tier 1), `ObjectTypeDef` (`schema` + `meta`; without `implements` / `validationRules` / `stateMachine` fields — those are Phase 4-5), `StreamDef`.
- Implement `helpers/define.ts` — `defineObjectType<S>`, `defineAction`, `defineFunction`, `defineManifest`, `defineStateField`. (`defineInterface` and `defineObjectSet` wait for Phase 4.)
- Implement **core + Tier 1** manifest primitives: `SlotDef` (without `'objectSet'` target kind — Phase 4), `StateDef` (Zod-backed), `AccessBoundary` + `BoundaryPathEntry` (path-string entries only; predicate entries wait for Phase 4), `LifecycleDef`, `ManifestDef` (without `notifications` field — Phase 5).
- Implement `accessor/` types + `checkBoundary` pure function (without per-row predicate evaluation — Phase 4).
- Implement `OntologyRegistry` with v0.1 methods: register/get for ObjectType / Manifest / Function. Validators enforce spec §9.7's Tier 1 rules (meta-key validity, refTarget resolution, derivedFrom path resolution, semantic non-empty).
- Implement `distribution/serialize.ts` + `digest.ts` (canonicalizes Zod schemas via `zod-to-json-schema`).
- Implement `semantic/project.ts` + three format adapters: `anthropic-tools` and `mcp-tools` are thin wrappers around `zod-to-json-schema(action.params)`; `system-prompt` walks the Zod schema's `.shape` and renders one markdown bullet per field.
- Unit tests for every primitive, the registry, validators, `checkBoundary`, and each projection format.

**Out of scope (deferred to Phase 4 or 5)**

- Tier 2 primitives — `InterfaceDef`, `ObjectSetDef`, `BoundaryPredicate` + predicate-scoped `AccessBoundary` (Phase 4).
- Tier 3 primitives — `ValidationRuleMeta`, `StateMachineDef`, `PropertyMeta.classification`/`.redaction`, `NotificationRule`, `ActionDef.returnType` + `ActionResult.returnValue` (Phase 5, per-item gated).
- Any change to existing packages (Phase 2).
- Any NestJS controller / endpoint (Phase 3).
- Schema-bridge from `ActionDef` → `ToolDefinition` (Phase 3).

**Exit criteria**

- `npm run build:libs` includes ontology and emits `.d.ts`.
- `cd packages/ontology && npm test` is green.
- `npm run typecheck` is green from the repo root.
- No file outside `packages/ontology/` is touched.
- Calling `defineInterface(...)` / `defineObjectSet(...)` is a compile error (these helpers don't exist yet) — protects against accidental use of Tier 2 primitives before Phase 4 lands.

**Risk**: lowest of the five. Pure addition; no consumer impact.

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

> **Calendar gating**: this phase **MUST NOT** start until the Chengdu education-bureau PoC has shipped. Live-lesson is on the critical path for that delivery; Phase 3 introduces an architectural refactor (LessonSession `ManifestDef` + ActionDef bridge) to the live-lesson codebase, and doing this in parallel with PoC stabilization risks coupling. After PoC ships, run Phase 3 as a no-pressure refactor with full e2e coverage. Phase 2 (context-layer refactor with recipe-book as the test consumer) is unaffected by this gate — it proves the package end-to-end without touching critical-path code.

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

**Risk**: highest of the five. New endpoint + bridge + first real `ManifestDef`. Mitigation: phased rollout *within* Phase 3 — first land the bridge in dead-code form (registered but no MCP tool migrated), then migrate `emit_todo_card`. Each step is independently revertible.

---

### Phase 4 — Tier 2 primitives implementation

> **Gating**: Phase 4 starts only after Phase 3 has shipped *and* a real Solution has expressed a need for at least one Tier 2 primitive. Per gap analysis: Tier 2 items were SPEC-merged ahead of schedule, but the original "graduate after Phase 3 + first real MVP" timing still applies to IMPLEMENTATION. The spec describes the design contract; this phase makes it runnable.

**Scope** — implement Tier 2 primitives in the package + add their registry methods + update validators:

- `InterfaceDef` + `InterfaceLinkSignature` + `InterfaceActionSignature` (spec §3.8); `OntologyRegistry.registerInterface` + `getInterface` + `getImplementersOf`; validator structural-conformance check via `.shape` introspection.
- `ObjectSetDef` + `SetFilter` + `OrderClause` (spec §3.9); `OntologyRegistry.registerObjectSet` + `getObjectSet` + `getObjectSetsForType`; `SlotTarget` discriminated union gains `'objectSet'` kind; `objectSetRef()` helper; validator checks `objectType` registration + filter path resolution.
- `BoundaryPredicate` + `PathExpr` (spec §5.5); `OntologyRegistry.registerPredicate` + `getPredicate`; `AccessBoundary.readable`/`writable` accept `BoundaryPathEntry` union (path string OR `{slot, where}`); `checkBoundary` evaluates predicates per row when row context is supplied; validator checks predicate paths through Zod schemas.
- `defineInterface` / `defineObjectSet` helpers added to `helpers/define.ts`.
- `OntologyTypeDef.implements` field becomes operational (already in the TS shape from Phase 1, but unenforced until Phase 4 wires structural conformance).
- Unit + integration tests for each.

**Exit criteria**

- A test Solution (recipe-book extended, or a synthetic test bench) declares one Interface (`Mentionable`) and two implementors; `registry.getImplementersOf('Mentionable')` returns both.
- A test Solution declares one ObjectSet with a `lt`/`eq`/`and` filter; `readSlot` of an ObjectSet-typed slot returns only matching rows.
- A test AccessBoundary declares one `{slot, where}` entry; `checkBoundary` correctly filters rows by predicate.
- `npm test` from the repo root passes; `bash scripts/harness-checks.sh` passes.

**Risk**: medium. Each primitive is mostly self-contained; predicate evaluation interacts with `checkBoundary` which has existing test coverage from Phase 1.

---

### Phase 5 — Tier 3 primitives implementation (per-item gated)

> **Gating per item**: Tier 3 has **per-item promotion criteria** from the [gap analysis](./kedge-ontology-gap-analysis.md#tier-3---✓-merged-into-design-spec-2026-05-29). Each Tier 3 primitive ships only when its named criterion fires. **Do not pre-implement Tier 3 primitives "because they're in the spec."** The SPEC-merge was a documentation decision; implementation gates on real need. Possible (likely) outcome: only some of these ever land. That's correct behavior, not a regression.

**Items, each independently gated:**

| Primitive | Promotion criterion (from gap analysis) | What lands when it fires |
|---|---|---|
| `ValidationRuleMeta` (G7) | Third Solution with ≥3 domain rules on one Object Type | Add `validationRules` field to `ObjectTypeDef`; validator enforces refine-name linkage; projector exposes rules to agent view |
| `StateMachineDef` (G8) | First Object Type with ≥4 distinct lifecycle states | Add `stateMachine` field to `ObjectTypeDef`; new `op: { kind: 'transition' }` in `checkBoundary`; validator checks enum-field binding |
| `PropertyMeta.classification` + `.redaction` (G9 + G12) | First audit request for "list all PII accesses by Solution X" | Extend `PropertyMeta` with fields; add `Classification` type; `OntologyRegistry.getPropertiesByClassification`; redaction pipeline in `ManifestAccessor.readSlot` (apply mask/hash/omit after boundary check) |
| `NotificationRule` (G10) | Third unique notification handler across Solutions | Add `notifications` field to `ManifestDef`; `NotificationRule` + `NotificationChannel`; `OntologyRegistry.registerNotificationChannel`; runtime dispatcher post-action / post-state-change |
| `ActionDef.returnType` + `ActionResult.returnValue` (G11) | First Action whose useful return is structured (more than a state-change record) | Add `returnType` field to `ActionDef`; add `returnValue` to `ActionResult`; bridge parses return through declared Zod schema; projector includes `zod-to-json-schema(returnType)` in action descriptor |

**Per-item exit criteria** — for each item: one Solution registers it for a real use case (not a synthetic test); the agent's projected view shows it; one e2e test exercises the runtime behavior.

**Risk**: lowest per item (each is small and independent); aggregate risk = "we build things nobody uses." Mitigation: the gating criteria are explicit guardrails — only implement when the criterion is met. If three years pass and `NotificationRule` is never triggered, that's a successful application of the gating, not a missed feature.

---

## 3. Breaking-change inventory

| Phase | What changes for downstream consumers | Required action |
|---|---|---|
| 1 | Nothing | None |
| 2 | `EntityRegistry`'s internal storage shifts to `OntologyRegistry`; public method signatures unchanged. New optional second arg `objectTypeDef?: ObjectTypeDef` on `register()` for new code paths. | None for existing call sites. New code may pass `ObjectTypeDef` for richer schema. |
| 3 | New REST endpoint `/api/v1/ontology/schema` added; no existing endpoint touched. New `OntologyModule` imported in `AppModule`. | None — purely additive. |
| 4 | New optional fields on `ObjectTypeDef` (`implements`), new `SlotTarget` discriminant kind (`objectSet`), new entry shape on `AccessBoundary.readable`/`writable` (`{slot, where}` union with existing path string). All non-breaking — old data shapes still parse. | None for existing call sites. New code may use the new shapes. |
| 5 | Per-item: each Tier 3 primitive adds an optional field to an existing primitive (e.g. `ObjectTypeDef.validationRules`, `ManifestDef.notifications`). All optional. | None per item — purely additive. |

There are **no breaking changes** across all five phases. Every old call site continues to work.

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

### 4.4 Phase 4 (Tier 2 primitives)

- **Unit**: structural-conformance validator catches every mismatch case (missing field, type mismatch, missing link, missing action); ObjectSet filter evaluation correctness per filter operator (eq/ne/lt/le/gt/ge/in/has/and/or/not); predicate path resolution rejects unresolvable paths at registration.
- **Integration**: end-to-end test of one Interface with two implementors using `getImplementersOf`; end-to-end test of one ObjectSet read via `readSlot` returning filter-matched rows; end-to-end test of predicate-scoped `AccessBoundary.readable` filtering rows by row-context.
- **No live-lesson regression**: re-run live-lesson e2e suite to confirm Phase 4 additions don't disturb the Phase 3 wiring.

### 4.5 Phase 5 (Tier 3 primitives — per-item)

- **Per-item unit tests**: each primitive lands with its own validator-rule coverage (validation-rule name linkage, state-machine enum binding, classification taxonomy validity, notification predicate resolution, returnType Zod-validity).
- **Per-item integration test**: one Solution use case per primitive demonstrates the runtime behavior end-to-end. **No integration test → don't ship the primitive**, even if its unit tests are green. The promotion criterion requires real use, not synthetic.
- **Compliance audit smoke** (when `classification`/`redaction` land): produce a sample audit report from `getPropertiesByClassification('pii')`; verify redaction strategy outputs match the documented behavior (mask/hash/omit).

---

## 5. Sequencing notes

### 5.1 PR shape

One PR per phase. Each PR includes:

- Code + tests for the phase.
- Updated docs in `docs/gitbook/zh/` where applicable (Phase 3 adds a "Ontology 架构" page under `docs/gitbook/zh/platform/`; the design spec already lives at `docs/ontology/kedge-ontology-design.md`).
- Updated `CLAUDE.md` references where applicable (root + `packages/backend/`).
- A note in `docs/CHANGES_2026-05.md` (or `06.md` if the work spills into June) describing the user-visible impact.

### 5.2 Dependency order

```
Phase 1 (v0.1 core + Tier 1)
    │
    ├──> Phase 2 (context-layer refactor, recipe-book is test consumer)
    │       │
    │       └──> Phase 3 (live-lesson adoption + bridge)
    │              │ [GATE: Chengdu PoC must have shipped]
    │              │
    │              └──> Phase 4 (Tier 2 primitives implementation)
    │                     │ [GATE: real Solution need]
    │                     │
    │                     └──> Phase 5 (Tier 3 primitives, per-item)
    │                            [GATE: per-item promotion criterion]
    │
    └──> Phase 4 can technically start in parallel with Phase 2+3
            (no Phase 4 code depends on Phase 2+3), but it shouldn't —
            without a real Solution exercising the new primitives,
            Phase 4 risks building unused infrastructure.
```

Within Phase 1, the schema primitives, manifest primitives, and accessor types can be built in parallel — they're separate files with no inter-dependencies until the registry imports them all.

### 5.3 Rollback story per phase

- **Phase 1**: trivially reversible. Delete the package directory; no consumer is affected.
- **Phase 2**: revert the `context-layer` PR. The new optional arg on `EntityRegistry.register` is non-breaking even when removed, since no production caller uses it yet.
- **Phase 3**: revert the live-lesson `ActionDef` registration (one-line change in solution-startup) and the `OntologyModule` import in `AppModule`. The schema endpoint becomes a 404; existing MCP path was never touched, so `emit_todo_card` continues to work the original way.
- **Phase 4**: per-primitive revertible. Each Tier 2 primitive lives in its own file in `packages/ontology/src/schema/`; removing the file + its registry-method-method wiring un-ships it without affecting Phase 1-3.
- **Phase 5**: trivially per-item revertible. Each Tier 3 primitive is an optional field on an existing primitive; removing the field + its validator rule + its consumer un-ships it. If the field was never used by a real Solution (because no Solution had triggered the promotion criterion), removal has zero blast radius.

### 5.4 What's *deliberately* deferred to a later milestone

- `@Picker` UI rendering driven by `OntologyRegistry.getPickableTypes()`. Currently it reads `EntityRegistry`; after Phase 2 those are the same data, but swapping the React component to consume the new shape is a separate UX-impacting change that deserves its own design pass.
- Migrating the remaining live-lesson MCP tools (`emit_questions_card`, `emit_verify_card`) to `ActionDef`. Pattern is identical to `emit_todo_card`; do it once the bridge has been live for a sprint without regressions.
- Demo-sandbox adoption. The sandbox is the canonical e2e for the runtime layer; adding ontology to it is valuable but not on the critical path for the education-bureau PoC.
- A NestJS `@OntologyAction()` decorator for ergonomic action registration (today: explicit `registerToolkit()` call in solution startup). Decorator is sugar; defer until the verbose form has shipped and we know the friction points.
- **Tier 2/3 primitives whose promotion criteria haven't fired.** Per Phase 4+5 gating, these stay in the SPEC but not the runtime. This is the explicit answer to "we SPEC-merged everything, why isn't it all built?" — building ahead of need is the failure mode the gating prevents.

---

## 6. Operational checklist before each phase ships

Per `CLAUDE.md` post-implementation checklist:

1. **Tests**: `cd packages/backend && npx jest --no-coverage` plus the package-specific suite:
   - Phase 1, 4, 5 → `cd packages/ontology && npm test`
   - Phase 2 → `cd packages/context-layer && npm test` (and run recipe-book test suite)
   - Phase 3 → `cd solutions/business/live-lesson/backend && npm test` (and `poc-smoke.sh`)
2. **Code review**: `code-reviewer` agent on every file in the diff.
3. **Harness**: `bash scripts/harness-checks.sh`.
4. **Gating verification** (Phase 3, 4, 5 only):
   - Phase 3: confirm Chengdu PoC has shipped before merging.
   - Phase 4: confirm a real Solution has expressed need for at least one Tier 2 primitive (document the need in the PR description).
   - Phase 5: per-item, confirm the promotion criterion from the gap analysis has fired (document in PR description with concrete reference: "Solution X has 3 domain rules on Y" / "Solution X needs Z lifecycle states" / etc.).

If any of the four fails, do not ship the phase — fix and re-run from step 1. Gating failures are not "skipped" — they mean the phase isn't ready and the work should be paused, not pushed through.

---

## 7. Open implementation questions *(non-blocking for spec; resolve during build)*

These are *implementation* choices, not design decisions. They don't gate the spec but should be resolved during the relevant phase:

- **Phase 1**: Zod is now the canonical runtime type layer per the Zod-first refactor (gap analysis G20). The original "hand-roll vs Zod" question is settled — Zod is in. The remaining open question: do we use `zod-to-json-schema` directly, or pre-generate JSON Schemas at registration and cache them? Recommendation: pre-generate at `register*()` time (cost is paid once at boot), cache on the registry; `getSchemaDigest()` uses the cached JSON Schema for stability.
- **Phase 2**: should `EntityRegistry`'s in-process singleton remain, or do we switch to NestJS DI? Recommendation: keep singleton — `EntityRegistry` is already used outside NestJS contexts (the React `AtPicker` reads it). DI would force a Nest dependency that the package shouldn't have.
- **Phase 3**: where does the *custom-role mapping table* (spec §10.3 last row) live — on `solution.json`, in code, or in the `OntologyRegistry`? Recommendation: in the registry, registered alongside `ManifestDef`s, so it travels with the schema endpoint payload. Avoid `solution.json` changes for now.
